import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const source=async path=>readFile(resolve(root,path),'utf8');
const has=(text,markers)=>markers.every(marker=>text.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,adapter,vault,dataStore,ipc,panel]=await Promise.all([
  json('config/34-f-family-meetings-decisions-consent-minutes-scope.json'),
  json('config/34-f-family-meetings-decisions-consent-minutes-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  source('packages/domain/src/family-meeting.ts'),source('packages/application/src/family-meeting-use-cases.ts'),
  source('packages/repositories/src/family-meeting-repository.ts'),
  source('apps/desktop/src/main/family-meeting-application-adapter.ts'),
  source('apps/desktop/src/main/family-meeting-minutes-vault.ts'),source('apps/desktop/src/main/data-store.ts'),
  source('apps/desktop/src/main/ipc-integration-policy.ts'),source('apps/desktop/src/renderer/FamilyMeetingPanel.tsx')
]);
const requirements=['MTG-001','MTG-002','MTG-003','MTG-004','MTG-005','MTG-006','MTG-007','MTG-008','MTG-009','MTG-010'];
const roadmapItem=roadmap.packages?.find(item=>item.step==='34-F');
const registryItems=requirements.map(id=>registry.requirements?.find(item=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const checks=[
  ['scope inventory roadmap and dependencies are exact',scope.step==='34-F'&&scope.decision==='DEC-243'
    &&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&roadmapItem?.status==='PLANNED'
    &&exact(roadmapItem.dependsOn,['34-B','34-D','34-E','33-W'])],
  ['registry plan and ledger remain open behind predecessor',registryItems.every(item=>item&&item.status!=='COMPLETE'
    &&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain keeps local-only provider truth explicit',has(domain,['FamilyMeetingTruthView',
    'productionAiMinutesProviderConfigured: false','externalCalendarDeliveryExecuted: false',
    'externalReminderDeliveryExecuted: false','remoteCollaborationExecuted: false','networkUsedByCurrentImplementation: false'])],
  ['application exposes governed meeting lifecycle and consent-bound minutes',has(application,['FamilyMeetingRecordingConsentPort',
    'GetFamilyMeetingCenterUseCase','CreateFamilyMeetingUseCase','CastFamilyMeetingVoteUseCase',
    'RecordFamilyMeetingDecisionUseCase','PrepareFamilyMeetingAiMinutesUseCase','FinalizeFamilyMeetingMinutesUseCase'])],
  ['repository is owner scoped and does not persist minutes plaintext',has(repository,['SqliteFamilyMeetingRepository',
    'family_id=? AND owner_person_id=?','platformPolicyPersistenceBinding','resolvePolicyResource'])
    &&!repository.includes('minutes_text')&&!repository.includes('transcript_text')&&!repository.includes('provider_token')],
  ['desktop composes central Life PEP, recording consent and encrypted vault',has(adapter,['RepositoryBackedFamilyMeetingUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner','RepositoryBackedFamilyMeetingRecordingConsentPort','auditRepository.append','outboxRepository.enqueue'])
    &&has(vault,['FamilyMeetingMinutesVault','ProtectedSideArtifactStore','humanApproved','networkUsed: false','cloudUsed: false'])
    &&has(dataStore,['getFamilyMeetingCenter','prepareFamilyMeetingAiMinutes','finalizeFamilyMeetingMinutes'])],
  ['IPC exposes fourteen safe channels',has(ipc,["getCenter:'familyMeeting:getCenter'","getMinutes:'familyMeeting:getMinutes'",
    "create:'familyMeeting:create'","updatePlan:'familyMeeting:updatePlan'","setState:'familyMeeting:setState'",
    "upsertParticipant:'familyMeeting:upsertParticipant'","upsertAgenda:'familyMeeting:upsertAgenda'",
    "createPoll:'familyMeeting:createPoll'","castVote:'familyMeeting:castVote'","recordDecision:'familyMeeting:recordDecision'",
    "upsertTask:'familyMeeting:upsertTask'","addCollaboration:'familyMeeting:addCollaboration'",
    "prepareAiMinutes:'familyMeeting:prepareAiMinutes'","finalizeMinutes:'familyMeeting:finalizeMinutes'"])],
  ['renderer preserves retry identity and has no provider or network authority',has(panel,['FamilyMeetingPanel','pending.current.get(key)',
    'pending.current.delete(key)','prepareFamilyMeetingAiMinutes','explicitHumanApproval'])
    &&!panel.includes('fetch(')&&!panel.includes('FamilyMeetingAiMinutesProviderPort')],
  ['production external execution claims remain false',scope.truth?.productionAiMinutesProviderConfigured===false
    &&scope.truth?.aiSuggestionGeneratedByCurrentImplementation===false&&scope.truth?.externalCalendarIntegrated===false
    &&scope.truth?.externalReminderDelivered===false&&scope.truth?.remoteCollaborationExecuted===false
    &&scope.truth?.externalDocumentUploaded===false&&scope.truth?.networkUsedByCurrentImplementation===false
    &&scope.truth?.cloudUsedByCurrentImplementation===false],
  ['manual evidence receipt and requirement acceptance remain closed',manualNotRun
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['local test and migration ratchets are exact',scope.validation?.targetedTestFileRatchet===6
    &&scope.validation?.targetedTestRatchet===31&&scope.validation?.migrationVersion===110
    &&scope.validation?.migrationSha256==='8bcc5777aa80794122742bcfd73be036234488f5861adbcd34956c56e6d0d6ac'],
  ['PPK ratchets are closed without requirement pass',scope.validation?.ppk015?.status==='PASS'
    &&scope.validation?.ppk019?.status==='PASS'&&scope.validation?.ppk021?.status==='PASS'
    &&scope.validation?.ppk022?.status==='PASS'&&scope.validation?.countsAsRequirementPass===false]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-F',decision:'DEC-243',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  implementationStatus:scope.localImplementationStatus,countsAsRequirementPass:false,checkCount:results.length,
  passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-F-family-meetings-decisions-consent-minutes-boundary.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-F boundary: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-F boundary: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
