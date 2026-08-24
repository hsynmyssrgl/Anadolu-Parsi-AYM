import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const output='artifacts/validation/33-T-household-operations-center-runtime.json';
const readJson=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const [scope,inventory,registry,roadmap,plan,ledger]=await Promise.all([
  readJson('config/33-t-household-operations-center-scope.json'),readJson('config/33-t-household-operations-center-inventory.json'),readJson('config/accepted-scope-registry.json'),readJson('config/remaining-scope-package-roadmap.json'),readJson('config/work-segmentation-plan.json'),readJson('config/active-governance-ledger.json')
]);
const testFiles=Object.freeze([
  'packages/application/tests/household-operations-use-cases.test.ts','packages/repositories/household-operations-repository-policy.test.ts','apps/desktop/tests/household-operations-ipc-integration.test.ts','apps/desktop/tests/household-operations-data-store.test.ts','apps/desktop/tests/household-operations-ui.test.ts'
]);
const execute=(args,timeout=300_000)=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout,maxBuffer:64*1024*1024,env:process.env});
const clean=(value)=>String(value??'').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu,'');
const combined=(result)=>clean(`${result.stdout??''}\n${result.stderr??''}`);
const parseJson=(result)=>{try{return JSON.parse(clean(result.stdout).trim());}catch{return undefined;}};
const vitest=execute(['node_modules/vitest/vitest.mjs','run',...testFiles,'--maxWorkers=1']);const vitestOutput=combined(vitest);
const filesPassed=Number(vitestOutput.match(/Test Files\s+(\d+) passed/u)?.[1]??0);const testsPassed=Number(vitestOutput.match(/Tests\s+(\d+) passed/u)?.[1]??0);
const migration=execute(['scripts/verify-database-migrations.mjs']);const migrationReport=parseJson(migration);const migration98=migrationReport?.migrationVersions?.find((item)=>item.version===98);
const latestMigrationVersion=migrationReport?.migrationVersions?.at(-1)?.version;
const smoke=execute(['scripts/verify-data-store-smoke.mjs']);const smokeReport=parseJson(smoke);
const ppk021=execute(['scripts/verify-platform-policy-ast-gate.mjs']);const ppk021Report=parseJson(ppk021);
const ppk022=execute(['scripts/verify-platform-capability-manifest-gate.mjs']);const ppk022Report=parseJson(ppk022);
const typechecks={
  domain:execute(['node_modules/typescript/bin/tsc','-p','packages/domain/tsconfig.json','--noEmit']),application:execute(['node_modules/typescript/bin/tsc','-p','packages/application/tsconfig.json','--noEmit']),repositoryContracts:execute(['node_modules/typescript/bin/tsc','-p','packages/repository-contracts/tsconfig.json','--noEmit']),repositories:execute(['node_modules/typescript/bin/tsc','-p','packages/repositories/tsconfig.json','--noEmit']),database:execute(['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json','--noEmit']),desktopElectron:execute(['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.electron.json','--noEmit']),desktopRenderer:execute(['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.renderer.json','--noEmit'])
};
const requirements=['EXT-001','EXT-002','EXT-003','EXT-004','EXT-005','EXT-006','EXT-007','EXT-008'];const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-T');
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['exact five-file local Vitest process exits successfully',vitest.status===0&&vitest.signal===null],
  ['local test result meets exact 5/22 ratchet',filesPassed===5&&testsPassed===22&&scope.validation?.targetedTestFileRatchet===5&&scope.validation?.targetedTestRatchet===22&&inventory.validation?.targetedTestFileRatchet===5&&inventory.validation?.targetedTestRatchet===22],
  ['migration verifier passes exact migration 98 checksum',migration.status===0&&migrationReport?.status==='passed'&&migrationReport?.checkCount===9&&migration98?.name==='household_operations_center'&&migration98?.checksum==='b5a09712e4f9611e928509441005ede824a9fceb516caa3b3d74cf83dc8f4d60'],
  ['data store smoke includes migration 98, reaches the current migration head and passes 14 logical checks',smoke.status===0&&smokeReport?.status==='passed'&&smokeReport?.checks===14&&smokeReport?.migrationVersions?.includes(98)&&smokeReport?.migrationVersions?.at(-1)===latestMigrationVersion],
  ['PPK-021 raw gate passes exact 590/897 ratchet',ppk021.status===0&&ppk021Report?.status==='PASS'&&ppk021Report?.scannedFiles===590&&ppk021Report?.privilegedSurfaces===897&&ppk021Report?.exactAllowlistSha256==='9ea5b846e552e760fbd8dd5f8bee7fb83988ef19bb93e3bbd4ac0465c4b71205'&&ppk021Report?.directRoleAuthorizationBypasses===0],
  ['PPK-022 raw gate passes exact 590/447 ratchet',ppk022.status===0&&ppk022Report?.status==='PASS'&&ppk022Report?.scannedFiles===590&&ppk022Report?.capabilitySurfaces===447&&ppk022Report?.exactManifestSha256==='54061e189e7771868552efa869c69a75426f24e4edd846af1c62496c82f0e1d6'],
  ['domain application contract repository and database typechecks pass',['domain','application','repositoryContracts','repositories','database'].every((key)=>typechecks[key].status===0)],
  ['desktop Electron typecheck passes',typechecks.desktopElectron.status===0],
  ['desktop renderer typecheck passes',typechecks.desktopRenderer.status===0],
  ['33-T stays planned behind 33-N while 33-P remains active',roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(['33-N'])&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'&&registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)],
  ['external truth remains not performed or not configured',scope.truth?.externalShoppingOrderPerformed===false&&scope.truth?.paymentExecutionPerformed===false&&scope.truth?.carrierSynchronizationPerformed===false&&scope.truth?.remoteAccessControlPerformed===false&&scope.truth?.petCareDeliveryPerformed===false],
  ['manual evidence certification and requirement pass remain closed',manualNotRun&&scope.manualEvidence?.certificationClaimed===false&&scope.validation?.countsAsRequirementPass===false&&inventory.validation?.countsAsRequirementPass===false&&scope.persistentReceiptStatus==='NOT_RUN']
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-T',decision:'DEC-231',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',automatedRuntimeStatus:failures.length?'FAIL':'LOCAL_COMPOSED_COMPONENT_MATRIX_PASS',countsAsRequirementPass:false,targetedTestFilesPassed:filesPassed,targetedTestsPassed:testsPassed,targetedTestFileRatchet:5,targetedTestRatchet:22,migration98Sha256:migration98?.checksum??null,ppk021:ppk021Report,ppk022:ppk022Report,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'});}
if(failures.length){console.error(`33-T runtime: FAIL (${failures.length}/${checks.length}).`);for(const failure of failures)console.error(failure.name);process.exit(1);}
console.log(`33-T runtime: PASS (${checks.length}/${checks.length}); ${filesPassed}/${filesPassed} files, ${testsPassed}/${testsPassed} tests.`);
