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
    'CommunicationMessagingCenterView','CommunicationMessagingMutationReceiptView','contentSearchImplemented: true',
    'rendererMediaAttachmentSelectionImplemented: true','effectivePresenceExpiryEnforced: true',
    'automaticRetentionExecutionImplemented: true','payloadOrphanSweepImplemented: true',
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
    'readback.equals(plaintext)','plaintext.fill(0)','sweepOrphans','recoverInterruptedPublications',
    'networkUsed: false','cloudUsed: false'])],
  ['desktop composes central Life PEP repository and fail-closed payload authority',has(adapter,['RepositoryBackedCommunicationMessagingUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])&&has(dataStore,[
    'communicationMessagePayloadPath','CommunicationMessagePayloadVault','Protected communication message payload provider is unavailable.',
    'getCommunicationMessagingCenter','createCommunicationMessage','setCommunicationRetentionPolicy',
    'maintainCommunicationMessagingLifecycle'])],
  ['IPC exposes exact ten channels and revalidates bounded attachment identifiers',has(ipc,["getCenter:'communicationMessaging:getCenter'",
    "search:'communicationMessaging:search'","getContent:'communicationMessaging:getContent'","create:'communicationMessaging:create'",
    "edit:'communicationMessaging:edit'","setLifecycle:'communicationMessaging:setLifecycle'","annotate:'communicationMessaging:annotate'",
    "updateDelivery:'communicationMessaging:updateDelivery'","setPresence:'communicationMessaging:setPresence'",
    "setRetentionPolicy:'communicationMessaging:setRetentionPolicy'","candidate.contentKind==='location'",
    'communicationIdentifier(candidate.opaqueAttachmentHandle)',
    "channel.startsWith('communicationMessaging:')"])],
  ['renderer reuses system screen and states local-only limits',has(panel,['CommunicationMessagingPanel','Bu sürüm yalnız yerel ve ağsız çalışır.',
    'İçeriği açıkça göster','Relay teslimi','fiziksel güvenli silme','Ana süreçte dosya seç ve şifrele',
    'Yetkili yerel aramayı uygula'])],
  ['implemented local capabilities and remaining no-claims stay exact',scope.truth?.fullContentSearchImplemented===true
    &&scope.truth?.rendererMediaAttachmentSelectionImplemented===true&&scope.truth?.automaticPresenceExpiryExecutionImplemented===true
    &&scope.truth?.automaticRetentionExecutionImplemented===true&&scope.truth?.payloadOrphanSweepImplemented===true
    &&scope.truth?.reminderExecutionImplemented===true
    &&scope.truth?.remoteRelayDeliveryImplemented===false&&scope.truth?.realMessageExchangePerformed===false
    &&scope.truth?.multiDevicePresenceAggregationImplemented===false&&scope.truth?.selectedPeopleAudienceEnforcementImplemented===false
    &&scope.truth?.physicalSecureEraseGuaranteed===false&&scope.truth?.backupDeletionPropagationGuaranteed===false
    &&scope.truth?.networkUsedByCurrentImplementation===false],
  ['manual evidence receipt and requirement acceptance remain closed',manualNotRun
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false
    &&inventory.countsAsRequirementPass===false],
  ['local ratchet is exact without granting requirement pass',scope.validation?.targetedTestFileRatchet===5
    &&scope.validation?.targetedTestRatchet===30&&scope.validation?.migrationVersion===117
    &&scope.validation?.migrationSha256==='9602df3d935441f033eb45d89d7403e09d8dbed3849873cfe68a098ff754dde3'
    &&scope.validation?.ppk015?.status==='PASS'&&scope.validation?.ppk015?.files===588
    &&scope.validation?.ppk015?.sourceSha256==='e83ccc2f1c9eaec4848ce47135f666c17cad167e51c7d678006ab93972c34a21'
    &&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk021?.surfaces===895
    &&scope.validation?.ppk021?.sha256==='fad3ceeb9485bffc9d6f9878f7bb486f56a73b4aa5d045580471c70a49e59da6'
    &&scope.validation?.ppk022?.status==='PASS'&&scope.validation?.ppk022?.surfaces===447
    &&scope.validation?.ppk022?.sha256==='2ac32190c1b40c455093841eb2456c06a168c9aaf519068a14f570705b8a177a'
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
