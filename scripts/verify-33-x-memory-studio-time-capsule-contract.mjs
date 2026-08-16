import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const targetedTestFiles=Object.freeze([
  'packages/application/tests/memory-studio-use-cases.test.ts','packages/repositories/memory-studio-repository-policy.test.ts',
  'apps/desktop/tests/memory-studio-data-store.test.ts','apps/desktop/tests/memory-studio-ipc-integration.test.ts',
  'apps/desktop/tests/memory-studio-ui.test.ts'
]);
const [scope,inventory,manifest,migrations,contract,repository,adapter,runtime,main,preload,globalTypes,decision,threat,...tests]=await Promise.all([
  json('config/33-x-memory-studio-time-capsule-scope.json'),json('config/33-x-memory-studio-time-capsule-inventory.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),text('packages/database/src/family-database-migrations.ts'),
  text('packages/repository-contracts/src/memory-studio-repository.ts'),text('packages/repositories/src/memory-studio-repository.ts'),
  text('apps/desktop/src/main/memory-studio-application-adapter.ts'),text('apps/desktop/src/main/life-production-policy-runtime.ts'),
  text('apps/desktop/src/main/main.ts'),text('apps/desktop/src/main/preload.ts'),text('apps/desktop/src/renderer/global.d.ts'),
  text('docs/decisions/DEC-235-memory-studio-time-capsule.md'),text('docs/security/THREAT_MODEL_33_X_MEMORY_STUDIO_TIME_CAPSULE.md'),
  ...targetedTestFiles.map(text)
]);
const match=migrations.match(/const memoryStudioSql = `([\s\S]*?)`;\r?\n/u);
const sha=match?createHash('sha256').update(`${match[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex'):'';
const migration=manifest.migrationVersions?.find((item)=>item.version===102);
const p21=scope.validation.ppk021;const p22=scope.validation.ppk022;
const definitions=[
  ['scope inventory and five-test matrix are exact',JSON.stringify(scope.requirements)===JSON.stringify(inventory.requirements)&&JSON.stringify(scope.validation.targetedTestFiles)===JSON.stringify(inventory.implementedTargetedTests)&&tests.length===5&&scope.validation.targetedTestRatchet===21],
  ['migration 102 source manifest and scope checksums are canonical',migration?.name==='memory_studio_time_capsule'&&migration?.checksum===sha&&sha===scope.validation.migrationSha256&&sha==='cb719e825fde1269af44900d4ab66d1fa6a550e7cfe1695535a6e4e5c7cceafa'],
  ['migration owns immutable mutation record and capsule ledgers',has(migrations,['memory_studio_mutations','memory_studio_records','memory_time_capsules','trg_33x_memory_mutation_delete','trg_33x_memory_record_delete','trg_33x_capsule_delete'])],
  ['repository contract exposes center record capsule mutation reference and policy ports',has(contract,['loadCenter','findRecord','findCapsule','findMutationByClientOperationId','validateOwnedReferences','insertMutation','insertRecord','saveRecord','insertCapsule','saveCapsule','resolvePolicyResource'])],
  ['repository enforces exact receipt and payload-free policy resolution',has(repository,['writeBinding(context, row)','validateOwnedReferences','resolvePolicyResource'])],
  ['desktop adapter composes central policy and transactional audit outbox',has(adapter,['RepositoryBackedLifePolicyTransactionRunner','RepositoryBackedMemoryStudioUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['production runtime resolves exact private record and capsule owners',has(runtime,["resourceType === 'memory_studio_record'","resourceType === 'memory_time_capsule'",'ownerPersonId: found.value.ownerPersonId'])],
  ['main preload and renderer expose exact six safe methods',has(main,['MEMORY_STUDIO_IPC_CHANNELS.getCenter','MEMORY_STUDIO_IPC_CHANNELS.createRecord','MEMORY_STUDIO_IPC_CHANNELS.transitionCapsule'])&&has(preload,['getMemoryStudioCenter','createMemoryStudioRecord','deleteMemoryStudioRecord','createMemoryTimeCapsule','reviewMemoryTimeCapsule','transitionMemoryTimeCapsule'])&&has(globalTypes,['getMemoryStudioCenter','createMemoryStudioRecord','deleteMemoryStudioRecord','createMemoryTimeCapsule','reviewMemoryTimeCapsule','transitionMemoryTimeCapsule'])],
  ['tests cover replay foreign references two approvals wait rollback IPC and existing route',has(tests.join('\n'),['replayed: true','operation-foreign-33-x','requires two distinct accounts','capsule_rollback','rejects unknown or extra authority fields','without adding a second route'])],
  ['decision and threat model deny automation rendering print delivery and acceptance claims',has(decision,['countsAsRequirementPass=false','Transkripsiyon, yüz tanıma','dış teslimat','NOT_RUN'])&&has(threat,['Otomatik yüz tanıma yanılsaması','Üretilmemiş medya iddiası','Dış teslimat yanılsaması','NOT_RUN'])],
  ['PPK ratchets are exact PASS while requirement remains open',p21.status==='PASS'&&p21.scannedProductionFiles===555&&p21.exactPrivilegedSurfaceCount===873&&p21.exactAllowlistSha256==='843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc'&&p22.status==='PASS'&&p22.scannedProductionFiles===555&&p22.exactCapabilitySurfaceCount===392&&p22.exactCapabilityManifestSha256==='cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'&&scope.validation.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-X',decision:'DEC-235',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,migration102Sha256:sha,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-X-memory-studio-time-capsule-contract.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-X contract: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`33-X contract: PASS (${checks.length}/${checks.length}).`);
