import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const [scope,inventory,registry,roadmap,plan,ledger]=await Promise.all([
  json('config/33-x-memory-studio-time-capsule-scope.json'),json('config/33-x-memory-studio-time-capsule-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json')
]);
const testFiles=Object.freeze(scope.validation.targetedTestFiles);
const execute=(args,timeout=300000)=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout,maxBuffer:64*1024*1024,env:process.env});
const clean=(value)=>String(value??'').replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu,'');
const output=(result)=>clean(`${result.stdout??''}\n${result.stderr??''}`);
const parse=(result)=>{try{return JSON.parse(clean(result.stdout).trim());}catch{return undefined;}};
const vitest=execute(['node_modules/vitest/vitest.mjs','run',...testFiles,'--maxWorkers=1']);
const vitestText=output(vitest);
const files=Number(vitestText.match(/Test Files\s+(\d+) passed/u)?.[1]??0);
const tests=Number(vitestText.match(/Tests\s+(\d+) passed/u)?.[1]??0);
const migration=execute(['scripts/verify-database-migrations.mjs']);const migrationReport=parse(migration);const m102=migrationReport?.migrationVersions?.find((item)=>item.version===102);
const latestMigrationVersion=migrationReport?.migrationVersions?.at(-1)?.version;
const smoke=execute(['scripts/verify-data-store-smoke.mjs']);const smokeReport=parse(smoke);
const gate21=execute(['scripts/verify-platform-policy-ast-gate.mjs']);const p21=parse(gate21);
const gate22=execute(['scripts/verify-platform-capability-manifest-gate.mjs']);const p22=parse(gate22);
const packages=['domain','application','repository-contracts','repositories','database'];
const types=Object.fromEntries(packages.map((name)=>[name,execute(['node_modules/typescript/bin/tsc','-p',`packages/${name}/tsconfig.json`,'--noEmit'])]));
types.electron=execute(['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.electron.json','--noEmit']);
types.renderer=execute(['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.renderer.json','--noEmit']);
const requirements=scope.requirements;const dependencies=['33-Q','33-R','33-W'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-X');
const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manual=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['exact five-file local Vitest exits successfully',vitest.status===0&&vitest.signal===null],
  ['local test result meets exact 5/21 ratchet',files===5&&tests===21&&scope.validation.targetedTestFileRatchet===5&&scope.validation.targetedTestRatchet===21&&inventory.validation.targetedTestRatchet===21],
  ['migration verifier passes exact migration 102 checksum',migration.status===0&&migrationReport?.status==='passed'&&migrationReport?.checkCount===9&&m102?.name==='memory_studio_time_capsule'&&m102?.checksum===scope.validation.migrationSha256],
  ['data store smoke includes migration 102 and reaches the current migration head',smoke.status===0&&smokeReport?.status==='passed'&&smokeReport?.migrationVersions?.includes(102)&&smokeReport?.migrationVersions?.at(-1)===latestMigrationVersion],
  ['PPK-021 raw gate matches scope ratchet',gate21.status===0&&p21?.status==='PASS'&&p21?.scannedFiles===scope.validation.ppk021.scannedProductionFiles&&p21?.privilegedSurfaces===scope.validation.ppk021.exactPrivilegedSurfaceCount&&p21?.exactAllowlistSha256===scope.validation.ppk021.exactAllowlistSha256],
  ['PPK-022 raw gate matches scope ratchet',gate22.status===0&&p22?.status==='PASS'&&p22?.scannedFiles===scope.validation.ppk022.scannedProductionFiles&&p22?.capabilitySurfaces===scope.validation.ppk022.exactCapabilitySurfaceCount&&p22?.exactManifestSha256===scope.validation.ppk022.exactCapabilityManifestSha256],
  ['all package and desktop typechecks pass',Object.values(types).every((result)=>result.status===0)],
  ['33-X remains planned behind exact dependencies while 33-P stays active',roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(dependencies)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'&&registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)],
  ['automation rendering print network cloud and delivery truth remain closed',scope.truth.localOnly===true&&scope.truth.transcriptionPerformed===false&&scope.truth.faceRecognitionPerformed===false&&scope.truth.duplicateDetectionPerformed===false&&scope.truth.documentaryRendered===false&&scope.truth.printableBookRendered===false&&scope.truth.printingPerformed===false&&scope.truth.networkUsed===false&&scope.truth.cloudUsed===false&&scope.truth.externalDeliveryPerformed==='not_performed'],
  ['manual evidence receipt and acceptance remain closed',manual&&scope.manualEvidence.certificationClaimed===false&&scope.validation.countsAsRequirementPass===false&&inventory.validation.countsAsRequirementPass===false&&scope.persistentReceiptStatus==='NOT_RUN']
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-X',decision:'DEC-235',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,targetedTestFilesPassed:files,targetedTestsPassed:tests,migration102Sha256:m102?.checksum??null,ppk021:p21,ppk022:p22,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-X-memory-studio-time-capsule-runtime.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-X runtime: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`33-X runtime: PASS (${checks.length}/${checks.length}); ${files}/${files} files, ${tests}/${tests} tests.`);
