import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const output='artifacts/validation/33-T-household-operations-center-boundary.json';
const readJson=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const readText=async(path)=>readFile(resolve(root,path),'utf8');
const hasAll=(source,markers)=>markers.every((marker)=>source.includes(marker));

const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,dataStore,ipc,panel]=await Promise.all([
  readJson('config/33-t-household-operations-center-scope.json'),
  readJson('config/33-t-household-operations-center-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readText('packages/domain/src/household-operations.ts'),
  readText('packages/application/src/household-operations-use-cases.ts'),
  readText('packages/repositories/src/household-operations-repository.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/renderer/HouseholdOperationsPanel.tsx')
]);

const requirements=['EXT-001','EXT-002','EXT-003','EXT-004','EXT-005','EXT-006','EXT-007','EXT-008'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-T');
const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['scope inventory and roadmap identities are exact',scope.step==='33-T'&&scope.decision==='DEC-231'&&JSON.stringify(scope.requirements)===JSON.stringify(requirements)&&JSON.stringify(inventory.requirements)===JSON.stringify(requirements)&&roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(['33-N'])],
  ['registry plan and ledger remain intentionally open',registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'&&scope.registrySemantics?.registryMutationPerformedByStarter===false],
  ['domain covers eight areas thirteen kinds views inputs and truth',hasAll(domain,['HOUSEHOLD_OPERATION_AREAS','HOUSEHOLD_OPERATION_KINDS','HouseholdOperationItemView','HouseholdOperationsCenterView','HouseholdOperationsTruthView'])],
  ['application implements exact four governed use cases',hasAll(application,['GetHouseholdOperationsCenterUseCase','CreateHouseholdOperationItemUseCase','UpdateHouseholdOperationItemUseCase','DeleteHouseholdOperationItemUseCase'])],
  ['application enforces recipe allergy and exact expense split semantics',hasAll(application,["input.command.kind === 'meal_plan'",'blocked.has(code)',"input.command.kind === 'shared_expense'",'total === 10_000'])],
  ['repository binds exact family subject purpose receipt and bounded result',hasAll(repository,["authorization.purpose !== 'general'",'writeBinding(context, row)','LIMIT 2001','exceeds its bounded local result contract'])],
  ['DataStore composes all four use cases and safe public methods',hasAll(dataStore,['GetHouseholdOperationsCenterUseCase','CreateHouseholdOperationItemUseCase','UpdateHouseholdOperationItemUseCase','DeleteHouseholdOperationItemUseCase','getHouseholdOperationsCenter()'])],
  ['IPC exposes exact four channels with bounded safe results',hasAll(ipc,["'householdOperations:getCenter'","'householdOperations:createItem'","'householdOperations:updateItem'","'householdOperations:deleteItem'",'householdResult'])],
  ['renderer extends Life route and states local-only limits',hasAll(panel,['Hane operasyonları merkezi','dış sipariş, ödeme, kargo senkronizasyonu','Tam takip numarası ve anahtar kodu saklanmaz','household-area-tabs'])],
  ['truth excludes external order payment carrier access and delivery claims',scope.truth?.externalShoppingOrderPerformed===false&&scope.truth?.paymentExecutionPerformed===false&&scope.truth?.carrierSynchronizationPerformed===false&&scope.truth?.remoteAccessControlPerformed===false&&scope.truth?.petCareDeliveryPerformed===false],
  ['local tests cannot become requirement acceptance',scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['manual evidence certification and persistent receipt remain closed',manualNotRun&&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN']
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-T',decision:'DEC-231',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'});}
if(failures.length){console.error(`33-T boundary: FAIL (${failures.length}/${checks.length}).`);for(const failure of failures)console.error(failure.name);process.exit(1);}
console.log(`33-T boundary: PASS (${checks.length}/${checks.length}).`);
