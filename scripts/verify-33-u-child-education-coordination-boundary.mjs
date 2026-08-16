import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const output='artifacts/validation/33-U-child-education-coordination-boundary.json';
const readJson=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const readText=async(path)=>readFile(resolve(root,path),'utf8');
const hasAll=(source,markers)=>markers.every((marker)=>source.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);

const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,dataStore,ipc,panel]=await Promise.all([
  readJson('config/33-u-child-education-coordination-scope.json'),
  readJson('config/33-u-child-education-coordination-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/remaining-scope-package-roadmap.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readText('packages/domain/src/child-education-coordination.ts'),
  readText('packages/application/src/child-education-coordination-use-cases.ts'),
  readText('packages/repositories/src/child-education-coordination-repository.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/renderer/ChildEducationCoordinationPanel.tsx')
]);

const requirements=['EXT-017','EXT-018','EXT-019','EXT-020','EXT-022'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-U');
const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['scope inventory and roadmap identities are exact',scope.step==='33-U'&&scope.decision==='DEC-232'&&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&roadmapItem?.status==='PLANNED'&&exact(roadmapItem.dependsOn,['33-S','33-P'])],
  ['registry plan and ledger remain intentionally open',registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'&&scope.registrySemantics?.registryMutationPerformedByStarter===false],
  ['domain covers four areas fourteen kinds three visibility zones and truth',hasAll(domain,['CHILD_EDUCATION_AREAS','CHILD_EDUCATION_KINDS','CHILD_EDUCATION_VISIBILITIES','ChildEducationCenterView','ChildEducationTruthView'])],
  ['application implements exact four governed use cases',hasAll(application,['GetChildEducationCenterUseCase','CreateChildEducationItemUseCase','UpdateChildEducationItemUseCase','DeleteChildEducationItemUseCase'])],
  ['application enforces age private space kind schema target visibility and local truth',hasAll(application,["visibility !== 'adolescent_private'","input.kind === 'pickup_authority'","input.kind === 'allowance_budget'",'scheduleRequiredKinds','dueRequiredKinds','nextVisibility!==found.value.visibility','pickupCredentialIssuance','allowancePaymentExecution'])],
  ['repository binds child owner policy receipt and bounded result',hasAll(repository,["authorization.purpose!=='general'",'writeBinding(context,row)','LIMIT 1001','exceeds its bounded local result contract'])],
  ['DataStore composes all four use cases and safe public methods',hasAll(dataStore,['GetChildEducationCenterUseCase','CreateChildEducationItemUseCase','UpdateChildEducationItemUseCase','DeleteChildEducationItemUseCase','getChildEducationCenter('])],
  ['IPC exposes exact four channels and mirrors required kind fields',hasAll(ipc,["'childEducation:getCenter'","'childEducation:createItem'","'childEducation:updateItem'","'childEducation:deleteItem'",'childEducationReceiptResult','scheduleRequired','dueRequired',"value.kind === 'class'"])],
  ['renderer extends Life route with required schedule summaries and local-only boundaries',hasAll(panel,['Çocuk eğitim merkezi','adolescent_private','Kimlik Merkezi referansı','okul portalına bağlanmaz','servisi canlı izlemez','itemSummary','scheduleRequired','dueRequired'])],
  ['truth excludes school sync messaging tracking payment credential and AI claims',scope.truth?.schoolPortalSyncPerformed===false&&scope.truth?.teacherMessagingPerformed===false&&scope.truth?.liveTransportTrackingPerformed===false&&scope.truth?.allowancePaymentExecuted===false&&scope.truth?.pickupCredentialIssuedByThisPackage===false&&scope.truth?.aiProcessingAllowed===false&&scope.truth?.externalSharingAllowed===false],
  ['local tests cannot become requirement acceptance',scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['manual evidence certification and persistent receipt remain closed',manualNotRun&&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN']
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-U',decision:'DEC-232',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'});}
if(failures.length){console.error(`33-U boundary: FAIL (${failures.length}/${checks.length}).`);for(const failure of failures)console.error(failure.name);process.exit(1);}
console.log(`33-U boundary: PASS (${checks.length}/${checks.length}).`);
