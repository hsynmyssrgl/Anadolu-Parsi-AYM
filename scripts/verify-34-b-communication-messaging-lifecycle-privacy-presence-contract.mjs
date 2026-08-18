import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async path=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every(marker=>source.includes(marker));
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const [scope,inventory,decision,threat,migrations,domain,contract,application,repository,vault,ipc,lifecycle,main,preload,globalTypes,panel]=await Promise.all([
  json('config/34-b-communication-messaging-lifecycle-privacy-presence-scope.json'),
  json('config/34-b-communication-messaging-lifecycle-privacy-presence-inventory.json'),
  text('docs/decisions/DEC-239-communication-messaging-lifecycle-privacy-presence.md'),
  text('docs/security/THREAT_MODEL_34_B_COMMUNICATION_MESSAGING_LIFECYCLE_PRIVACY_PRESENCE.md'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),text('packages/domain/src/communication-messaging.ts'),
  text('packages/repository-contracts/src/communication-messaging-repository.ts'),
  text('packages/application/src/communication-messaging-use-cases.ts'),
  text('packages/repositories/src/communication-messaging-repository.ts'),
  text('apps/desktop/src/main/communication-message-payload-vault.ts'),text('apps/desktop/src/main/ipc-integration-policy.ts'),
  text('apps/desktop/src/main/ipc-request-lifecycle.ts'),text('apps/desktop/src/main/main.ts'),
  text('apps/desktop/src/main/preload.ts'),text('apps/desktop/src/renderer/global.d.ts'),
  text('apps/desktop/src/renderer/CommunicationMessagingPanel.tsx')
]);
const requirements=['COM-003','COM-004','COM-005','COM-006','COM-007','COM-008','COM-009','COM-010','PRS-001','PRS-002','PRS-003','PRS-004','PRS-005','PRS-006'];
const migration=migrations.migrationVersions?.find(item=>item.version===106);
const testFiles=scope.validation?.targetedTestFiles??[];
const checks=[
  ['contract identity requirements and dependency order are exact',scope.step==='34-B'&&scope.decision==='DEC-239'
    &&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&exact(scope.dependsOn,['34-A','33-N'])],
  ['decision states expanded local implementation and exact no-claims',has(decision,['`LOCAL_IMPLEMENTATION_STARTED`','`countsAsRequirementPass=false`',
    'aynı sahip, aynı oda, `ready_local`, temiz tarama kanıtı','yalnız main-process kasasında yetkili metin/konum araması',
    'hatırlatma yürütücüsü yoktur','fiziksel secure erase'])],
  ['threat model covers renderer owner replay payload presence and retention threats',has(threat,['Renderer güvenilir payload',
    'Başka aile/kişi mesajına erişim','Replay veya revision atlama','DB\'de plaintext sızıntısı','Presence ile aktif cihaz',
    'Retent' ,'Fail-closed ve no-claim sınırları'])],
  ['migration manifest pins exact version and checksum',migration?.name==='communication_messaging_lifecycle_privacy_presence'
    &&migration?.checksum===scope.validation?.migrationSha256&&migration?.checksum===inventory.validation?.migrationSha256],
  ['domain contract exports safe center content receipt and truth views',has(domain,['CommunicationMessageView','CommunicationMessageContentView',
    'CommunicationPresenceView','CommunicationRetentionPolicyView','CommunicationMessagingTruthView',
    'CommunicationMessagingMutationReceiptView'])],
  ['repository contract contains sealed metadata but no plaintext field',has(contract,['sealedPayloadReference','payloadSha256',
    'providerEvidenceSha256','CommunicationMessagingPolicyResourceRepositoryPort'])&&!/messagePlaintext|plaintextContent/u.test(contract)],
  ['application hashes text in request fingerprint and emits content-free events',has(application,[
    "hash({ ...command, text: normalizedText === undefined ? null : hash(normalizedText) })",'communication.messaging.changed',
    'findAttachmentGuard','expiresAt','MaintainCommunicationMessagePayloadVaultUseCase',
    'payloadSealedLocally','remoteDeliveryPerformed: false','networkUsed: false'])],
  ['repository SQL is exact-owner bounded and has no semantic plaintext column',has(repository,['LIMIT 10001','LIMIT 257',
    'family_id=? AND owner_person_id=?','platformPolicyPersistenceBinding'])&&!/message_plaintext|payload_text/u.test(repository)],
  ['payload vault binds encrypted content identity and fails closed',has(vault,['PAYLOAD_KIND','MAX_FILES = 10_000',
    'MAX_TOTAL_BYTES = 512 * 1024 * 1024','providerEvidenceSha256','payload.revision !== row.payloadRevision',
    'sweepOrphans','recoverInterruptedPublications','failure(correlationId'])],
  ['IPC input output and lifecycle policies are exact',has(ipc,['COMMUNICATION_MESSAGING_IPC_CHANNELS',
    'COMMUNICATION_MESSAGING_RESULT_INVALID','remoteDeliveryPerformed===false','networkUsed===false'])
    &&has(lifecycle,['communicationMessagingReadChannels','communicationMessagingWriteChannels','maxRequestsPerWindow:24'])],
  ['main preload and global bridge expose every safe method',testFiles.length===5&&['getCommunicationMessagingCenter',
    'searchCommunicationMessages','getCommunicationMessageContent','createCommunicationMessage','editCommunicationMessage',
    'setCommunicationMessageLifecycle','annotateCommunicationMessage','updateCommunicationDelivery','setCommunicationPresence',
    'setCommunicationRetentionPolicy'].every(marker=>main.includes(marker)&&preload.includes(marker)&&globalTypes.includes(marker))],
  ['renderer requires explicit reveal and retains operation identity',has(panel,['operations.current.get(key)','operations.current.delete(key)',
    'İçeriği açıkça göster','Aynı işlem kimliğiyle yeniden deneyebilirsiniz.'])],
  ['validation ratchet and manual no-claim state are exact',scope.validation?.targetedTestFileRatchet===5
    &&scope.validation?.targetedTestRatchet===29&&scope.validation?.migrationVersion===106
    &&scope.validation?.ppk015?.status==='PASS'&&scope.validation?.ppk015?.files===563
    &&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk021?.surfaces===886&&scope.validation?.ppk021?.runtime===20
    &&scope.validation?.ppk022?.status==='PASS'&&scope.validation?.ppk022?.surfaces===422&&scope.validation?.ppk022?.runtime===24
    &&Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN')
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'],
  ['governance cannot count as requirement pass',scope.status==='PLANNED'&&inventory.status==='PLANNED'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-B',decision:'DEC-239',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  countsAsRequirementPass:false,checkCount:results.length,passed:results.length-failures.length,failed:failures.length,
  checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-B-communication-messaging-lifecycle-privacy-presence-contract.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-B contract: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-B contract: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
