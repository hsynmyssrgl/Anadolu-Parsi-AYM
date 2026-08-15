import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,adapter,dataStore,ipc,panel]=await Promise.all([
  json('config/33-x-memory-studio-time-capsule-scope.json'),json('config/33-x-memory-studio-time-capsule-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  text('packages/domain/src/memory-studio.ts'),text('packages/application/src/memory-studio-use-cases.ts'),
  text('packages/repositories/src/memory-studio-repository.ts'),text('apps/desktop/src/main/memory-studio-application-adapter.ts'),
  text('apps/desktop/src/main/data-store.ts'),text('apps/desktop/src/main/ipc-integration-policy.ts'),
  text('apps/desktop/src/renderer/MemoryStudioPanel.tsx')
]);
const requirements=['B6-04','EXT-051','EXT-052','EXT-053','EXT-054','EXT-055','EXT-056','EXT-057'];
const dependencies=['33-Q','33-R','33-W'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-X');
const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manual=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['scope inventory roadmap and dependency identities are exact',scope.step==='33-X'&&scope.decision==='DEC-235'&&JSON.stringify(scope.requirements)===JSON.stringify(requirements)&&JSON.stringify(inventory.requirements)===JSON.stringify(requirements)&&roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(dependencies)],
  ['registry plan and ledger remain open behind 33-P',registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain fixes fourteen record kinds and fail-honest truth',has(domain,['MEMORY_STUDIO_RECORD_KINDS','MemoryStudioTruthView','transcriptionPerformed: false','faceRecognitionPerformed: false','duplicateDetectionPerformed: false','externalDeliveryPerformed: \'not_performed\''])],
  ['application exposes exact six governed use cases',has(application,['GetMemoryStudioCenterUseCase','CreateMemoryStudioRecordUseCase','DeleteMemoryStudioRecordUseCase','CreateMemoryTimeCapsuleUseCase','ReviewMemoryTimeCapsuleUseCase','TransitionMemoryTimeCapsuleUseCase'])],
  ['application enforces two approvals seven days and twenty-four-hour rollback',has(application,['minimumApprovals: 2','7 * 86_400_000','new Set(current.value.approvals.map','Date.parse(current.value.releasedAt) + 86_400_000'])],
  ['repository uses exact receipt fence and owner-bound references',has(repository,['writeBinding(context, row)','validateOwnedReferences','resolvePolicyResource','memory_studio_mutations'])],
  ['desktop adapter composes central PEP and transactional audit outbox',has(adapter,['RepositoryBackedMemoryStudioUnitOfWork','RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])],
  ['DataStore composes six safe methods',has(dataStore,['GetMemoryStudioCenterUseCase','CreateMemoryStudioRecordUseCase','DeleteMemoryStudioRecordUseCase','CreateMemoryTimeCapsuleUseCase','ReviewMemoryTimeCapsuleUseCase','TransitionMemoryTimeCapsuleUseCase','getMemoryStudioCenter('])],
  ['IPC exposes exact six bounded channels',has(ipc,["getCenter:'memoryStudio:getCenter'","createRecord:'memoryStudio:createRecord'","deleteRecord:'memoryStudio:deleteRecord'","createCapsule:'memoryStudio:createCapsule'","reviewCapsule:'memoryStudio:reviewCapsule'","transitionCapsule:'memoryStudio:transitionCapsule'"])],
  ['renderer states manual local no-delivery truth',has(panel,['Manuel ve yerel çalışma sınırı','Ses çözümleme, yüz tanıma','Ağ, bulut ve haricî teslimat kullanılmaz','Kişileri otomatik tanıma olmadan elle seçtiğimi onaylıyorum'])],
  ['automation rendering network cloud print and delivery claims stay false',scope.truth?.transcriptionPerformed===false&&scope.truth?.faceRecognitionPerformed===false&&scope.truth?.duplicateDetectionPerformed===false&&scope.truth?.documentaryRendered===false&&scope.truth?.printableBookRendered===false&&scope.truth?.printingPerformed===false&&scope.truth?.networkUsed===false&&scope.truth?.cloudUsed===false&&scope.truth?.externalDeliveryPerformed==='not_performed'],
  ['manual evidence persistent receipt and requirement acceptance remain closed',manual&&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'&&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-X',decision:'DEC-235',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-X-memory-studio-time-capsule-boundary.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-X boundary: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`33-X boundary: PASS (${checks.length}/${checks.length}).`);
