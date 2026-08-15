import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');const text=async path=>readFile(resolve(root,path),'utf8');
const has=(value,markers)=>markers.every(marker=>value.includes(marker));const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const paths={scope:'config/34-f-family-meetings-decisions-consent-minutes-scope.json',
  inventory:'config/34-f-family-meetings-decisions-consent-minutes-inventory.json',
  decision:'docs/decisions/DEC-243-family-meetings-decisions-consent-minutes.md',
  threat:'docs/security/THREAT_MODEL_34_F_FAMILY_MEETINGS_DECISIONS_CONSENT_MINUTES.md',
  domain:'packages/domain/src/family-meeting.ts',contract:'packages/repository-contracts/src/family-meeting-repository.ts',
  application:'packages/application/src/family-meeting-use-cases.ts',repository:'packages/repositories/src/family-meeting-repository.ts',
  adapter:'apps/desktop/src/main/family-meeting-application-adapter.ts',vault:'apps/desktop/src/main/family-meeting-minutes-vault.ts',
  migration:'packages/database/src/family-database-migrations.ts',ipc:'apps/desktop/src/main/ipc-integration-policy.ts',
  lifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',main:'apps/desktop/src/main/main.ts',preload:'apps/desktop/src/main/preload.ts',
  global:'apps/desktop/src/renderer/global.d.ts',panel:'apps/desktop/src/renderer/FamilyMeetingPanel.tsx',
  app:'apps/desktop/src/renderer/App.tsx',package:'package.json'};
const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await text(path)]));const content=Object.fromEntries(entries);
const scope=JSON.parse(content.scope);const inventory=JSON.parse(content.inventory);const pkg=JSON.parse(content.package);
const checks=[
  ['governance identities and no-pass truth are exact',scope.step==='34-F'&&scope.decision==='DEC-243'&&inventory.step==='34-F'
    &&scope.status==='PLANNED'&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['domain publishes safe views and false provider truth',has(content.domain,['FamilyMeetingCenterView','FamilyMeetingMinutesContentView',
    'FamilyMeetingMutationReceiptView','productionAiMinutesProviderConfigured: false','networkUsedByCurrentImplementation: false'])],
  ['repository contract exposes exact governed persistence and payload-free resolution',has(content.contract,[
    'FamilyMeetingRepositoryPort','FamilyMeetingPolicyResourceRepositoryPort','resolvePolicyResource','insertMutation',
    'insertVote','insertDecision','upsertTask','upsertMinutes','appendEvent'])],
  ['application requires recording consent and explicit human approval',has(content.application,['FamilyMeetingRecordingConsentPort',
    'FamilyMeetingAiMinutesProviderPort','explicitHumanApproval!==true','provider.configured','networkUsed:false','cloudUsed:false'])],
  ['migration 110 owns eleven tables and immutable ledgers',has(content.migration,["createMigrationDefinition(110, 'family_meetings_decisions_consent_minutes'",
    'CREATE TABLE family_meeting_mutations','CREATE TABLE family_meetings','CREATE TABLE family_meeting_participants',
    'CREATE TABLE family_meeting_agenda_items','CREATE TABLE family_meeting_polls','CREATE TABLE family_meeting_votes',
    'CREATE TABLE family_meeting_decisions','CREATE TABLE family_meeting_tasks','CREATE TABLE family_meeting_collaboration_items',
    'CREATE TABLE family_meeting_minutes','CREATE TABLE family_meeting_events','34-F decision ledger is immutable'])],
  ['migration forces local-only minutes and exact consent/provider states',has(content.migration,[
    'network_used INTEGER NOT NULL CHECK(network_used=0)','cloud_used INTEGER NOT NULL CHECK(cloud_used=0)',
    "provider_id='protected-side-artifact-store-v1'",'transcript_consent_verified=1','human_approval_recorded=1'])],
  ['repository and adapter require central policy context',has(content.repository,['assertPolicyAuthorizedRepositoryContext',
    'platformPolicyPersistenceBinding','family_id=? AND owner_person_id=?'])&&has(content.adapter,[
    'RepositoryBackedLifePolicyTransactionRunner','RepositoryBackedFamilyMeetingUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['minutes vault is bounded encrypted and no-overwrite',has(content.vault,['FamilyMeetingMinutesVault','MAX_FILES = 4_096',
    'MAX_TOTAL_BYTES = 512 * 1024 * 1024','MAX_PLAINTEXT_BYTES = 512 * 1024','protectedStore.sealBuffer',
    'Family meeting minutes no-overwrite conflict','networkUsed: false','cloudUsed: false'])],
  ['IPC lifecycle bridge and preload expose fourteen bounded channels',has(content.ipc,['familyMeeting:getCenter','familyMeeting:getMinutes',
    'familyMeeting:create','familyMeeting:castVote','familyMeeting:recordDecision','familyMeeting:prepareAiMinutes','familyMeeting:finalizeMinutes'])
    &&has(content.lifecycle,['familyMeetingReadChannels','familyMeetingWriteChannels'])
    &&has(content.main,['getFamilyMeetingCenter','finalizeFamilyMeetingMinutes'])
    &&has(content.preload,['getFamilyMeetingCenter','finalizeFamilyMeetingMinutes'])
    &&has(content.global,['FamilyMeetingCenterIpcView','finalizeFamilyMeetingMinutes'])],
  ['renderer reuses Life center and every safe bridge',has(content.panel,['FamilyMeetingPanel','createFamilyMeeting',
    'castFamilyMeetingVote','recordFamilyMeetingDecision','prepareFamilyMeetingAiMinutes','finalizeFamilyMeetingMinutes'])
    &&has(content.app,['<FamilyMeetingPanel people={snapshot.people}/>'])],
  ['documents preserve fail-honest residuals',has(content.decision,['countsAsRequirementPass=false','Production AI provider','NOT_RUN'])
    &&has(content.threat,['Plaintext sızıntısı','Sahte AI başarısı','Kalıcı kota DoS'])],
  ['targeted package command is exact',pkg.scripts?.['verify:34-f:targeted']===
    'vitest run packages/application/tests/family-meeting-use-cases.test.ts packages/repositories/family-meeting-repository-policy.test.ts apps/desktop/tests/family-meeting-minutes-vault.test.ts apps/desktop/tests/family-meeting-data-store.test.ts apps/desktop/tests/family-meeting-ipc-integration.test.ts apps/desktop/tests/family-meeting-ui.test.ts --maxWorkers=1'],
  ['governance verifier commands are wired',pkg.scripts?.['verify:34-f:family-meetings-decisions-consent-minutes:boundary']
    &&pkg.scripts?.['verify:34-f:family-meetings-decisions-consent-minutes:contract']
    &&pkg.scripts?.['verify:34-f:family-meetings-decisions-consent-minutes:runtime']],
  ['migration and PPK ratchets are exact',scope.validation?.migrationSha256==='8bcc5777aa80794122742bcfd73be036234488f5861adbcd34956c56e6d0d6ac'
    &&scope.validation?.ppk015?.status==='PASS'&&scope.validation?.ppk019?.status==='PASS'
    &&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk022?.status==='PASS'],
  ['governance sources are nonempty and uniquely bound',new Set(Object.values(paths)).size===Object.keys(paths).length
    &&Object.values(content).every(value=>value.length>20)&&sha(content.scope)!==sha(content.inventory)]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-F',decision:'DEC-243',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  countsAsRequirementPass:false,checkCount:results.length,passed:results.length-failures.length,failed:failures.length,
  checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-F-family-meetings-decisions-consent-minutes-contract.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-F contract: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-F contract: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
