import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const text=async path=>readFile(resolve(root,path),'utf8');
const has=(value,markers)=>markers.every(marker=>value.includes(marker));
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const paths={
  scope:'config/34-d-explicit-consent-recording-media-retention-scope.json',inventory:'config/34-d-explicit-consent-recording-media-retention-inventory.json',
  decision:'docs/decisions/DEC-241-explicit-consent-recording-media-retention.md',threat:'docs/security/THREAT_MODEL_34_D_EXPLICIT_CONSENT_RECORDING_MEDIA_RETENTION.md',
  domain:'packages/domain/src/communication-recording-retention.ts',contract:'packages/repository-contracts/src/communication-recording-retention-repository.ts',
  application:'packages/application/src/communication-recording-retention-use-cases.ts',repository:'packages/repositories/src/communication-recording-retention-repository.ts',
  adapter:'apps/desktop/src/main/communication-recording-retention-application-adapter.ts',migration:'packages/database/src/family-database-migrations.ts',
  ipc:'apps/desktop/src/main/ipc-integration-policy.ts',lifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',
  main:'apps/desktop/src/main/main.ts',preload:'apps/desktop/src/main/preload.ts',global:'apps/desktop/src/renderer/global.d.ts',
  panel:'apps/desktop/src/renderer/CommunicationRecordingRetentionPanel.tsx',app:'apps/desktop/src/renderer/App.tsx',package:'package.json'
};
const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await text(path)]));
const content=Object.fromEntries(entries);const scope=JSON.parse(content.scope);const inventory=JSON.parse(content.inventory);const pkg=JSON.parse(content.package);
const checks=[
  ['governance identities and no-pass truth are exact',scope.step==='34-D'&&scope.decision==='DEC-241'&&inventory.step==='34-D'
    &&scope.status==='PLANNED'&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['domain contract carries safe views and false production truth',has(content.domain,['CommunicationRecordingCenterView',
    'CommunicationRecordingMutationReceiptView','captureStarted: false','mediaCaptureStarted: false','networkUsed: false'])],
  ['repository contract exposes payload-free policy resolution',has(content.contract,['CommunicationRecordingRepositoryPort',
    'CommunicationRecordingPolicyResourceRepositoryPort','resolvePolicyResource','insertMutation','saveRequest','appendSegment'])],
  ['application keeps capture and artifact truth false',has(content.application,['mediaCaptureStarted: false','mediaArtifactCreated: false',
    'networkUsed: false','DecideCommunicationRecordingConsentUseCase','RequestCommunicationRecordingDeletionUseCase'])],
  ['migration 108 owns six tables and immutable ledgers',has(content.migration,["createMigrationDefinition(108, 'explicit_consent_recording_media_retention'",
    'CREATE TABLE communication_recording_mutations','CREATE TABLE communication_recording_requests','CREATE TABLE communication_recording_consents',
    'CREATE TABLE communication_recording_retention','CREATE TABLE communication_recording_segments','CREATE TABLE communication_recording_events',
    '34-D recording mutation ledger is immutable','34-D participant consent history is durable','34-D recording segments are immutable'])],
  ['migration default-off and no-capture checks are exact',has(content.migration,['guardian_policy_verified INTEGER NOT NULL CHECK(guardian_policy_verified=0)',
    'capture_started INTEGER NOT NULL CHECK(capture_started=0)','transcript_persisted INTEGER NOT NULL CHECK(transcript_persisted=0)',
    'translation_persisted INTEGER NOT NULL CHECK(translation_persisted=0)'])],
  ['repository and adapter require central policy context',has(content.repository,['assertPolicyAuthorizedRepositoryContext',
    'platformPolicyPersistenceBinding','family_id=? AND owner_person_id=?'])&&has(content.adapter,['RepositoryBackedLifePolicyTransactionRunner',
    'RepositoryBackedCommunicationRecordingUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['IPC lifecycle bridge and preload expose eight bounded channels',has(content.ipc,['communicationRecording:getCenter',
    'communicationRecording:createRequest','communicationRecording:decideConsent','communicationRecording:withdrawConsent',
    'communicationRecording:addLateJoiner','communicationRecording:setSegment','communicationRecording:updateRetention','communicationRecording:requestDeletion'])
    &&has(content.lifecycle,['communicationRecordingReadChannels','communicationRecordingWriteChannels'])
    &&has(content.main,['getCommunicationRecordingCenter','requestCommunicationRecordingDeletion'])
    &&has(content.preload,['getCommunicationRecordingCenter','requestCommunicationRecordingDeletion'])
    &&has(content.global,['CommunicationRecordingMutationReceiptView','requestCommunicationRecordingDeletion'])],
  ['renderer reuses App surface without new route',has(content.panel,['CommunicationRecordingRetentionPanel','gerçek capture: hayır',
    'recording-indicator--inactive'])&&has(content.app,['<CommunicationRecordingRetentionPanel/>'])],
  ['governance documents preserve fail-honest residuals',has(content.decision,['countsAsRequirementPass=false','Gerçek ses/video yakalama',
    'E2EE recorder','NOT_RUN'])&&has(content.threat,['Renderer medya yakalama','fiziksel silme','guardian/legal policy'])],
  ['targeted package command is exact',pkg.scripts?.['verify:34-d:targeted']===
    'vitest run packages/application/tests/communication-recording-retention-use-cases.test.ts packages/repositories/communication-recording-retention-repository-policy.test.ts apps/desktop/tests/communication-recording-retention-data-store.test.ts apps/desktop/tests/communication-recording-retention-ipc-integration.test.ts apps/desktop/tests/communication-recording-retention-ui.test.ts --maxWorkers=1'],
  ['governance verifier commands are wired',pkg.scripts?.['verify:34-d:explicit-consent-recording-media-retention:boundary']
    &&pkg.scripts?.['verify:34-d:explicit-consent-recording-media-retention:contract']&&pkg.scripts?.['verify:34-d:explicit-consent-recording-media-retention:runtime']],
  ['migration and PPK ratchets are exact',scope.validation?.migrationSha256==='45f60e7ff16f505386a75a4737d5b6bc4e0bc4c07e4b042594e40418ff20626e'
    &&scope.validation?.ppk015?.status==='PASS'&&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk022?.status==='PASS'],
  ['governance sources are nonempty and uniquely bound',new Set(Object.values(paths)).size===Object.keys(paths).length
    &&Object.values(content).every(value=>value.length>20)&&sha(content.scope)!==sha(content.inventory)]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-D',decision:'DEC-241',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  countsAsRequirementPass:false,checkCount:results.length,passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-D-explicit-consent-recording-media-retention-contract.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-D contract: FAIL (${failures.length}/${results.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-D contract: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
