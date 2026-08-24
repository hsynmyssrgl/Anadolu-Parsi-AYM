import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertGovernedSourceRoot } from './lib/governed-source-root.mjs';

const noWrite=process.argv.includes('--no-write');
const root=assertGovernedSourceRoot({allowReleaseChannel:noWrite});
const text=async path=>readFile(resolve(root,path),'utf8');
const json=async path=>JSON.parse(await text(path));
const has=(value,markers)=>markers.every(marker=>value.includes(marker));
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const paths={
  scope:'config/34-c-realtime-calling-media-accessible-ux-scope.json',inventory:'config/34-c-realtime-calling-media-accessible-ux-inventory.json',
  decision:'docs/decisions/DEC-240-realtime-calling-media-accessible-ux.md',threat:'docs/security/THREAT_MODEL_34_C_REALTIME_CALLING_MEDIA_ACCESSIBLE_UX.md',
  domain:'packages/domain/src/communication-realtime-calling.ts',contract:'packages/repository-contracts/src/communication-realtime-calling-repository.ts',
  application:'packages/application/src/communication-realtime-calling-use-cases.ts',repository:'packages/repositories/src/communication-realtime-calling-repository.ts',
  adapter:'apps/desktop/src/main/communication-realtime-calling-application-adapter.ts',migration:'packages/database/src/family-database-migrations.ts',
  preflightAdapter:'apps/desktop/src/main/communication-call-preflight-adapter.ts',
  ipc:'apps/desktop/src/main/ipc-integration-policy.ts',lifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',
  main:'apps/desktop/src/main/main.ts',preload:'apps/desktop/src/main/preload.ts',global:'apps/desktop/src/renderer/global.d.ts',
  panel:'apps/desktop/src/renderer/CommunicationRealtimeCallingPanel.tsx',app:'apps/desktop/src/renderer/App.tsx',package:'package.json'
};
const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await text(path)]));
const content=Object.fromEntries(entries);const scope=JSON.parse(content.scope);const inventory=JSON.parse(content.inventory);const pkg=JSON.parse(content.package);
const checks=[
  ['governance identities and no-pass truth are exact',scope.step==='34-C'&&scope.decision==='DEC-240'&&inventory.step==='34-C'
    &&scope.status==='PLANNED'&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['domain contract carries safe views and false production truth',has(content.domain,['CommunicationRealtimeCallingCenterView',
    'CommunicationRealtimeCallingMutationReceiptView','VerifiedCommunicationCallPreflightInput','VerifiedCommunicationCallQualityInput',
    'mediaTransportStarted: false','networkUsed: false'])],
  ['repository contract exposes payload-free policy resolution',has(content.contract,['CommunicationRealtimeCallingRepositoryPort',
    'CommunicationRealtimeCallingPolicyResourceRepositoryPort','resolvePolicyResource','insertMutation','saveSession','appendQualityObservation'])],
  ['application keeps preflight and quality behind trusted inputs',has(content.application,['CommunicationCallPreflightPort',
    'RecordCommunicationCallQualityInput','providerVerified !== true','networkUsed !== false','RecordCommunicationCallQualityObservationUseCase',
    'PreflightPreparation','authorizedAtMs - observedAtMs > 120_000'])],
  ['production local preflight is isolated bounded and content free',has(content.preflightAdapter,['ElectronCommunicationCallPreflightPort',
    'sandbox: true','setPermissionRequestHandler','setDisplayMediaRequestHandler','executeJavaScript<unknown>',
    'providerEvidenceSha256','networkUsed: false as const'])],
  ['migration 107 owns six tables and immutable ledgers',has(content.migration,["createMigrationDefinition(107, 'communication_realtime_calling_accessible_ux'",
    'CREATE TABLE communication_call_mutations','CREATE TABLE communication_call_sessions','CREATE TABLE communication_call_participants',
    'CREATE TABLE communication_call_events','CREATE TABLE communication_call_preferences','CREATE TABLE communication_call_quality_observations',
    '34-C mutation ledger is immutable','34-C quality evidence is durable'])],
  ['migration caps writes before unreadable center bounds',has(content.migration,['COUNT(*) FROM communication_call_sessions','>=256',
    'COUNT(*) FROM communication_call_quality_observations','>=512'])],
  ['repository and adapter require central policy context',has(content.repository,['assertPolicyAuthorizedRepositoryContext',
    'currentBinding','family_id=? AND owner_person_id=?'])&&has(content.adapter,['RepositoryBackedLifePolicyTransactionRunner',
    'RepositoryBackedCommunicationRealtimeCallingUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['IPC lifecycle bridge and preload expose six bounded channels',has(content.ipc,['communicationCalling:getCenter','communicationCalling:create',
    'communicationCalling:runPreflight','communicationCalling:updateControls','communicationCalling:advance','communicationCalling:setPreferences'])
    &&has(content.lifecycle,['communicationCallingReadChannels','communicationCallingWriteChannels'])
    &&has(content.main,['getCommunicationRealtimeCallingCenter','setCommunicationCallPreferences'])
    &&has(content.preload,['getCommunicationRealtimeCallingCenter','setCommunicationCallPreferences'])
    &&has(content.global,['CommunicationRealtimeCallingMutationReceiptView','setCommunicationCallPreferences'])],
  ['renderer reuses App surface without new route',has(content.panel,['CommunicationRealtimeCallingPanel','meetingLocked','pinnedPersonId',
    'signLanguagePinnedPersonId','screenShareRequested'])&&has(content.app,['<CommunicationRealtimeCallingPanel/>'])],
  ['governance documents preserve fail-honest residuals',has(content.decision,['countsAsRequirementPass=false','WebRTC','SFU','STUN/TURN',
    'SFrame','NOT_RUN'])&&has(content.threat,['Renderer medya cihazı','Yaşam boyu mutation/event retention','kalıcı governance receipt'])],
  ['targeted package command is exact',pkg.scripts?.['verify:34-c:targeted']===
    'vitest run packages/application/tests/communication-realtime-calling-use-cases.test.ts packages/repositories/communication-realtime-calling-repository-policy.test.ts apps/desktop/tests/communication-call-preflight-adapter.test.ts apps/desktop/tests/communication-realtime-calling-data-store.test.ts apps/desktop/tests/communication-realtime-calling-ipc-integration.test.ts apps/desktop/tests/communication-realtime-calling-ui.test.ts --maxWorkers=1'],
  ['governance verifier commands are wired',pkg.scripts?.['verify:34-c:realtime-calling-media-accessible-ux:boundary']
    &&pkg.scripts?.['verify:34-c:realtime-calling-media-accessible-ux:contract']&&pkg.scripts?.['verify:34-c:realtime-calling-media-accessible-ux:runtime']],
  ['migration checksum ratchet is exact',scope.validation?.migrationSha256==='299024d7bd040343717abceb2ada6e543a95bea921c7ee6c7d34a10cf2b6515b'],
  ['governance sources are nonempty and uniquely bound',new Set(Object.values(paths)).size===Object.keys(paths).length
    &&Object.values(content).every(value=>value.length>20)&&sha(content.scope)!==sha(content.inventory)]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-C',decision:'DEC-240',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  countsAsRequirementPass:false,checkCount:results.length,passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-C-realtime-calling-media-accessible-ux-contract.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-C contract: FAIL (${failures.length}/${results.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-C contract: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
