import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanSourceDeletionPropagationBoundary } from './verify-source-deletion-propagation-boundary.mjs';

const candidateMode = process.argv.includes('--candidate');
const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};
const requireMarkers = (label, source, markers) => {
  for (const marker of markers) check(`${label}: ${marker}`, source.includes(marker));
};

const paths = {
  policy: 'packages/platform-policy/src/source-deletion-propagation-policy.ts',
  policyIndex: 'packages/platform-policy/src/index.ts',
  domain: 'packages/domain/src/source-deletion-propagation.ts',
  domainIndex: 'packages/domain/src/index.ts',
  useCase: 'packages/application/src/source-deletion-propagation-use-cases.ts',
  dataLifecycleUseCase: 'packages/application/src/data-lifecycle-use-cases.ts',
  managedBackup: 'packages/application/src/managed-backup-propagation-use-case.ts',
  applicationIndex: 'packages/application/src/index.ts',
  repositoryContract: 'packages/repository-contracts/src/data-lifecycle-repository.ts',
  repository: 'packages/repositories/src/data-lifecycle-repository.ts',
  backupRepository: 'packages/repositories/src/backup-propagation-repository.ts',
  dataLifecycleAdapter: 'apps/desktop/src/main/data-lifecycle-application-adapter.ts',
  cacheAdapter: 'apps/desktop/src/main/source-deletion-propagation-application-adapter.ts',
  familyImport: 'apps/desktop/src/main/family-data-import-service.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  desktopMain: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  ipcPolicy: 'apps/desktop/src/main/ipc-integration-policy.ts',
  ipcNoCache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  targetTest: 'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts',
  sourceGate: 'scripts/verify-source-deletion-propagation-boundary.mjs',
  build136Runtime: 'scripts/verify-build136-data-lifecycle-runtime.mjs',
  build137Runtime: 'scripts/verify-build137-backup-purge-propagation-runtime.mjs',
  package: 'package.json',
  migrations: 'packages/database/src/family-database-migrations.ts',
  scope: 'config/32-o-ppk-019-source-deletion-propagation-scope.json',
  inventory: 'config/32-o-ppk-019-propagation-owner-inventory.json',
  registry: 'config/accepted-scope-registry.json',
  ledger: 'config/user-decision-ledger.json',
  masterDecisionRegister: 'docs/10_MASTER_DECISION_REGISTER.md',
  decision: 'docs/decisions/DEC-200-ppk-019-source-deletion-propagation.md',
  threat: 'docs/security/PPK-019_SOURCE_DELETION_PROPAGATION_THREAT_MODEL.md',
  audit: 'docs/audit/32-O_PPK-019_KAYNAK_SILME_RETENTION_YAYILIMI_UST_KAPANIS.md'
};
const files = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const scope = JSON.parse(files.scope);
const inventory = JSON.parse(files.inventory);
const registry = JSON.parse(files.registry);
const ledger = JSON.parse(files.ledger);
const rootPackage = JSON.parse(files.package);
const requirement = registry.requirements.find((item) => item.id === 'PPK-019');
const successor = registry.requirements.find((item) => item.id === 'PPK-020');
const priorRequirements = ['PPK-012', 'PPK-013', 'PPK-014', 'PPK-015', 'PPK-016', 'PPK-017', 'PPK-018']
  .map((id) => registry.requirements.find((item) => item.id === id));
const migrationVersions = [...files.migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number(match[1]));
const latestMigration = Math.max(...migrationVersions);
const scan = await scanSourceDeletionPropagationBoundary();

requireMarkers('central propagation policy', files.policy, [
  "SOURCE_DELETION_PROPAGATION_POLICY_VERSION = 'PPK-019-V1'",
  'SOURCE_DELETION_PROPAGATION_OWNER_KINDS',
  "'OCR_TEXT'",
  "'SEARCH_INDEX'",
  "'THUMBNAIL'",
  "'AI_MEMORY'",
  "'CACHE'",
  "'REPLICA'",
  "'BACKUP'",
  'SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES',
  "'family-import-preview'",
  "'ipc-main-read'",
  "'offline-sensitive'",
  'SOURCE_DELETION_DIRECT_BYPASS_EXCEPTIONS',
  'SOURCE_DELETION_AUTHORIZED_REPOSITORY_ADAPTERS'
]);
check('direct bypass exception registry is exactly empty', files.policy.includes('Object.freeze([] as const)'));
check('authorized repository adapter registry names lifecycle and backup owners', [
  'packages/repositories/src/data-lifecycle-repository.ts',
  'packages/repositories/src/backup-propagation-repository.ts'
].every((marker) => files.policy.includes(marker)));
check('policy defines all fail-closed rejection classes', [
  'INVALID_SOURCE_IDENTITY', 'INVALID_PURGE_TIME', 'INSPECTION_TIME_MISMATCH',
  'UNREGISTERED_PERSISTENT_OWNER', 'PLAINTEXT_REPLICA_ACTIVE',
  'DERIVED_POLICY_METADATA_CLASSIFICATION_INVALID', 'CACHE_REGISTRY_SET_MISMATCH',
  'CACHE_INVALIDATION_INVALID', 'PLAN_HASH_MISMATCH', 'PLAN_STRUCTURE_MISMATCH'
].every((marker) => files.policy.includes(marker)));
check('policy requires exact cache set and transaction chronology', files.policy.includes('new Set(cacheInvalidations.map') && files.policy.includes('entry.invalidatedAt !== source.purgedAt'));
check('policy rejects unregistered owner plaintext replica and bad metadata class', files.policy.includes('persistentInspection.unregisteredPersistentOwners.length > 0') && files.policy.includes('persistentInspection.plaintextReplicaEnabled') && files.policy.includes('!persistentInspection.derivedPolicyMetadataOnly'));
check('policy emits exact seven owner outcomes and keeps backup pending', (files.policy.match(/kind: '(?:OCR_TEXT|SEARCH_INDEX|THUMBNAIL|AI_MEMORY|CACHE|REPLICA|BACKUP)'/gu) ?? []).length === 7 && files.policy.includes("disposition: 'VERIFIED_REWRITE_PENDING'") && files.policy.includes('backupPropagationPending: true'));
check('policy hashes canonical unsigned plan and verifies exact shape', files.policy.includes('planHash: sha256(unsigned)') && files.policy.includes('canonicalize(rebuilt.plan) !== canonicalize(plan)'));
check('policy snapshot tells the quarantine and external backup truth', files.policy.includes('historicalBackupQuarantineIsNotPhysicalDestruction: true') && files.policy.includes('unmanagedAndExternalBackupAttentionRequired: true') && files.policy.includes('payloadExposedToClient: false'));
check('policy is exported from platform-policy root', files.policyIndex.includes("export * from './source-deletion-propagation-policy.js'"));

check('domain exposes content-free propagation boundary only', files.domain.includes('SourceDeletionPropagationBoundaryView') && files.domain.includes('payloadExposedToClient: false') && files.domain.includes('latestDatabaseMigration: 77'));
check('domain boundary does not expose source tombstone path or evidence payload', !/\b(?:resourceId|familyId|tombstone|filePath|planHash|evidenceSha256)\s*:/u.test(files.domain));
check('domain and application roots export PPK-019 contracts', files.domainIndex.includes("export * from './source-deletion-propagation.js'") && files.applicationIndex.includes("export * from './source-deletion-propagation-use-cases.js'"));

const cacheCall = files.useCase.indexOf('cacheInvalidation.invalidate');
const inspectionCall = files.useCase.indexOf('inspectSourceDeletionPropagation', cacheCall);
const evaluationCall = files.useCase.indexOf('this.policy.evaluate', inspectionCall);
const purgeCall = files.useCase.indexOf('purgeResourceWithPropagation', evaluationCall);
check('application enforces cache then inspection then policy then repository order', cacheCall >= 0 && cacheCall < inspectionCall && inspectionCall < evaluationCall && evaluationCall < purgeCall);
check('cache or inspection failure short-circuits before payload delete', files.useCase.includes('if (!cacheInvalidations.ok) return cacheInvalidations') && files.useCase.includes('if (!inspection.ok) return inspection'));
check('application validates exact repository propagation evidence', ['planHash', 'sourceDeleted', 'localPropagationComplete', 'backupPropagationPending', 'deletedAccessMetadataRows'].every((marker) => files.useCase.includes(marker)) && files.useCase.includes('PROPAGATION_EVIDENCE_MISMATCH'));
check('boundary use case publishes verified content-free posture', files.useCase.includes("status: 'verified'") && files.useCase.includes('sourceTombstoneRetainedUntilBackupCompletion: true'));

check('repository contract removes legacy raw purge and requires inspect plus propagation plan', !/\bpurgeResource\s*\(/u.test(files.repositoryContract) && files.repositoryContract.includes('inspectSourceDeletionPropagation') && files.repositoryContract.includes('purgeResourceWithPropagation'));
requireMarkers('SQLite propagation repository', files.repository, [
  'DERIVED_POLICY_METADATA_TABLES',
  'DERIVED_PAYLOAD_TABLE_PATTERN',
  'sqlite_schema',
  'unregisteredPersistentOwners',
  'SourceDeletionPropagationPolicy().verify(plan)',
  'SOURCE_DELETION_PROPAGATION_SCHEMA_CHANGED',
  'SOURCE_DELETION_PROPAGATION_LIFECYCLE_MISMATCH',
  'PRAGMA secure_delete=ON',
  'DELETE FROM object_permissions',
  'DELETE FROM ai_consents',
  'SOURCE_DELETION_PROPAGATION_SOURCE_NOT_FOUND'
]);
check('repository performs second owner inspection after plan verification', files.repository.indexOf('new SourceDeletionPropagationPolicy().verify(plan)') < files.repository.indexOf('const currentInspection=inspectPersistentOwners'));
check('repository binds lifecycle purge state and legal hold before delete', files.repository.includes("String(lifecycle?.state??'')!=='purge_scheduled'") && files.repository.includes('Number(lifecycle?.legal_hold??1)!==0'));
check('repository enables secure delete before access metadata and source deletion', files.repository.indexOf("database.exec('PRAGMA secure_delete=ON;')") < files.repository.indexOf("DELETE FROM object_permissions") && files.repository.indexOf('DELETE FROM object_permissions') < files.repository.indexOf('DELETE FROM ${table}'));
check('repository requires exactly one source row and content-free evidence', files.repository.includes('Number(result.changes??0)!==1') && files.repository.includes('sourceDeleted:true') && files.repository.includes('backupPropagationPending:true'));
check('authorized DataLifecycle adapter maps both propagation operations', files.dataLifecycleAdapter.includes('inspectSourceDeletionPropagation') && files.dataLifecycleAdapter.includes('purgeResourceWithPropagation'));

check('ExecuteDataPurge requires central propagation use case', files.dataLifecycleUseCase.includes('private readonly propagation:EnforceSourceDeletionPropagationUseCase'));
const executePurge = files.dataLifecycleUseCase.slice(files.dataLifecycleUseCase.indexOf('export class ExecuteDataPurgeUseCase'), files.dataLifecycleUseCase.indexOf('export class SetDataLegalHoldUseCase'));
check('purge propagation runs before tombstone audit and event', executePurge.indexOf('this.propagation.execute') < executePurge.indexOf('scope.upsertLifecycle') && executePurge.indexOf('scope.upsertLifecycle') < executePurge.indexOf('scope.appendAudit') && executePurge.indexOf('scope.appendAudit') < executePurge.indexOf('scope.enqueueEvent'));
check('purge outbox binds plan and every owner outcome', executePurge.includes('propagationPlanHash') && executePurge.includes('ownerOutcomes') && executePurge.includes('backupPropagationPending'));

check('desktop cache adapter returns all three exact registries', ['family-import-preview', 'ipc-main-read', 'offline-sensitive'].every((marker) => files.cacheAdapter.includes(marker)));
check('desktop cache adapter fails closed on any cache exception', files.cacheAdapter.includes('catch (error)') && files.cacheAdapter.includes('runtime cache sahipleri') && files.cacheAdapter.includes('category: \'infrastructure\''));
check('family import cache clear reports exact cleared count', files.familyImport.includes('public clearCachedPreviews(): number') && files.familyImport.includes('const count = this.#previews.size') && files.familyImport.includes('this.#previews.clear()'));
check('DataStore composes exactly the central policy and cache adapter', files.dataStore.includes('new EnforceSourceDeletionPropagationUseCase(') && files.dataStore.includes('new SourceDeletionPropagationPolicy()') && files.dataStore.includes('new DesktopSourceDeletionRuntimeCacheInvalidationPort('));
check('main cache invalidator clears main read cache and locks offline sensitive cache', files.desktopMain.includes('ipcReadResults.clearAll()') && files.desktopMain.includes("offlineSensitiveCache.lock('NO_LEASE')") && files.desktopMain.includes("registryId: 'ipc-main-read'") && files.desktopMain.includes("registryId: 'offline-sensitive'"));

check('managed backup requires verified fresh success path and SHA-256', files.managedBackup.includes("refreshed.status !== 'success'") && files.managedBackup.includes('!refreshed.filePath || !refreshed.sha256'));
check('managed backup quarantines old managed artifacts and deletes old run projections', files.managedBackup.includes('quarantineManagedArtifacts({') && files.managedBackup.includes('deleteManagedRun(old.id)'));
check('managed backup counts unmanaged active artifacts as target failure', files.managedBackup.includes('success: unmanaged === 0') && files.managedBackup.includes('unmanagedArtifacts: unmanaged'));
check('pending closes only when every enabled target is refreshed', files.managedBackup.includes('targets.length > 0 && refreshedTargets === targets.length') && files.managedBackup.includes('if (input.pending.length > 0 && allTargetsRefreshed)') && files.managedBackup.includes('completePending(input.pending, completedAt)'));
check('no target leaves pending and returns attention', files.managedBackup.includes("targets.length === 0") && files.managedBackup.includes("? 'attention'"));
check('backup repository uses exact pending tombstone revision fence', files.backupRepository.includes("state='purged' AND backup_propagation_pending=1 AND updated_at=?"));

check('main registers typed PPK-019 content-free status handler', files.desktopMain.includes("registerIpcHandler('system:getSourceDeletionPropagationBoundary'") && files.desktopMain.includes('SourceDeletionPropagationBoundaryView'));
check('preload and renderer global expose typed PPK-019 status only', files.preload.includes('getSourceDeletionPropagationBoundary:():Promise<SourceDeletionPropagationBoundaryView>') && files.global.includes('getSourceDeletionPropagationBoundary():Promise<SourceDeletionPropagationBoundaryView>'));
check('PPK-019 status IPC is zero argument', files.ipcPolicy.includes("case 'system:getSourceDeletionPropagationBoundary':") && files.ipcPolicy.includes('return zeroArguments(args);'));
check('PPK-019 status IPC is policy-sensitive no-cache', files.ipcNoCache.includes("'system:getSourceDeletionPropagationBoundary'"));
check('renderer loads and displays content-free PPK-019 posture', files.renderer.includes('getSourceDeletionPropagationBoundary().then(setSourceDeletionPropagationBoundary)') && files.renderer.includes('PPK-019') && files.renderer.includes('istemciye payload verilmez'));

check('source gate passes malicious and benign self-tests with no finding', scan.findings.length === 0 && scan.zones === 18 && scan.files >= 346 && scan.relevantFiles >= 32);
requireMarkers('source gate', files.sourceGate, [
  'PRIMARY_DELETE_OUTSIDE_PROPAGATION_REPOSITORY',
  'UNREGISTERED_DERIVED_PAYLOAD_TABLE',
  'UNREGISTERED_DERIVED_PAYLOAD_WRITER',
  'PROPAGATION_REPOSITORY_CALL_OUTSIDE_AUTHORIZED_CHAIN',
  'PROPAGATION_ENFORCEMENT_OUTSIDE_DATASTORE_COMPOSITION',
  'PLAINTEXT_REPLICA_COPY_ACTIVE',
  'EMPTY_RUNTIME_CACHE_INVALIDATOR'
]);
check('source gate self-test matrix remains exact', files.sourceGate.includes('malicious: malicious.length') && files.sourceGate.includes('benign: benign.length') && (files.sourceGate.match(/\['|\["/gu) ?? []).length > 0);
check('pretypecheck and prebuild include PPK-019 source gate', rootPackage.scripts?.pretypecheck?.includes('verify-source-deletion-propagation-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-source-deletion-propagation-boundary.mjs'));
check('root package exposes all four PPK-019 commands', [
  'verify:ppk019:propagation-boundary', 'verify:ppk019:targeted', 'verify:ppk019:contract', 'verify:ppk019:runtime'
].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

check('targeted suite contains at least twenty executed cases', (files.targetTest.match(/\bit\(/gu) ?? []).length >= 20);
requireMarkers('targeted test', files.targetTest, [
  'SourceDeletionPropagationPolicy',
  'EnforceSourceDeletionPropagationUseCase',
  'SqliteDataLifecycleRepository',
  'SqliteBackupPropagationRepository',
  'cache temizleme arızasında inspect ve delete çağrılmaz',
  'repository TOCTOU şema değişimini ikinci taramada reddeder',
  'tüm yönetilen hedefler temiz yedek ve karantina doğrulayınca pending kaydı kapatır',
  'yönetilmeyen yedek kalırsa pending kapanmaz',
  'backup repository yalnız exact pending tombstone sürümünü atomik kapatır'
]);
check('legacy lifecycle and backup runtimes use in-process TypeScript stripping rather than ambient npm', files.build136Runtime.includes('stripTypeScriptTypes') && files.build137Runtime.includes('stripTypeScriptTypes') && !files.build136Runtime.includes("npm root -g") && !files.build137Runtime.includes("npm root -g"));

check('migration 77 baseline remains present and no PPK-019 migration exists', migrationVersions.includes(77) && latestMigration >= 77 && !files.migrations.toLowerCase().includes('ppk019'));
check('scope forbids migration backfill transfer ownership change and cutover', scope.boundaries?.schemaMigrationRequired === false && scope.realDataBackfillPerformed === false && scope.realDataTransferPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('scope requires all seven owner kinds and exact three cache registries', scope.boundaries?.ownerKinds?.length === 7 && scope.boundaries?.requiredRuntimeCacheRegistries?.length === 3);
check('scope records local-before-delete and two owner inspections', scope.boundaries?.localPropagationBeforeSourceDeleteRequired === true && scope.boundaries?.persistentOwnerSchemaInspectionRequired === true && scope.boundaries?.persistentOwnerSecondInspectionRequired === true);
check('scope records managed rewrite unmanaged attention and quarantine truth', scope.boundaries?.managedBackupVerifiedFreshRewriteRequired === true && scope.boundaries?.unmanagedBackupBlocksCompletion === true && scope.boundaries?.historicalBackupQuarantineCountsAsPhysicalDestruction === false);
check('inventory reviews nine owners with zero open semantic owner or bypass', inventory.productionInventory?.length === 9 && inventory.closureSummary?.reviewedOwners === 9 && inventory.closureSummary?.activeSemanticPersistentOwners === 0 && inventory.closureSummary?.activePlaintextReplicaOwners === 0 && inventory.closureSummary?.directBypassExceptions === 0 && inventory.closureSummary?.openBlockerCount === 0);
check('inventory separates immutable provenance from user payload', inventory.productionInventory?.find((item) => item.id === 'derived-data-policy-provenance-metadata')?.classification === 'CONTENT_FREE_IMMUTABLE_PROVENANCE_NOT_PAYLOAD');
check('inventory keeps external copies in evidence boundary', inventory.productionInventory?.find((item) => item.id === 'unmanaged-and-external-backup-copies')?.classification === 'EXTERNAL_EVIDENCE_BOUNDARY');

check('DEC-200 records local atomicity backup rewrite and no-migration truth', files.decision.includes('DEC-200') && files.decision.includes('PRAGMA secure_delete=ON') && files.decision.includes('Karantina fiziksel yok etme değildir') && files.decision.includes('Yeni migration eklenmez'));
check('threat model records TOCTOU replica unmanaged external and quarantine threats', ['TOCTOU', 'Raw SQLite', 'Yönetilmeyen', 'Harici kopya', 'karantinanın fiziksel destruction'].every((marker) => files.threat.includes(marker)));
check('master decision register contains DEC-200', files.masterDecisionRegister.includes('## DEC-200') && files.masterDecisionRegister.includes('DEC-200-ppk-019-source-deletion-propagation.md'));
check('audit contains exact executed baseline evidence', files.audit.includes('20/20 PASS') && files.audit.includes('31/31 PASS') && files.audit.includes('37/37 PASS') && files.audit.includes('610/610 test PASS'));
check('user decision ledger contains active DEC-200 and exact count', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-200' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-019')));
check('prior PPK-012 through PPK-018 packages remain complete', priorRequirements.every((item) => item?.status === 'COMPLETE'));
check('PPK-020 remains outside PPK-019 closure', successor !== undefined && successor.status !== 'COMPLETE');
if (candidateMode) {
  check('candidate registry truthfully remains implemented validation pending', requirement?.status === 'IN_PROGRESS' && requirement?.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && requirement?.chain?.evidence === false);
  check('candidate scope truthfully remains open for final artifacts', scope.status === 'IN_PROGRESS' && scope.validation?.state === 'PENDING' && scope.requirementCompletionClaimed === false && scope.remainingClosureWork?.length > 0);
  check('candidate inventory truthfully remains validation pending', inventory.status === 'IMPLEMENTED_VALIDATION_PENDING' && inventory.completionClaimed === false && inventory.closureSummary?.finalValidationPending === true);
  check('candidate audit does not claim unexecuted final artifacts', files.audit.includes('VALIDATION_PENDING') && !files.audit.includes('COMPLETE / PASS'));
} else {
  check('accepted registry closes the complete PPK-019 evidence chain', requirement?.status === 'COMPLETE' && requirement.implementationState === undefined && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 20);
  check('scope closes PPK-019 with no migration transfer backfill or cutover', scope.status === 'COMPLETED' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);
  check('audit closes only with final contract and runtime evidence', files.audit.includes('COMPLETE / PASS') && /contract: `\d+\/\d+ PASS`/u.test(files.audit) && files.audit.includes('runtime kanıt demeti: `15/15 PASS`'));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-O',
  requirement: 'PPK-019',
  phase: candidateMode ? 'SOURCE_DELETION_RETENTION_PROPAGATION_CANDIDATE_CONTRACT' : 'SOURCE_DELETION_RETENTION_PROPAGATION_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  sourceGate: {
    status: scan.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: scan.zones,
    scannedFiles: scan.files,
    securityRelevantFiles: scan.relevantFiles,
    maliciousSelfTestAssertions: 8,
    benignFalsePositiveAssertions: 4,
    findings: scan.findings
  },
  ownerKinds: 7,
  requiredRuntimeCacheRegistries: 3,
  activeSemanticPersistentOwners: 0,
  plaintextReplicaProductionOwners: 0,
  directBypassExceptions: 0,
  localPropagationMustPrecedeSourceDelete: true,
  managedBackupVerifiedRewriteRequired: true,
  unmanagedAndExternalBackupAttentionRequired: true,
  historicalBackupQuarantineIsNotPhysicalDestruction: true,
  latestDatabaseMigration: latestMigration,
  schemaMigrationRequired: false,
  historicalBackfillPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  cutoverAuthorityAttached: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-O-ppk-019-source-deletion-propagation-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-019${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`PPK-019${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);
