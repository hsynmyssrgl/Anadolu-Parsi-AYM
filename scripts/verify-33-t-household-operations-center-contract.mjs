import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const output='artifacts/validation/33-T-household-operations-center-contract.json';
const readJson=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const readText=async(path)=>readFile(resolve(root,path),'utf8');
const hasAll=(source,markers)=>markers.every((marker)=>source.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

const [scope,inventory,migrationManifest,migrations,contract,repository,adapter,runtime,main,preload,globalTypes,decision,threat,appTest,repositoryTest,ipcTest,dataStoreTest,uiTest]=await Promise.all([
  readJson('config/33-t-household-operations-center-scope.json'),readJson('config/33-t-household-operations-center-inventory.json'),readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  readText('packages/database/src/family-database-migrations.ts'),readText('packages/repository-contracts/src/household-operations-repository.ts'),readText('packages/repositories/src/household-operations-repository.ts'),
  readText('apps/desktop/src/main/household-operations-application-adapter.ts'),readText('apps/desktop/src/main/life-production-policy-runtime.ts'),readText('apps/desktop/src/main/main.ts'),readText('apps/desktop/src/main/preload.ts'),readText('apps/desktop/src/renderer/global.d.ts'),
  readText('docs/decisions/DEC-231-household-operations-center.md'),readText('docs/security/THREAT_MODEL_33_T_HOUSEHOLD_OPERATIONS_CENTER.md'),
  readText('packages/application/tests/household-operations-use-cases.test.ts'),readText('packages/repositories/household-operations-repository-policy.test.ts'),readText('apps/desktop/tests/household-operations-ipc-integration.test.ts'),readText('apps/desktop/tests/household-operations-data-store.test.ts'),readText('apps/desktop/tests/household-operations-ui.test.ts')
]);
const migrationMatch=migrations.match(/const householdOperationsCenterSql = `([\s\S]*?)`;\r?\n/u);
const migrationSha256=migrationMatch?createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex'):'';
const migration98=migrationManifest.migrationVersions?.find((item)=>item.version===98);
const testFiles=scope.validation?.targetedTestFiles??[];
const definitions=[
  ['scope inventory and five-test matrix are exact',exact(scope.requirements,inventory.requirements)&&exact(inventory.implementedTargetedTests,testFiles)&&testFiles.length===5&&scope.validation?.targetedTestFileRatchet===5&&scope.validation?.targetedTestRatchet===22],
  ['migration 98 source manifest and scope checksums are canonical',migration98?.name==='household_operations_center'&&migration98?.checksum===migrationSha256&&migrationSha256===scope.validation?.migrationSha256&&migrationSha256==='b5a09712e4f9611e928509441005ede824a9fceb516caa3b3d74cf83dc8f4d60'],
  ['migration owns exact current item and immutable mutation tables',hasAll(migrations,['household_operation_mutations','household_operations_centers','household_operation_items','trg_33t_household_mutation_delete'])],
  ['repository contract exposes center item mutation and policy resolution ports',hasAll(contract,['loadCenter','findMutationByClientOperationId','insertItem','saveItem','findItemForPolicyResolution'])],
  ['repository enforces exact receipt subject purpose and bounded lists',hasAll(repository,["authorization.purpose !== 'general'",'writeBinding(context, row)','LIMIT 2001','findItemForPolicyResolution'])],
  ['desktop adapter persists receipt time and content-free audit outbox transactionally',hasAll(adapter,['RepositoryBackedHouseholdOperationsUnitOfWork','auditRepository.append','outboxRepository.enqueue','occurredAt'])],
  ['production policy runtime binds collection create replay and exact existing item metadata',hasAll(runtime,["resourceType === 'household_operation_item'","'household_operation_item','child_education_item'",'existing.value.stateFingerprint',"sensitivity: requestedIntent.resourceType === 'household_operations_center'"])],
  ['main preload and renderer types expose only four safe methods',hasAll(main,['HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter','HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem','HOUSEHOLD_OPERATIONS_IPC_CHANNELS.updateItem','HOUSEHOLD_OPERATIONS_IPC_CHANNELS.deleteItem'])&&hasAll(preload,['getHouseholdOperationsCenter','createHouseholdOperationItem','updateHouseholdOperationItem','deleteHouseholdOperationItem'])&&hasAll(globalTypes,['getHouseholdOperationsCenter','createHouseholdOperationItem','updateHouseholdOperationItem','deleteHouseholdOperationItem'])],
  ['application tests cover replay mismatch allergy split and soft delete',hasAll(appTest,['replays without duplicate writes','allergens','complete distinct-person split','soft-deletes'])],
  ['repository tests cover forged receipt invariants and immutability',hasAll(repositoryTest,['forged owner and family','parent, area and family-member split','physically immutable','payload-free metadata'])],
  ['IPC tests reject renderer authority and unsafe result shapes',hasAll(ipcTest,['rejects renderer authority','fullTrackingId','safe results','serializes durable writes'])],
  ['DataStore tests prove PEP fail closed replay filter and full rollback',hasAll(dataStoreTest,['fails closed before reads or writes','replays','atomically rolls back','event_outbox'])],
  ['UI test pins existing route stable retry and local truth boundaries',hasAll(uiTest,['without adding a competing menu route','stable retry identities','minimum-necessary and bounded','external-action limits'])],
  ['decision and threat model deny external order payment access and acceptance claims',hasAll(decision,['countsAsRequirementPass=false','dış alışveriş siparişi vermez','NOT_RUN'])&&hasAll(threat,['Tam takip numarası kabul edilmez','ödeme hesabı','certification'])],
  ['PPK ratchets are exact while requirement remains open',scope.validation?.ppk021?.scannedProductionFiles===556&&scope.validation?.ppk021?.exactPrivilegedSurfaceCount===876&&scope.validation?.ppk021?.exactAllowlistSha256==='709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0'&&scope.validation?.ppk022?.scannedProductionFiles===556&&scope.validation?.ppk022?.exactCapabilitySurfaceCount===395&&scope.validation?.ppk022?.exactCapabilityManifestSha256==='a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e'&&scope.validation?.countsAsRequirementPass===false&&inventory.validation?.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-T',decision:'DEC-231',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,migration98Sha256:migrationSha256,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'});}
if(failures.length){console.error(`33-T contract: FAIL (${failures.length}/${checks.length}).`);for(const failure of failures)console.error(failure.name);process.exit(1);}
console.log(`33-T contract: PASS (${checks.length}/${checks.length}).`);
