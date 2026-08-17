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
  json('config/34-d-explicit-consent-recording-media-retention-scope.json'),
  json('config/34-d-explicit-consent-recording-media-retention-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  source('packages/domain/src/communication-recording-retention.ts'),
  source('packages/application/src/communication-recording-retention-use-cases.ts'),
  source('packages/repositories/src/communication-recording-retention-repository.ts'),
  source('apps/desktop/src/main/communication-recording-retention-application-adapter.ts'),
  source('apps/desktop/src/main/data-store.ts'),source('apps/desktop/src/main/ipc-integration-policy.ts'),
  source('apps/desktop/src/renderer/CommunicationRecordingRetentionPanel.tsx')
]);
const requirements=['REC-001','REC-002','REC-003','REC-004','REC-005','REC-006','REC-007','REC-008','REC-009','REC-010','REC-011','AUD-COM-004'];
const roadmapItem=roadmap.packages?.find(item=>item.step==='34-D');
const registryItems=requirements.map(id=>registry.requirements?.find(item=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const checks=[
  ['scope inventory roadmap and dependencies are exact',scope.step==='34-D'&&scope.decision==='DEC-241'
    &&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&roadmapItem?.status==='PLANNED'
    &&exact(roadmapItem.dependsOn,['34-C','33-O'])],
  ['registry plan and ledger remain open behind predecessor',registryItems.every(item=>item&&item.status!=='COMPLETE'
    &&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain distinguishes consent metadata from real capture',has(domain,['CommunicationRecordingTruthView',
    'recordingDefaultOff: true','actualAudioCaptureExecuted: false','encryptedMediaVaultConfigured: false',
    'securePhysicalDeletionVerified: false','networkUsedByCurrentImplementation: false'])],
  ['application provides governed consent and retention lifecycle',has(application,['CreateCommunicationRecordingRequestUseCase',
    'DecideCommunicationRecordingConsentUseCase','WithdrawCommunicationRecordingConsentUseCase',
    'AddCommunicationRecordingLateJoinerUseCase','SetCommunicationRecordingSegmentUseCase',
    'UpdateCommunicationRecordingRetentionUseCase','RequestCommunicationRecordingDeletionUseCase'])],
  ['repository is owner scoped and metadata only',has(repository,['SqliteCommunicationRecordingRepository',
    'communication_recording_mutations','communication_recording_requests','communication_recording_consents',
    'family_id=? AND owner_person_id=?','resolvePolicyResource'])&&!repository.includes('media_plaintext')
    &&!repository.includes('transcript_text')&&!repository.includes('media_path')],
  ['desktop composes central Life PEP and content-free audit',has(adapter,['RepositoryBackedCommunicationRecordingUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])&&has(dataStore,[
    'getCommunicationRecordingCenter','createCommunicationRecordingRequest','requestCommunicationRecordingDeletion'])],
  ['IPC exposes eight safe channels',has(ipc,["getCenter:'communicationRecording:getCenter'",
    "createRequest:'communicationRecording:createRequest'","decideConsent:'communicationRecording:decideConsent'",
    "withdrawConsent:'communicationRecording:withdrawConsent'","addLateJoiner:'communicationRecording:addLateJoiner'",
    "setSegment:'communicationRecording:setSegment'","updateRetention:'communicationRecording:updateRetention'",
    "requestDeletion:'communicationRecording:requestDeletion'","channel.startsWith('communicationRecording:')"])],
  ['renderer preserves no-capture truth',has(panel,['CommunicationRecordingRetentionPanel','getCommunicationRecordingCenter',
    'Kırmızı kayıt göstergesi','gerçek capture: hayır','setCommunicationRecordingSegment'])],
  ['production media and legal claims remain false',scope.truth?.productionRecordingProviderConfigured===false
    &&scope.truth?.audioCapturePerformed===false&&scope.truth?.videoCapturePerformed===false
    &&scope.truth?.transcriptCapturePerformed===false&&scope.truth?.translationCapturePerformed===false
    &&scope.truth?.e2eeRecorderRoleBound===false&&scope.truth?.encryptedMediaArtifactCreated===false
    &&scope.truth?.securePhysicalDeletionVerified===false&&scope.truth?.guardianLegalPolicyConfigured===false
    &&scope.truth?.networkUsedByCurrentImplementation===false],
  ['manual evidence receipt and requirement acceptance remain closed',manualNotRun
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['local test and migration ratchets are exact',scope.validation?.targetedTestFileRatchet===5
    &&scope.validation?.targetedTestRatchet===23&&scope.validation?.migrationVersion===108
    &&scope.validation?.migrationSha256==='45f60e7ff16f505386a75a4737d5b6bc4e0bc4c07e4b042594e40418ff20626e'],
  ['PPK ratchets are closed without granting requirement pass',scope.validation?.ppk015?.status==='PASS'
    &&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk022?.status==='PASS'
    &&scope.truth?.callRosterAndActiveRoomMembershipBound===true
    &&scope.validation?.countsAsRequirementPass===false&&inventory.validation?.countsAsRequirementPass===false]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-D',decision:'DEC-241',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  implementationStatus:scope.localImplementationStatus,countsAsRequirementPass:false,checkCount:results.length,
  passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-D-explicit-consent-recording-media-retention-boundary.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-D boundary: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-D boundary: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
