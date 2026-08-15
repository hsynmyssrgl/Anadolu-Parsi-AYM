import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async path=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every(marker=>source.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,vault,adapter,dataStore,ipc,panel]=await Promise.all([
  json('config/34-b-communication-messaging-lifecycle-privacy-presence-scope.json'),
  json('config/34-b-communication-messaging-lifecycle-privacy-presence-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  text('packages/domain/src/communication-messaging.ts'),text('packages/application/src/communication-messaging-use-cases.ts'),
  text('packages/repositories/src/communication-messaging-repository.ts'),
  text('apps/desktop/src/main/communication-message-payload-vault.ts'),
  text('apps/desktop/src/main/communication-messaging-application-adapter.ts'),text('apps/desktop/src/main/data-store.ts'),
  text('apps/desktop/src/main/ipc-integration-policy.ts'),text('apps/desktop/src/renderer/CommunicationMessagingPanel.tsx')
]);
const requirements=['COM-003','COM-004','COM-005','COM-006','COM-007','COM-008','COM-009','COM-010','PRS-001','PRS-002','PRS-003','PRS-004','PRS-005','PRS-006'];
const roadmapItem=roadmap.packages?.find(item=>item.step==='34-B');
const registryItems=requirements.map(id=>registry.requirements?.find(item=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed')
  .every(([,value])=>value==='NOT_RUN');
const checks=[
  ['scope inventory roadmap and dependencies are exact',scope.step==='34-B'&&scope.decision==='DEC-239'
    &&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&roadmapItem?.status==='PLANNED'
    &&exact(roadmapItem.dependsOn,['34-A','33-N'])],
  ['registry plan and ledger stay open behind the active predecessor',registryItems.every(item=>item&&item.status!=='COMPLETE'
    &&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain fixes message presence retention and no-claim truth',has(domain,['COMMUNICATION_MESSAGE_CONTENT_KINDS',"'document'",
    'CommunicationMessagingCenterView','CommunicationMessagingMutationReceiptView','contentSearchImplemented: false',
    'relayDeliveryImplemented: false','networkUsedByCurrentImplementation: false'])],
  ['application implements governed lifecycle with idempotency audit and outbox',has(application,['CreateCommunicationMessageUseCase',
    'EditCommunicationMessageUseCase','SetCommunicationMessageLifecycleUseCase','AnnotateCommunicationMessageUseCase',
    'UpdateCommunicationDeliveryUseCase','SetCommunicationPresenceUseCase','SetCommunicationRetentionPolicyUseCase',
    'findMutation(command.clientOperationId)','scope.appendAudit','scope.enqueueEvent'])],
  ['repository is owner scoped and payload free outside sealed metadata',has(repository,['assertPolicyAuthorizedRepositoryContext',
    'communication_messaging_mutations','communication_message_events','family_id=? AND owner_person_id=?','resolvePolicyResource'])
    &&!repository.includes('message_plaintext')],
  ['protected payload vault enforces no overwrite identity readback and zeroization',has(vault,['ProtectedSideArtifactStore',
    "openSync(temporary, 'wx', 0o600)",'linkSync(temporary, target)','stat.nlink !== 1','opened.dev !== stat.dev',
    'readback.equals(plaintext)','plaintext.fill(0)','networkUsed: false','cloudUsed: false'])],
  ['desktop composes central Life PEP repository and fail-closed payload authority',has(adapter,['RepositoryBackedCommunicationMessagingUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])&&has(dataStore,[
    'communicationMessagePayloadPath','CommunicationMessagePayloadVault','Protected communication message payload provider is unavailable.',
    'getCommunicationMessagingCenter','createCommunicationMessage','setCommunicationRetentionPolicy'])],
  ['IPC exposes exact ten channels and rejects renderer attachment authority',has(ipc,["getCenter:'communicationMessaging:getCenter'",
    "search:'communicationMessaging:search'","getContent:'communicationMessaging:getContent'","create:'communicationMessaging:create'",
    "edit:'communicationMessaging:edit'","setLifecycle:'communicationMessaging:setLifecycle'","annotate:'communicationMessaging:annotate'",
    "updateDelivery:'communicationMessaging:updateDelivery'","setPresence:'communicationMessaging:setPresence'",
    "setRetentionPolicy:'communicationMessaging:setRetentionPolicy'","candidate.contentKind==='text'",
    "channel.startsWith('communicationMessaging:')"])],
  ['renderer reuses system screen and states local-only limits',has(panel,['CommunicationMessagingPanel','Bu sürüm yalnız yerel ve ağsız çalışır.',
    'İçeriği açıkça göster','Relay teslimi','fiziksel güvenli silme','Medya eki için main-issued güvenli seçim akışı henüz yoktur.'])],
  ['incomplete capabilities remain explicitly false',scope.truth?.fullContentSearchImplemented===false
    &&scope.truth?.rendererMediaAttachmentSelectionImplemented===false&&scope.truth?.reminderExecutionImplemented===false
    &&scope.truth?.remoteRelayDeliveryImplemented===false&&scope.truth?.realMessageExchangePerformed===false
    &&scope.truth?.multiDevicePresenceAggregationImplemented===false&&scope.truth?.automaticRetentionExecutionImplemented===false
    &&scope.truth?.physicalSecureEraseGuaranteed===false&&scope.truth?.backupDeletionPropagationGuaranteed===false
    &&scope.truth?.networkUsedByCurrentImplementation===false],
  ['manual evidence receipt and requirement acceptance remain closed',manualNotRun
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false
    &&inventory.countsAsRequirementPass===false],
  ['local ratchet is exact without granting requirement pass',scope.validation?.targetedTestFileRatchet===5
    &&scope.validation?.targetedTestRatchet===25&&scope.validation?.migrationVersion===106
    &&scope.validation?.migrationSha256==='5b088bb6d759403044f84ad9f2a82be1823e33a17334d7122beed92af56cce50'
    &&scope.validation?.ppk015?.status==='PASS'&&scope.validation?.ppk015?.files===507
    &&scope.validation?.ppk015?.sourceSha256==='12c286d45487c5e498768b396616b3ed7b0ca858a121c012f0db6620f3f709c8'
    &&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk021?.surfaces===795
    &&scope.validation?.ppk021?.sha256==='d674ad587c9cad96def3d087a86d176aa9dedc9ac69d2c3b0e71cc02cd787348'
    &&scope.validation?.ppk022?.status==='PASS'&&scope.validation?.ppk022?.surfaces===360
    &&scope.validation?.ppk022?.sha256==='b4b2f09c461235528f98c3f4b942e28a9e3068c71de5697fe116e4b57f54c77c'
    &&scope.validation?.countsAsRequirementPass===false&&inventory.validation?.countsAsRequirementPass===false]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-B',decision:'DEC-239',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  implementationStatus:scope.localImplementationStatus,countsAsRequirementPass:false,checkCount:results.length,
  passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-B-communication-messaging-lifecycle-privacy-presence-boundary.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-B boundary: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-B boundary: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
