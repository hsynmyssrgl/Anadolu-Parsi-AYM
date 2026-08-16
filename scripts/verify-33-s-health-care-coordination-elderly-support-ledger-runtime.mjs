import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const noWrite = process.argv.includes('--no-write');
const output = 'artifacts/validation/33-S-health-care-coordination-elderly-support-ledger-runtime.json';
const readJson = async (path) => JSON.parse(await readFile(resolve(root,path),'utf8'));
const [scope, inventory, registry, roadmap, plan, ledger] = await Promise.all([
  readJson('config/33-s-health-care-coordination-elderly-support-ledger-scope.json'),
  readJson('config/33-s-health-care-coordination-elderly-support-ledger-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json')
]);

const testFiles = Object.freeze([
  'packages/application/tests/health-care-coordination-use-cases.test.ts',
  'packages/repositories/health-care-coordination-repository-policy.test.ts',
  'apps/desktop/tests/health-care-coordination-ipc-integration.test.ts',
  'apps/desktop/tests/health-care-coordination-data-store.test.ts',
  'apps/desktop/tests/health-care-coordination-ui.test.ts'
]);
const execute = (args, timeout=300_000) => spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout,maxBuffer:64*1024*1024,env:process.env});
const clean = (value) => String(value??'').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu,'');
const combined = (result) => clean(`${result.stdout??''}\n${result.stderr??''}`);
const parseJson = (result) => { try { return JSON.parse(clean(result.stdout).trim()); } catch { return undefined; } };

const vitest = execute(['node_modules/vitest/vitest.mjs','run',...testFiles,'--maxWorkers=1']);
const vitestOutput = combined(vitest);
const filesPassed = Number(vitestOutput.match(/Test Files\s+(\d+) passed/u)?.[1]??0);
const testsPassed = Number(vitestOutput.match(/Tests\s+(\d+) passed/u)?.[1]??0);
const migration = execute(['scripts/verify-database-migrations.mjs']);
const migrationReport = parseJson(migration);
const migration97 = migrationReport?.migrationVersions?.find((item) => item.version === 97);
const latestMigrationVersion = migrationReport?.migrationVersions?.at(-1)?.version;
const smoke = execute(['scripts/verify-data-store-smoke.mjs']);
const smokeReport = parseJson(smoke);
const ppk021 = execute(['scripts/verify-platform-policy-ast-gate.mjs']);
const ppk021Report = parseJson(ppk021);
const ppk022 = execute(['scripts/verify-platform-capability-manifest-gate.mjs']);
const ppk022Report = parseJson(ppk022);
const typechecks = {
  domain:execute(['node_modules/typescript/bin/tsc','-p','packages/domain/tsconfig.json','--noEmit']),
  application:execute(['node_modules/typescript/bin/tsc','-p','packages/application/tsconfig.json','--noEmit']),
  repositoryContracts:execute(['node_modules/typescript/bin/tsc','-p','packages/repository-contracts/tsconfig.json','--noEmit']),
  repositories:execute(['node_modules/typescript/bin/tsc','-p','packages/repositories/tsconfig.json','--noEmit']),
  database:execute(['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json','--noEmit']),
  desktopElectron:execute(['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.electron.json','--noEmit']),
  desktopRenderer:execute(['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.renderer.json','--noEmit'])
};
const requirements = ['B5-01','B5-02','EXT-021','EXT-023','EXT-024','EXT-025','EXT-026','EXT-027','EXT-028','EXT-029'];
const registryItems = requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const roadmapItem = roadmap.packages?.find((item)=>item.step==='33-S');
const manualNotRun = Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');

const definitions = [
  ['exact five-file local Vitest process exits successfully', vitest.status===0 && vitest.signal===null],
  ['local test result meets exact 5/20 ratchet', filesPassed===5 && testsPassed===20 && scope.validation?.targetedTestFileRatchet===5 && scope.validation?.targetedTestRatchet===20 && inventory.validation?.targetedTestFileRatchet===5 && inventory.validation?.targetedTestRatchet===20],
  ['migration verifier passes exact migration 97 checksum', migration.status===0 && migrationReport?.status==='passed' && migrationReport?.checkCount===9 && migration97?.name==='health_care_coordination_elder_support' && migration97?.checksum==='e3d60800e250feb674cd1250449982ac45cd7e700e74a728be7f6500c054d081'],
  ['data store smoke includes migration 97 and matches the current migration head with 14 logical checks', smoke.status===0 && smokeReport?.status==='passed' && smokeReport?.checks===14 && smokeReport?.migrationVersions?.includes(97) && smokeReport?.migrationVersions?.at(-1)===latestMigrationVersion],
  ['PPK-021 raw gate passes exact 555/873 ratchet', ppk021.status===0 && ppk021Report?.status==='PASS' && ppk021Report?.scannedFiles===555 && ppk021Report?.privilegedSurfaces===873 && ppk021Report?.exactAllowlistSha256==='843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc' && ppk021Report?.directRoleAuthorizationBypasses===0],
  ['PPK-022 raw gate passes exact 555/392 ratchet', ppk022.status===0 && ppk022Report?.status==='PASS' && ppk022Report?.scannedFiles===555 && ppk022Report?.capabilitySurfaces===392 && ppk022Report?.exactManifestSha256==='cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'],
  ['domain application contract repository and database typechecks pass', ['domain','application','repositoryContracts','repositories','database'].every((key)=>typechecks[key].status===0)],
  ['desktop Electron typecheck passes', typechecks.desktopElectron.status===0],
  ['desktop renderer typecheck passes', typechecks.desktopRenderer.status===0],
  ['33-S stays planned behind 33-O and 33-N while 33-P remains active', roadmapItem?.status==='PLANNED' && JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(['33-O','33-N']) && plan.currentStep==='33-P' && ledger.activeMicroStep==='33-P' && registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)],
  ['external truth remains not performed or not configured', scope.truth?.medicalVerificationPerformed===false && scope.truth?.sensorOrFallDetectorIntegrated===false && scope.truth?.emergencyServiceContacted===false && scope.truth?.remoteHelpDelivered===false],
  ['manual evidence certification and requirement pass remain closed', manualNotRun && scope.manualEvidence?.certificationClaimed===false && scope.validation?.countsAsRequirementPass===false && inventory.validation?.countsAsRequirementPass===false && scope.persistentReceiptStatus==='NOT_RUN']
];

const checks = definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures = checks.filter((item)=>item.status==='FAIL');
const report = {schemaVersion:1,step:'33-S',decision:'DEC-230',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',automatedRuntimeStatus:failures.length?'FAIL':'LOCAL_COMPOSED_COMPONENT_MATRIX_PASS',countsAsRequirementPass:false,targetedTestFilesPassed:filesPassed,targetedTestsPassed:testsPassed,targetedTestFileRatchet:5,targetedTestRatchet:20,migration97Sha256:migration97?.checksum??null,ppk021:ppk021Report,ppk022:ppk022Report,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'});}
if(failures.length){console.error(`33-S runtime: FAIL (${failures.length}/${checks.length}).`);for(const failure of failures)console.error(failure.name);process.exit(1);}
console.log(`33-S runtime: PASS (${checks.length}/${checks.length}); ${filesPassed}/${filesPassed} files, ${testsPassed}/${testsPassed} tests.`);
