import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const source=async path=>readFile(resolve(root,path),'utf8');
const has=(text,markers)=>markers.every(marker=>text.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,adapter,dataStore,ipc,panel]=await Promise.all([
  json('config/34-c-realtime-calling-media-accessible-ux-scope.json'),
  json('config/34-c-realtime-calling-media-accessible-ux-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  source('packages/domain/src/communication-realtime-calling.ts'),
  source('packages/application/src/communication-realtime-calling-use-cases.ts'),
  source('packages/repositories/src/communication-realtime-calling-repository.ts'),
  source('apps/desktop/src/main/communication-realtime-calling-application-adapter.ts'),
  source('apps/desktop/src/main/data-store.ts'),source('apps/desktop/src/main/ipc-integration-policy.ts'),
  source('apps/desktop/src/renderer/CommunicationRealtimeCallingPanel.tsx')
]);
const requirements=['RTC-001','RTC-002','RTC-003','RTC-004','RTC-005','RTC-006','RTC-007','RTC-008','RTC-009','RTC-010','RTC-011','RTC-012','RTC-013','RTC-014','UX-COM-001','UX-COM-003','UX-COM-004','UX-COM-011','UX-COM-012'];
const roadmapItem=roadmap.packages?.find(item=>item.step==='34-C');
const registryItems=requirements.map(id=>registry.requirements?.find(item=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const checks=[
  ['scope inventory roadmap and dependencies are exact',scope.step==='34-C'&&scope.decision==='DEC-240'
    &&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&roadmapItem?.status==='PLANNED'
    &&exact(roadmapItem.dependsOn,['34-A','34-B','33-M'])],
  ['registry plan and ledger remain open behind predecessor',registryItems.every(item=>item&&item.status!=='COMPLETE'
    &&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain distinguishes local planning from real media',has(domain,['CommunicationRealtimeCallingTruthView',
    'rendererMediaDeviceAuthority: false','productionMediaProviderConfigured: false','webRtcPeerConnectionExecuted: false',
    'realOneToOneCallPerformed: false','networkUsedByCurrentImplementation: false'])],
  ['application provides governed lifecycle and main-only evidence ports',has(application,['CreateCommunicationCallUseCase',
    'RunCommunicationCallPreflightUseCase','UpdateCommunicationCallControlsUseCase','AdvanceCommunicationCallUseCase',
    'SetCommunicationCallPreferencesUseCase','RecordCommunicationCallQualityObservationUseCase','scope.appendAudit','scope.enqueueEvent'])],
  ['repository is owner scoped and metadata only',has(repository,['SqliteCommunicationRealtimeCallingRepository',
    'communication_call_mutations','communication_call_sessions','communication_call_quality_observations','family_id=? AND owner_person_id=?',
    'resolvePolicyResource'])&&!repository.includes('media_plaintext')&&!repository.includes('relay_credential')],
  ['desktop composes central Life PEP and fail-closed preflight',has(adapter,['RepositoryBackedCommunicationRealtimeCallingUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])&&has(dataStore,[
    'communicationCallPreflight:CommunicationCallPreflightPort=options.communicationCallPreflight??','AUTHORIZATION_DENIED','getCommunicationRealtimeCallingCenter',
    'createCommunicationCall','setCommunicationCallPreferences'])],
  ['IPC exposes six safe channels and no quality authority',has(ipc,["getCenter:'communicationCalling:getCenter'",
    "create:'communicationCalling:create'","runPreflight:'communicationCalling:runPreflight'",
    "updateControls:'communicationCalling:updateControls'","advance:'communicationCalling:advance'",
    "setPreferences:'communicationCalling:setPreferences'","channel.startsWith('communicationCalling:')"])
    &&!ipc.includes("communicationCalling:recordQuality")],
  ['renderer reuses existing surface and preserves no-call truth',has(panel,['CommunicationRealtimeCallingPanel',
    'getCommunicationRealtimeCallingCenter','runCommunicationCallPreflight','meetingLocked','pinnedPersonId',
    'signLanguagePinnedPersonId','production ortamında'])],
  ['production media and OS integrations remain explicitly false',scope.truth?.productionMediaProviderConfigured===false
    &&scope.truth?.webRtcPeerConnectionExecuted===false&&scope.truth?.sfuServiceConfigured===false
    &&scope.truth?.stunTurnServiceConfigured===false&&scope.truth?.sframeMediaEncryptionExecuted===false
    &&scope.truth?.screenOrWindowCaptureImplemented===false&&scope.truth?.liveCaptionProviderConfigured===false
    &&scope.truth?.realtimeTextTransportImplemented===false&&scope.truth?.callKitPushKitIntegrated===false
    &&scope.truth?.windowsCallNotificationIntegrated===false&&scope.truth?.networkUsedByCurrentImplementation===false],
  ['retention and host moderation gaps stay explicit',scope.truth?.participantKickImplemented===false
    &&scope.truth?.qualityEvidenceProductionWired===false&&scope.truth?.sessionRetentionPruneImplemented===false
    &&scope.truth?.qualityRetentionPruneImplemented===false],
  ['manual evidence receipt and requirement acceptance remain closed',manualNotRun
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['local ratchet is exact without granting requirement pass',scope.validation?.targetedTestFileRatchet===5
    &&scope.validation?.targetedTestRatchet===23&&scope.validation?.migrationVersion===107
    &&scope.validation?.migrationSha256==='299024d7bd040343717abceb2ada6e543a95bea921c7ee6c7d34a10cf2b6515b'
    &&scope.validation?.ppk015?.files===513&&scope.validation?.ppk015?.sourceSha256==='fc468299263f87c8e1e80f4323fa5465998d2326ceab15281290e313401b9fce'
    &&scope.validation?.ppk021?.surfaces===805&&scope.validation?.ppk021?.sha256==='8a70ce92f886463c2bea5ae997c5956f97cce7dcf17a433587e97f011996e7f6'
    &&scope.validation?.ppk022?.surfaces===360&&scope.validation?.ppk022?.sha256==='755717250f2549229608b38e6ea650a4647f1e0d50aa4c1aa1078acc193302ff'
    &&scope.validation?.countsAsRequirementPass===false&&inventory.validation?.countsAsRequirementPass===false]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-C',decision:'DEC-240',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  implementationStatus:scope.localImplementationStatus,countsAsRequirementPass:false,checkCount:results.length,
  passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-C-realtime-calling-media-accessible-ux-boundary.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-C boundary: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-C boundary: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
