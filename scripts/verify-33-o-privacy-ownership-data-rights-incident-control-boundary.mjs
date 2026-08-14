import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root=resolve(process.cwd());
const output='artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-boundary.json';
const requirements=['B6-02','PPK-028','AUD-COM-006','EXT-036','EXT-037','EXT-038','EXT-040','EXT-041','EXT-042'];
const paths={
  domain:'packages/domain/src/privacy-ownership-data-rights.ts',application:'packages/application/src/privacy-ownership-data-rights-use-cases.ts',
  contract:'packages/repository-contracts/src/privacy-ownership-data-rights-repository.ts',migration:'packages/database/src/family-database-migrations.ts',
  repository:'packages/repositories/src/privacy-ownership-data-rights-repository.ts',lifecycle:'packages/repositories/src/data-lifecycle-repository.ts',
  policyRuntime:'apps/desktop/src/main/timeline-production-policy-runtime.ts',composition:'apps/desktop/src/main/repository-composition-root.ts',
  dataStore:'apps/desktop/src/main/data-store.ts',security:'packages/security/src/privacy-data-export.ts',fileService:'apps/desktop/src/main/privacy-data-export-service.ts',
  ipc:'apps/desktop/src/main/ipc-integration-policy.ts',requestLifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',ipcRuntime:'apps/desktop/src/main/ipc-runtime.ts',
  main:'apps/desktop/src/main/main.ts',preload:'apps/desktop/src/main/preload.ts',global:'apps/desktop/src/renderer/global.d.ts',app:'apps/desktop/src/renderer/App.tsx',
  applicationTest:'packages/application/tests/privacy-ownership-data-rights-use-cases.test.ts',repositoryTest:'packages/repositories/privacy-ownership-data-rights-repository-policy.test.ts',
  cryptoTest:'packages/security/tests/privacy-data-export.test.ts',fileTest:'apps/desktop/tests/privacy-data-export-service.test.ts',ipcTest:'apps/desktop/tests/privacy-ownership-data-rights-ipc-integration.test.ts',
  bridgeTest:'apps/desktop/tests/privacy-ownership-data-rights-ipc-bridge.test.ts',uiTest:'apps/desktop/tests/privacy-ownership-data-rights-ui.test.ts',ppk019Test:'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts'
};
const text=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await readFile(resolve(root,path),'utf8')])));
const has=(key,...markers)=>markers.every(marker=>text[key].includes(marker));
const definitions=[
 ['domain owner-scoped aggregate',has('domain','PrivacyOwnershipAggregateKey','familyId','accountId','ownerPersonId')],
 ['AI memory lifecycle and bounds',has('domain','PRIVACY_OWNERSHIP_MAX_AI_MEMORY_RECORDS','pending_deletion','deleted')],
 ['AI correction restriction deletion expiry commands',has('domain','CorrectAiMemoryInput','RestrictAiMemoryInput','DeleteAiMemoryInput','ExpireAiMemoryInput')],
 ['access history purpose and decision',has('domain','AccessHistoryEntryView','decisionReason','occurredAt')],
 ['local processing observation truth',has('domain','LocalProcessingObservationView','networkDeliveryObserved: false','observationSource')],
 ['data rights and retention model',has('domain','DataRightsRequestView','requestedRetentionUntil','externalCopiesErasureGuaranteed: false')],
 ['incident no-claim model',has('domain','PrivacyIncidentView','remoteWipePerformed: false','mdmOperationPerformed: false','networkDeliveryGuaranteed: false')],
 ['permission simulation creates no authority',has('domain','PermissionSimulationView','grantsCreated: false','accessPerformed: false','auditAccessRecorded: false')],
 ['application exact command validation',has('application','exactObject','expectedRevision','clientOperationId')],
 ['application replay fingerprint fence',has('application','requestFingerprint','clientOperationId')],
 ['application central policy transaction',has('application','PrivacyOwnershipUnitOfWork','executeMutation','unitOfWork.execute')],
 ['application local observation truth',has('application','networkDeliveryObserved','local_runtime')],
 ['application permission preview only',has('application','SimulatePermissionVisibility','simulation')],
 ['repository contract policy scope',has('contract','PolicyAuthorizedRepositoryExecutionContext','PrivacyOwnershipDataRightsRepositoryPort')],
 ['repository contract mutation ledger',has('contract','saveAiMemoryRecord','insertMutation')],
 ['migration 92 identity',has('migration',"createMigrationDefinition(92, 'privacy_ownership_data_rights_incident_control'")],
 ['migration strict AI memory tables',has('migration','CREATE TABLE governed_ai_memory_records','CREATE TABLE governed_ai_memory_mutations',') STRICT;')],
 ['migration access and processing observations',has('migration','CREATE TABLE privacy_access_observations','CREATE TABLE privacy_processing_observations')],
 ['migration rights and incident tables',has('migration','CREATE TABLE privacy_rights_requests','CREATE TABLE policy_incident_cases')],
 ['migration immutable and quota triggers',has('migration','trg_33o_ai_current_delete','trg_33o_incident_delete','trg_33o_ai_current_quota')],
 ['repository owner scoping',has('repository','owner_person_id','account_id','family_id')],
 ['repository policy persistence binding',has('repository','assertPolicyAuthorizedRepositoryContext','platformPolicyPersistenceBinding')],
 ['repository immutable mutation access',has('repository','governed_ai_memory_mutations','client_operation_id')],
 ['PPK-019 managed AI owner registration',has('lifecycle','REGISTERED_DERIVED_PAYLOAD_OWNER_TABLES','governed_ai_memory_records')],
 ['PPK-019 AI tombstone purge fence',has('lifecycle','assertLinkedAiMemoryTombstones','SOURCE_DELETION_PROPAGATION_AI_MEMORY_NOT_TOMBSTONED')],
 ['production policy resolves privacy resources',has('policyRuntime','privacyOwnershipDataRightsRepository','resolvePolicyResource')],
 ['repository composition exposes privacy repository',has('composition','privacyOwnershipDataRightsRepository','SqlitePrivacyOwnershipDataRightsRepository')],
 ['data store composes privacy use cases',has('dataStore','privacyOwnershipDataRightsRepository','PrivacyOwnership')],
 ['encrypted export scrypt and AES GCM',has('security','scrypt','aes-256-gcm','encryptPrivacyDataExport')],
 ['encrypted export exact canonical envelope',has('security','ppt-privacy-data-export','canonicalizePrivacyDataExport','verifyPrivacyDataExportReadback')],
 ['file service no-clobber and readback',has('fileService',"open(temporaryPath, 'wx', 0o600)",'link(temporaryPath, finalPath)','verifyPrivacyDataExportReadback')],
 ['IPC exact governed channels',has('ipc','privacyOwnership:getCenter','privacyOwnership:exportEncrypted','privacyOwnershipInput')],
 ['IPC recursive secret path prototype bounds',has('ipc','BANKING_SECRET_FIELD_PROHIBITED','PATH_FIELD_PROHIBITED','NON_PLAIN_OBJECT_REJECTED','PRIVACY_STRING_TOO_LARGE')],
 ['IPC export result content-free',has('ipc','evaluateIpcIntegrationResultPolicy','artifactSha256','not_performed')],
 ['IPC rate admission and noncancellable writes',has('requestLifecycle','privacyOwnershipWriteChannels','maxRequestsPerWindow: 24','maxConcurrentPerSender: 2')],
 ['runtime enforces result policy',has('ipcRuntime','evaluateIpcIntegrationResultPolicy','resultDecision')],
 ['main dialog owns destination and cancellation',has('main','PrivacyExportCancelledError','dialog.showSaveDialog','destination: selected.filePath')],
 ['preload renderer cannot supply destination',has('preload','EncryptedPrivacyDataExportIpcInput','requestId: string','passphrase: string')&&!text.preload.slice(text.preload.indexOf('export interface EncryptedPrivacyDataExportIpcInput'),text.preload.indexOf('export interface EncryptedPrivacyDataExportIpcResult')).includes('destination')],
 ['renderer global exact safe result',has('global','EncryptedPrivacyDataExportIpcResult',"delivery:'not_performed'")],
 ['UI extends existing security route',has('app','SECURITY_CENTER_ROUTE','Gizlilik, Sahiplik ve Olay Kontrol Merkezi','PrivacyOwnershipCenter')],
 ['UI no-claim truth and content-free lineage',has('app','Uzaktan silme, MDM, ağ teslimi','İçerik gösterilmez','yetki oluşturmaz, erişim yapmaz')],
 ['application and repository negative suites',has('applicationTest','owner','revision')&&has('repositoryTest','forged','owner')],
 ['crypto and file service suites',has('cryptoTest','tamper','wrong password')&&has('fileTest','no-clobber','partial')],
 ['IPC bridge and UI suites',has('ipcTest','fails closed','passphrase')&&has('bridgeTest','destination only in main')&&has('uiTest','retry-stable operation IDs')],
 ['PPK-019 migration 92 cross regression',has('ppk019Test','migration 92','AI-memory','thumbnail_payloads')]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-O',decision:'DEC-226',requirements,status:failures.length?'FAIL':'PASS',checksPassed:checks.length-failures.length,checksFailed:failures.length,checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(resolve(root,output)),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(`33-O boundary: ${report.status} (${report.checksPassed}/${checks.length}).`);if(failures.length)process.exitCode=1;
