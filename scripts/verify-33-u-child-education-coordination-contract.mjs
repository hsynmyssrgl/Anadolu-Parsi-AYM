import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const output='artifacts/validation/33-U-child-education-coordination-contract.json';
const readJson=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const readText=async(path)=>readFile(resolve(root,path),'utf8');
const hasAll=(source,markers)=>markers.every((marker)=>source.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

const [scope,inventory,migrationManifest,migrations,contract,repository,adapter,runtime,main,preload,globalTypes,decision,threat,appTest,repositoryTest,ipcTest,dataStoreTest,uiTest]=await Promise.all([
  readJson('config/33-u-child-education-coordination-scope.json'),readJson('config/33-u-child-education-coordination-inventory.json'),readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  readText('packages/database/src/family-database-migrations.ts'),readText('packages/repository-contracts/src/child-education-coordination-repository.ts'),readText('packages/repositories/src/child-education-coordination-repository.ts'),
  readText('apps/desktop/src/main/child-education-coordination-application-adapter.ts'),readText('apps/desktop/src/main/life-production-policy-runtime.ts'),readText('apps/desktop/src/main/main.ts'),readText('apps/desktop/src/main/preload.ts'),readText('apps/desktop/src/renderer/global.d.ts'),
  readText('docs/decisions/DEC-232-child-education-coordination.md'),readText('docs/security/THREAT_MODEL_33_U_CHILD_EDUCATION_COORDINATION.md'),
  readText('packages/application/tests/child-education-coordination-use-cases.test.ts'),readText('packages/repositories/child-education-coordination-repository-policy.test.ts'),readText('apps/desktop/tests/child-education-coordination-ipc-integration.test.ts'),readText('apps/desktop/tests/child-education-coordination-data-store.test.ts'),readText('apps/desktop/tests/child-education-coordination-ui.test.ts')
]);
const migrationMatch=migrations.match(/const childEducationCoordinationSql = `([\s\S]*?)`;\r?\n/u);
const migrationSha256=migrationMatch?createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex'):'';
const migration99=migrationManifest.migrationVersions?.find((item)=>item.version===99);
const testFiles=scope.validation?.targetedTestFiles??[];
const definitions=[
  ['scope inventory and five-test matrix are exact',exact(scope.requirements,inventory.requirements)&&exact(inventory.implementedTargetedTests,testFiles)&&testFiles.length===5&&scope.validation?.targetedTestFileRatchet===5&&scope.validation?.targetedTestRatchet===22],
  ['migration 99 source manifest and scope checksums are canonical',migration99?.name==='child_education_coordination'&&migration99?.checksum===migrationSha256&&migrationSha256===scope.validation?.migrationSha256&&migrationSha256==='9eb3952ac53f823ae6d12aae09d41748a6a445cd9d4dce11df9d3a47b58a8e25'],
  ['migration owns immutable ledgers and exact required kind fields',hasAll(migrations,['child_education_mutations','child_education_items','trg_33u_child_education_item_delete','trg_33u_child_education_mutation_delete',"(kind='class') = (class_label IS NOT NULL)","kind NOT IN ('homework','pickup_authority') OR due_at IS NOT NULL"])],
  ['repository contract exposes center item mutation and policy resolution ports',hasAll(contract,['loadCenter','findMutationByClientOperationId','insertItem','saveItem','findItemForPolicyResolution'])],
  ['repository enforces exact receipt subject purpose and bounded lists',hasAll(repository,["authorization.purpose!=='general'",'writeBinding(context,row)','LIMIT 1001','findItemForPolicyResolution'])],
  ['desktop adapter persists receipt time and content-free audit outbox transactionally',hasAll(adapter,['RepositoryBackedChildEducationCoordinationUnitOfWork','auditRepository.append','outboxRepository.enqueue','occurredAt'])],
  ['production policy runtime binds child classified owner and adolescent privacy',hasAll(runtime,["resourceType === 'child_education_item'",'ownerPersonId: found.value.childPersonId','childEducationVisibilityPrivacy',"dataClasses: Object.freeze(['child'] as const)"])],
  ['main preload and renderer types expose only four safe methods',hasAll(main,['CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter','CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem','CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.updateItem','CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.deleteItem'])&&hasAll(preload,['getChildEducationCenter','createChildEducationItem','updateChildEducationItem','deleteChildEducationItem'])&&hasAll(globalTypes,['getChildEducationCenter','createChildEducationItem','updateChildEducationItem','deleteChildEducationItem'])],
  ['application tests cover replay private-space required fields target visibility update and delete',hasAll(appTest,['replays exact input','teen-owned private','under-13 child','operation-class-no-label','operation-pickup-no-window','operation-goal-selected-visibility','content-minimizes deletion'])],
  ['repository tests cover forged scope required class label immutable ledger and bounded metadata',hasAll(repositoryTest,['rejects forged owner','guardian forging an adolescent-private','class-no-label-33-u','immutable physical ledgers','payload-free metadata'])],
  ['IPC tests reject renderer authority incomplete kind fields and unsafe results',hasAll(ipcTest,['rejects renderer authority','rejects authority, AI, sharing','operation-child-incomplete-','unknown channels','serializes durable writes'])],
  ['DataStore tests prove PEP fail closed all fourteen kinds privacy and rollback',hasAll(dataStoreTest,['fails closed before child reads','upsertPermission','adolescent_private','operation-class-coverage-33-u','operation-goal-coverage-33-u','count:14','atomically rolls back','event_outbox'])],
  ['UI test pins existing route required kind summaries age privacy and local truth',hasAll(uiTest,['existing Life route','stable retry identities','age-aware privacy',"kind!=='class'||classLabel.trim().length>0",'entry.progressBasisPoints','local-only boundaries'])],
  ['decision and threat model deny external provider payment tracking and acceptance claims',hasAll(decision,['countsAsRequirementPass=false','okul portalına bağlanmaz','NOT_RUN'])&&hasAll(threat,['canlı servis takibi','ödeme yürütme','NOT_RUN'])],
  ['PPK ratchets are exact while requirement remains open',scope.validation?.ppk021?.scannedProductionFiles===568&&scope.validation?.ppk021?.exactPrivilegedSurfaceCount===889&&scope.validation?.ppk021?.exactAllowlistSha256==='3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd'&&scope.validation?.ppk022?.scannedProductionFiles===568&&scope.validation?.ppk022?.exactCapabilitySurfaceCount===428&&scope.validation?.ppk022?.exactCapabilityManifestSha256==='1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1'&&scope.validation?.countsAsRequirementPass===false&&inventory.validation?.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-U',decision:'DEC-232',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,migration99Sha256:migrationSha256,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'});}
if(failures.length){console.error(`33-U contract: FAIL (${failures.length}/${checks.length}).`);for(const failure of failures)console.error(failure.name);process.exit(1);}
console.log(`33-U contract: PASS (${checks.length}/${checks.length}).`);
