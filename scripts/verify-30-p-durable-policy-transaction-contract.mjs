import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const requestedAttempt = process.argv.find((argument) => argument.startsWith('--attempt='))?.slice('--attempt='.length);
const reportPath = requestedAttempt === 'clean'
  ? 'artifacts/validation/30-P-durable-policy-transaction-contract-clean.json'
  : 'artifacts/validation/30-P-durable-policy-transaction-contract.json';
const EXPECTED_CHECK_COUNT = 141;
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const paths = {
  scope: 'config/30-p-durable-policy-transaction-scope.json',
  decision: 'docs/decisions/DEC-141-ppk-002-durable-policy-transaction-replay-and-fencing.md',
  migration: 'packages/database/src/family-database-migrations.ts',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  repositoryContractIndex: 'packages/repository-contracts/src/index.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  repositoryIndex: 'packages/repositories/src/index.ts',
  policy: 'packages/platform-policy/src/policy-enforcement-point.ts',
  runtime: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  receiptSink: 'apps/desktop/src/main/platform-policy-receipt-file-sink.ts',
  adapter: 'apps/desktop/src/main/archive-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  audit: 'packages/repositories/src/audit-repository.ts',
  outbox: 'packages/repositories/src/outbox-repository.ts',
  focusedTest: 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
  raceChild: 'scripts/fixtures/30-p-sqlite-race-child.mjs',
  raceLoader: 'scripts/fixtures/30-p-ts-workspace-loader.mjs',
  runtimeVerifier: 'scripts/verify-30-p-durable-policy-transaction-runtime.mjs',
  vitestConfig: 'vitest.config.ts',
  package: 'package.json'
};

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(path, 'utf8')
])));
const scope = JSON.parse(source.scope);
const packageJson = JSON.parse(source.package);
const checks = [];
const failures = [];
const check = (condition, name) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
  if (!condition) failures.push(name);
};
const contains = (text, marker, name) => check(text.includes(marker), name);
const inOrder = (text, markers) => {
  let cursor = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker, cursor + 1);
    if (index < 0) return false;
    cursor = index;
  }
  return true;
};

// Canonical authority and bounded scope.
check(scope.step === '30-P' && scope.requirement === 'PPK-002', 'scope binds 30-P and PPK-002');
check(scope.scope === 'ARCHIVE_DURABLE_POLICY_TRANSACTION_REPLAY_FENCING_AND_ATOMIC_RECEIPT_SLICE', 'scope has the canonical archive durable transaction identity');
check(scope.predecessor?.step === '30-O' && scope.predecessor?.productionArchiveCompositionSlice === 'PASS' && scope.predecessor?.persistentReceiptStatus === 'PASS', 'scope binds completed 30-O predecessor and persistent receipt');
check(Array.isArray(scope.targets) && scope.targets.length === 7, 'scope declares exactly seven integrity targets');
check(new Set(scope.targets?.map((item) => item.id)).size === 7, 'scope target identifiers are unique');
check([
  'durable-sqlite-replay-reservation',
  'database-enforced-write-fence',
  'atomic-policy-receipt-and-business-commit',
  'archive-audit-outbox-receipt-binding',
  'durable-protected-journal-projection',
  'crash-restart-recovery',
  'two-process-race-runtime'
].every((id) => scope.targets?.some((target) => target.id === id)), 'scope includes every canonical 30-P target');
check(Array.isArray(scope.requiredOrder) && scope.requiredOrder.length === 12, 'scope declares the complete twelve-stage enforcement order');
check(scope.requiredOrder?.[1] === 'durable-replay-reservation' && scope.requiredOrder?.[4] === 'database-fence-validation' && scope.requiredOrder?.[6] === 'atomic-policy-receipt-insert', 'scope keeps critical replay, fence and receipt positions');
check(scope.requiredOrder?.[9] === 'sqlite-business-transaction-commit' && scope.requiredOrder?.[10] === 'protected-journal-projection-and-readback' && scope.requiredOrder?.[11] === 'transactional-projection-acknowledgement', 'scope orders projection and acknowledgement strictly after SQLite commit');
check(scope.runtimeProofRequirements?.actualSQLiteDatabase === true && scope.runtimeProofRequirements?.realTransactionBoundary === true, 'scope requires real SQLite and transaction boundaries');
check(scope.runtimeProofRequirements?.twoIndependentProcesses === true && scope.runtimeProofRequirements?.durableReplayAcrossRestart === true, 'scope requires independent processes and restart durability');
check(scope.runtimeProofRequirements?.duplicateNonceRejected === true && scope.runtimeProofRequirements?.duplicateCorrelationRejected === true && scope.runtimeProofRequirements?.staleFenceRejected === true, 'scope requires nonce, correlation and stale-fence rejection');
check(scope.runtimeProofRequirements?.receiptAndBusinessCommitTogether === true && scope.runtimeProofRequirements?.auditAndOutboxReceiptBinding === true && scope.runtimeProofRequirements?.rollbackRemovesAllTransactionalRows === true, 'scope requires atomic receipt/business/audit/outbox commit and rollback');
check(scope.runtimeProofRequirements?.idempotentProtectedJournalProjection === true && scope.runtimeProofRequirements?.trustedProjectionReadback === true, 'scope requires idempotent trusted projection readback');
check(scope.runtimeProofRequirements?.legacyAuthorizationFallback === false, 'scope forbids legacy authorization fallback');

// DEC-141 and mandatory evidence boundaries.
contains(source.decision, '# DEC-141', 'DEC-141 heading is present');
contains(source.decision, 'PPK-002 `PARTIAL`', 'DEC-141 keeps PPK-002 PARTIAL');
contains(source.decision, 'gerçek SQLite', 'DEC-141 requires real SQLite persistence');
contains(source.decision, 'çok-süreç', 'DEC-141 binds multi-process replay protection');
contains(source.decision, 'commit veya rollback', 'DEC-141 binds atomic commit or rollback');
contains(source.decision, 'idempotent', 'DEC-141 binds idempotent protected-journal projection');
contains(source.decision, 'gerçek süreç çıkış kodlarıyla', 'DEC-141 requires real process exit codes');
contains(source.decision, 'evrensel repository enforcement', 'DEC-141 preserves universal repository enforcement boundary');
contains(source.decision, 'complete-tail rollback detection `NOT_IMPLEMENTED`', 'DEC-141 preserves complete-tail rollback boundary');
check(source.decision.includes('Windows Hello') && source.decision.includes('`NOT_RUN_NOT_PASS`'), 'DEC-141 preserves native Windows Hello NOT_RUN_NOT_PASS');
contains(source.decision, truth, 'DEC-141 preserves the mandatory truth sentence');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal repository enforcement NOT_COMPLETE');
check(scope.evidenceBoundary?.completeTailJournalRollbackDetection === 'NOT_IMPLEMENTED', 'scope keeps complete-tail rollback detection NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS', 'scope keeps policy obligations NOT_RUN_NOT_PASS');
check(scope.evidenceBoundary?.auditAndOutboxRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal audit/outbox repository enforcement NOT_COMPLETE');
check(scope.evidenceBoundary?.eventAttachmentCrossAggregateReceiptBinding === 'NOT_COMPLETE', 'scope keeps cross-aggregate receipt binding NOT_COMPLETE');
check(scope.evidenceBoundary?.secureFileDeletionAndDatabaseCommitAtomicity === 'NOT_IMPLEMENTED', 'scope keeps secure file deletion/database atomicity NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.installedCoreServiceRegistrationAndScmLifecycle === 'NOT_RUN_NOT_PASS', 'scope keeps installed Core Service/SCM NOT_RUN_NOT_PASS');
check(scope.evidenceBoundary?.protectedCoreServiceAuthorityProvisioningRotationAndAcl === 'NOT_IMPLEMENTED', 'scope keeps protected authority provisioning/rotation/ACL NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');
check(scope.mandatoryTruthSentence === truth, 'scope preserves the mandatory truth sentence');

// Migration 56: durable replay, fence, receipt, projection and binding schema.
contains(source.migration, "createMigrationDefinition(56, 'durable_platform_policy_transactions'", 'migration 56 is registered under the canonical name');
contains(source.migration, 'CREATE TABLE platform_policy_replay_reservations', 'migration creates durable replay reservations');
contains(source.migration, 'nonce TEXT PRIMARY KEY', 'replay nonce is a primary key');
contains(source.migration, 'expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>reserved_at_ms)', 'replay reservations have a bounded valid interval');
contains(source.repository, 'WHERE platform_policy_replay_reservations.expires_at_ms<excluded.reserved_at_ms', 'repository only replaces a reservation after expiry');
contains(source.migration, 'trg_platform_policy_replay_delete', 'replay reservation deletion is blocked');
contains(source.migration, 'CREATE TABLE platform_policy_database_fences', 'migration creates the durable database fence');
contains(source.migration, 'NEW.epoch<OLD.epoch', 'database fence rejects epoch regression');
contains(source.migration, 'NEW.epoch=OLD.epoch AND NEW.writable>OLD.writable', 'database fence rejects same-epoch writable widening');
contains(source.migration, 'julianday(NEW.synchronized_at)<julianday(OLD.synchronized_at)', 'database fence rejects timestamp regression');
contains(source.migration, 'CREATE TABLE platform_policy_transaction_receipts', 'migration creates transactional policy receipts');
contains(source.migration, 'nonce TEXT NOT NULL UNIQUE REFERENCES platform_policy_replay_reservations(nonce) ON DELETE RESTRICT', 'receipt nonce is unique and references its durable reservation');
contains(source.migration, 'correlation_id TEXT NOT NULL UNIQUE', 'receipt correlation is unique');
contains(source.migration, 'fence_name TEXT NOT NULL REFERENCES platform_policy_database_fences', 'receipt binds a durable database fence');
contains(source.migration, 'trg_platform_policy_receipt_insert', 'receipt insert trigger is present');
contains(source.migration, 'reservation.expires_at_ms>=((julianday(NEW.recorded_at)-2440587.5)*86400000.0)-1.0', 'receipt insert requires an unexpired replay reservation through recordedAt');
contains(source.migration, "RAISE(ABORT,'platform policy receipt, context or database fence mismatch')", 'receipt/context/fence mismatch fails closed in SQLite');
contains(source.migration, 'trg_platform_policy_receipt_update', 'receipt updates are blocked');
contains(source.migration, 'trg_platform_policy_receipt_delete', 'receipt deletion is blocked');
contains(source.migration, 'CREATE TABLE platform_policy_journal_projection_outbox', 'migration creates durable journal projection outbox');
contains(source.migration, "status TEXT NOT NULL CHECK(status IN ('pending','projected'))", 'projection status is bounded');
contains(source.migration, 'trg_platform_policy_projection_insert', 'projection insert must match its receipt');
contains(source.migration, 'trg_platform_policy_projection_update', 'projection permits only the pending-to-projected transition');
contains(source.migration, 'trg_platform_policy_projection_delete', 'projection deletion is blocked');
check(['audit_log', 'event_outbox'].every((table) => source.migration.includes(`ALTER TABLE ${table} ADD COLUMN policy_receipt_hash`)), 'audit and outbox receive receipt hash bindings');
contains(source.migration, 'trg_audit_policy_binding_insert', 'audit binding insert trigger is present');
contains(source.migration, 'trg_audit_policy_binding_immutable', 'audit binding is immutable');
contains(source.migration, 'trg_event_outbox_policy_binding_insert', 'outbox binding insert trigger is present');
contains(source.migration, 'trg_event_outbox_policy_binding_immutable', 'outbox binding is immutable');
contains(source.migration, "REVISION-30-P-PPK-002-DURABLE-POLICY-TRANSACTION", 'migration updates the canonical schema generation');

// Repository contract and implementation.
check([
  'reserveReplayNonce', 'synchronizeFence', 'readFence', 'recordAuthorizedTransaction',
  'listPendingJournalProjections', 'acknowledgeJournalProjection', 'findReceiptByHash', 'findReceiptByNonce'
].every((method) => source.repositoryContract.includes(`${method}(`)), 'repository contract exposes all eight durable transaction methods');
contains(source.repositoryContract, 'readonly fenceWritable: true;', 'record contract only accepts a writable fence');
contains(source.repositoryContract, "readonly status: 'pending' | 'projected';", 'projection contract exposes bounded lifecycle');
contains(source.repositoryContractIndex, "export * from './platform-policy-transaction-repository.js';", 'repository contract index exports the 30-P port');
contains(source.repository, 'sha256Utf8(canonicalPlatformPolicyJson(receipt))', 'receipt hash is lowercase SHA-256 over canonical receipt JSON');
contains(source.repository, '.sort()', 'canonical receipt JSON sorts object keys');
contains(source.repository, 'export class SqlitePlatformPolicyTransactionRepository', 'SQLite durable policy transaction repository is exported');
check(inOrder(source.repository, ['assertRecordMatchesContext(context, input);', 'INSERT INTO platform_policy_transaction_receipts(', 'INSERT INTO platform_policy_journal_projection_outbox(']), 'repository validates context before inserting receipt then projection');
contains(source.repository, 'record.request.correlationId !== context.correlationId', 'repository rejects correlation binding mismatch');
contains(source.repository, 'canonicalPlatformPolicyJson(record.receipt) !== canonicalPlatformPolicyJson(authorization.receipt)', 'repository rejects exact receipt tamper');
contains(source.repository, 'WHERE status=\'pending\'', 'repository lists only pending journal projections');
contains(source.repository, "WHERE receipt_hash=? AND status='pending'", 'projection acknowledgement is idempotent');
contains(source.repositoryIndex, "export * from './platform-policy-transaction-repository.js';", 'repository index exports durable implementation and hash helper');
contains(source.audit, 'platformPolicyPersistenceBinding(context, input.resourceType, input.resourceId)', 'audit repository derives binding from active policy context');
check(inOrder(source.outbox, ['platformPolicyPersistenceBinding(', 'context,', 'event.aggregateType,', 'event.aggregateId,', 'event.correlationId']), 'outbox repository derives binding from active policy context');
contains(source.audit, 'policy_receipt_hash,policy_receipt_version,policy_receipt_nonce', 'audit insert persists receipt identity');
contains(source.outbox, 'policy_receipt_hash,policy_receipt_version,policy_receipt_nonce', 'outbox insert persists receipt identity');

// PEP, archive transaction and production composition wiring.
contains(source.policy, 'readonly fenceEpoch: number;', 'active policy context carries fence epoch');
contains(source.policy, 'readonly fenceWritable: boolean;', 'active policy context carries fence writability');
contains(source.policy, 'readonly receiptRecord: PlatformPolicyReceiptRecord;', 'active policy context carries exact receipt record');
contains(source.policy, 'ensure?(record: PlatformPolicyReceiptRecord)', 'receipt sink exposes optional exact idempotent ensure');
contains(source.policy, 'readonly deferAllowedReceiptPersistence?: boolean;', 'PEP exposes bounded allowed-receipt deferral');
contains(source.policy, "Deferred policy receipt persistence requires an idempotent exact receipt sink", 'deferred PEP mode fails closed without ensure');
check(inOrder(source.policy, ['if (!authorization.decision.allowed)', 'await this.#appendReceipt(', 'if (!this.#deferAllowedReceiptPersistence)', 'const context: PlatformPolicyTransactionContext']), 'denials persist immediately while only allowed receipts may be deferred');
contains(source.adapter, 'readonly requiresDurableTransactionReceipt?: true;', 'archive adapter exposes the durable marker');
contains(source.adapter, 'readonly recordAuthorizedTransaction?:', 'archive adapter exposes same-transaction receipt hook');
contains(source.adapter, 'readonly projectCommittedTransaction?:', 'archive adapter exposes post-commit projection hook');
contains(source.adapter, 'Archive production durable policy receipt boundary is incomplete', 'archive adapter fails closed on incomplete durable composition');
check(inOrder(source.adapter, ['const recorded = enforcementPoint.recordAuthorizedTransaction?.(input);', 'const operationResult = await operation(authorization, enforcementPoint);', 'if (operationResult.ok) committedAuthorization = authorization;', 'projectCommittedTransaction!']), 'archive adapter records through the governed transaction hook and projects only after successful transaction result');
contains(source.runtime, "const ARCHIVE_POLICY_FENCE_NAME = 'archive-write';", 'production runtime uses the canonical archive-write fence');
contains(source.runtime, 'policyTransactionRepository: PlatformPolicyTransactionRepositoryPort', 'production runtime requires the durable repository port');
contains(source.runtime, 'clusterFence: PlatformPolicyClusterFence', 'production runtime requires the live cluster fence');
contains(source.runtime, 'createDurableReplayStore', 'production runtime composes durable replay');
contains(source.runtime, 'synchronizeDatabaseFence', 'production runtime synchronizes the live fence into SQLite');
contains(source.runtime, 'recordAuthorizedProductionTransaction', 'production runtime records the authorized transaction');
contains(source.runtime, 'deferAllowedReceiptPersistence: true', 'production runtime defers allowed receipt persistence until commit');
check(inOrder(source.runtime, ['authorizationProvider.verify', 'ensureReceipt.call', 'acknowledgeJournalProjection']), 'startup and post-commit projection cryptographically verify before ensure then acknowledge');
contains(source.runtime, 'Archive policy pending receipt could not be cryptographically verified before journal projection.', 'projection verification false/throw fails closed');
contains(source.runtime, 'businessTransactionCommitted: false', 'resolver drains crash-left pending projections before new authorization');
contains(source.runtime, 'findReceiptByNonce', 'post-projection runtime confirms exact committed receipt by nonce');
contains(source.runtime, 'MAX_PROJECTION_DRAIN_ROUNDS', 'projection draining is bounded');
contains(source.composition, 'platformPolicyTransactionRepository: new SqlitePlatformPolicyTransactionRepository()', 'repository composition root constructs the durable repository');
contains(source.dataStore, 'policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository', 'DataStore wires the durable repository into archive production runtime');
contains(source.dataStore, 'clusterFence: productionArchivePolicy.clusterFence', 'DataStore wires the exact production fence');

// Controlled proof surfaces and actual two-process exit-code evidence.
check((source.focusedTest.match(/\bit\(/gu) ?? []).length === 15, 'focused Vitest declares exactly fifteen tests');
contains(source.focusedTest, 'persists replay reservations across a real SQLite close and restart', 'focused test covers durable restart replay');
contains(source.focusedTest, 'serializes duplicate correlations at the durable receipt table', 'focused test covers duplicate correlation');
contains(source.focusedTest, 'rejects a stale transaction fence and a same-epoch writable widening', 'focused test covers stale fence and widening');
contains(source.focusedTest, 'rolls back receipt, business mutation, audit, outbox and projection together', 'focused test covers full atomic rollback');
contains(source.focusedTest, 'blocks direct SQL bypass for missing or expired reservations, stale/read-only fences and correlation mismatch', 'focused test covers direct SQL bypass attempts');
contains(source.focusedTest, 'keeps startup projection pending and fails closed when trusted receipt verification is false or throws', 'focused test covers cryptographic recovery failure');
contains(source.focusedTest, 'recovers a dead projection lock and only an incomplete journal tail with forensic evidence', 'focused test covers controlled crash-tail recovery');
contains(source.receiptSink, 'public async ensure(', 'receipt sink retries exact projection asynchronously');
contains(source.receiptSink, 'POLICY_RECEIPT_JOURNAL_LOCK_TIMEOUT', 'receipt sink bounds live lock contention');
contains(source.receiptSink, '#repairIncompleteJournalTail()', 'receipt sink isolates incomplete-tail recovery');
contains(source.receiptSink, '.partial-tail.${originalHash}.recovery', 'receipt sink preserves forensic bytes before incomplete-tail truncation');
contains(source.focusedTest, "signature: `imza-İ-🚀-${String.fromCharCode(0xd800)}-", 'focused test covers Unicode and surrogate canonical hashing');
contains(source.focusedTest, "createHash('sha256').update(canonicalPlatformPolicyJson(unicodeReceipt), 'utf8').digest('hex')", 'focused test compares helper hash with node:crypto SHA-256');
contains(source.raceChild, 'process.exitCode = exitCode', 'race child returns actual domain exit codes');
contains(source.raceChild, "exitCode = 20", 'race child has duplicate nonce exit code');
contains(source.raceChild, "mode === 'correlation' ? 21", 'race child has duplicate correlation exit code');
contains(source.raceChild, "mode === 'stale' ? 22", 'race child has stale fence exit code');
check(['@ppt/core', '@ppt/database', '@ppt/platform-policy', '@ppt/repository-contracts', '@ppt/repositories'].every((specifier) => source.raceLoader.includes(`['${specifier}'`)), 'race loader maps every required workspace source package');
contains(source.vitestConfig, "'@ppt/platform-policy': workspaceSource('./packages/platform-policy/src/index.ts')", 'Vitest maps platform policy to current source instead of stale dist');
contains(source.runtimeVerifier, 'Promise.all([', 'runtime verifier starts each race through concurrent child processes');
contains(source.runtimeVerifier, "join(',') === '0,20'", 'runtime verifier requires duplicate nonce exit pair 0/20');
contains(source.runtimeVerifier, "join(',') === '0,21'", 'runtime verifier requires duplicate correlation exit pair 0/21');
contains(source.runtimeVerifier, "join(',') === '0,22'", 'runtime verifier requires fresh/stale fence exit pair 0/22');
contains(source.runtimeVerifier, 'new DatabaseSync(databasePath, { readOnly: true })', 'runtime verifier independently reads the race database');
contains(source.runtimeVerifier, 'PRAGMA integrity_check', 'runtime verifier requires SQLite integrity_check ok');
contains(source.runtimeVerifier, 'EXPECTED_VITEST_TESTS = 15', 'runtime verifier binds the exact focused Vitest count');
check(packageJson.scripts?.['verify:30-p:durable-policy-transaction-contract'] === 'node scripts/verify-30-p-durable-policy-transaction-contract.mjs --attempt=clean', 'package exposes the 30-P static contract gate');
check(packageJson.scripts?.['verify:30-p:durable-policy-transaction-runtime'] === 'node scripts/verify-30-p-durable-policy-transaction-runtime.mjs --attempt=clean-2', 'package exposes the 30-P controlled runtime gate');

check(checks.length + 1 === EXPECTED_CHECK_COUNT, 'static verifier executes the exact expected check count');
const status = failures.length === 0 && checks.length === EXPECTED_CHECK_COUNT ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: scope.release,
  step: '30-P',
  requirement: 'PPK-002',
  phase: 'DURABLE_POLICY_TRANSACTION_STATIC_CONTRACT',
  attempt: requestedAttempt ?? 'first',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  assertions: {
    canonicalAuthorityAndScope: failures.some((failure) => failure.startsWith('scope') || failure.startsWith('DEC-141')) ? 'FAIL' : 'PASS',
    durableReplayAndFenceSchema: failures.some((failure) => failure.includes('replay') || failure.includes('fence')) ? 'FAIL' : 'PASS',
    atomicReceiptAuditOutboxProjection: failures.some((failure) => failure.includes('receipt') || failure.includes('audit') || failure.includes('outbox') || failure.includes('projection')) ? 'FAIL' : 'PASS',
    productionRuntimeWiring: failures.some((failure) => failure.startsWith('production') || failure.startsWith('archive adapter') || failure.startsWith('DataStore')) ? 'FAIL' : 'PASS',
    controlledProofSurface: failures.some((failure) => failure.startsWith('focused') || failure.startsWith('race') || failure.startsWith('runtime verifier')) ? 'FAIL' : 'PASS'
  },
  evidenceBoundary: {
    PPK002: 'PARTIAL',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    completeTailJournalRollbackDetection: 'NOT_IMPLEMENTED',
    obligationExecution: 'NOT_RUN_NOT_PASS',
    auditAndOutboxRepositoryEnforcement: 'NOT_COMPLETE',
    eventAttachmentCrossAggregateReceiptBinding: 'NOT_COMPLETE',
    secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED',
    installedCoreServiceRegistrationAndScmLifecycle: 'NOT_RUN_NOT_PASS',
    protectedCoreServiceAuthorityProvisioningRotationAndAcl: 'NOT_IMPLEMENTED',
    nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
    requirementCompletionClaimed: false
  },
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: truth
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(failures.join('\n'));
  console.error(truth);
  process.exit(1);
}
console.log(`30-P durable policy transaction contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(truth);
