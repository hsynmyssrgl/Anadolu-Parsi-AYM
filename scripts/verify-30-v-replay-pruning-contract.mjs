import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-V-replay-pruning-contract.json';
const paths = {
  authority: 'artifacts/authority/30-V_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-V_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-v-expired-replay-reservation-pruning-scope.json',
  statusReport: 'artifacts/inventory/30-V_SCOPE_AND_STATUS_REPORT.json',
  decision: 'docs/decisions/DEC-147-ppk-002-expired-replay-reservation-pruning.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  productionRuntime: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  pruningTest: 'apps/desktop/tests/archive-replay-reservation-pruning.test.ts',
  durableRuntimeTest: 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
  productionRuntimeTest: 'apps/desktop/tests/archive-production-policy-runtime.test.ts',
  predecessorCompletion: 'artifacts/checkpoints/30-U_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-U_LIBRARY_RECEIPT.json',
  predecessorTransition: 'artifacts/validation/30-U_COMPLETION_TRANSITION_VALIDATION.json',
  typecheckFailure: 'artifacts/validation/30-V_ROOT_TYPECHECK_FIRST_ATTEMPT_NODE_PATH_FAILURE.json',
  packageJson: 'package.json'
};

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(path, 'utf8')
])));
const json = (key) => JSON.parse(source[key]);
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
const contains = (key, marker, name) => check(source[key].includes(marker), name, { path: paths[key], marker });
const inOrder = (key, markers, name) => {
  let cursor = -1;
  for (const marker of markers) {
    cursor = source[key].indexOf(marker, cursor + 1);
    if (cursor < 0) break;
  }
  check(cursor >= 0, name, { path: paths[key], markers });
};

const authority = json('authority');
const selection = json('selection');
const scope = json('scope');
const statusReport = json('statusReport');
const plan = json('plan');
const ledger = json('ledger');
const registry = json('registry');
const predecessorCompletion = json('predecessorCompletion');
const predecessorReceipt = json('predecessorReceipt');
const predecessorTransition = json('predecessorTransition');
const typecheckFailure = json('typecheckFailure');
const packageJson = json('packageJson');

check(authority.step === '30-V' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-V/PPK-002');
check(authority.selectedPriority === 'P0' && authority.targetedBoundary === 'expiredUnusedReplayReservationPruning', 'authority selects the expired-unused replay pruning boundary');
check(authority.predecessor?.step === '30-U' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'authority binds the completed persistent predecessor');
check(authority.mandatoryTruthSentence === TRUTH, 'authority preserves the truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === 14 && selection.semanticExpected === 14, 'priority selection is 14/14 semantic PASS');
check(selection.processPassed === 5 && selection.processExpected === 5 && selection.processFailed === 0, 'priority selection is 5/5 process PASS');

check(scope.step === '30-V' && scope.scope === 'EXPIRED_UNUSED_REPLAY_RESERVATION_PRUNING_AND_RETENTION_ENFORCEMENT', 'scope has the canonical 30-V identity');
check(scope.targets?.length === 6 && new Set(scope.targets.map((target) => target.id)).size === 6, 'scope declares six unique targets');
check(scope.evidenceBoundary?.expiredUnusedReplayReservationPruning === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the target');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal enforcement open');
check(scope.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED', 'scope keeps external monotonic authority open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');
const localPass = statusReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
check(
  (localPass && statusReport.targetSliceStatus === 'PASS' && statusReport.persistentReceiptStatus === 'PENDING')
    || statusReport.status === 'IN_PROGRESS_SELECTION_LOCKED_IMPLEMENTATION_NOT_YET_PASS',
  'status report matches the receipt-bounded lifecycle phase'
);
check(statusReport.preservedFailedAttempts === (localPass ? 3 : 1) && statusReport.failedAttemptsCountedAsPass === 0, 'status report preserves every failed attempt without PASS credit');

contains('decision', '# DEC-147', 'DEC-147 heading exists');
contains('decision', 'sınırlı ve deterministik gruplar', 'DEC-147 requires bounded deterministic pruning');
contains('decision', 'haricî monoton otorite', 'DEC-147 keeps external monotonic authority open');
contains('decision', 'PPK-002 `PARTIAL`', 'DEC-147 preserves the requirement boundary');

const active = plan.steps.filter((step) => step.status === 'IN_PROGRESS');
const selectedStep = active.find((step) => step.id === '30-V');
check(plan.currentStep === '30-V' && active.length === 1, 'work plan has exactly one active 30-V step');
check(selectedStep?.persistentReceiptStatus === 'PENDING' && selectedStep?.validationStatus === (localPass ? 'PASS' : 'PENDING'), 'work plan matches the receipt-bounded validation phase');
check(ledger.activeMicroStep === '30-V' && ledger.nextOfficialTask === `30-V ${authority.selectedTask}`, 'governance ledger selects the exact 30-V task');
check(
  ledger.libraryUploadStatus === (localPass
    ? '30-V_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
    : '30-V_IN_PROGRESS_PREDECESSOR_30-U_RECEIPT_CHAIN_PASS'),
  'ledger distinguishes local validation from persistent completion'
);
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.chain?.repository === false, 'accepted scope keeps PPK-002 PARTIAL');
check(ppk002?.evidence?.includes('artifacts/validation/30-V_PRIORITY_SELECTION_VALIDATION.json'), 'registry binds the 30-V selection evidence');

for (const marker of [
  'PlatformPolicyReplayPruningInput',
  'readonly cutoffMs: number',
  'readonly limit: number',
  'PlatformPolicyReplayPruningResult',
  'readonly prunedCount: number',
  'readonly hasMore: boolean',
  'pruneExpiredUnusedReplayReservations'
]) contains('repositoryContract', marker, `repository contract declares ${marker}`);

contains('migration', "createMigrationDefinition(62, 'expired_replay_reservation_pruning'", 'migration 62 is registered');
contains('migration', 'CREATE TABLE platform_policy_replay_pruning_state', 'migration creates durable pruning state');
contains('migration', "VALUES('archive',0,'1970-01-01T00:00:00.000Z')", 'migration initializes a deterministic local cutoff');
contains('migration', 'trg_platform_policy_replay_pruning_state_update', 'database guards cutoff monotonicity');
contains('migration', 'NEW.cutoff_ms<OLD.cutoff_ms', 'database rejects cutoff regression');
contains('migration', 'trg_platform_policy_replay_pruning_state_delete', 'database prevents watermark deletion');
contains('migration', 'OLD.expires_at_ms>=COALESCE', 'database uses an exclusive expiry cutoff');
contains('migration', 'WHERE receipt.nonce=OLD.nonce', 'database protects receipt-consumed reservations');
contains('migration', 'platform policy replay reservation is not expired and unused at the durable cutoff', 'database deletion guard fails closed');
contains('migration', 'REVISION-30-V-PPK-002-EXPIRED-REPLAY-RESERVATION-PRUNING', 'schema generation records 30-V');

contains('repository', 'MAX_REPLAY_PRUNING_BATCH_SIZE = 500', 'repository has a finite maximum pruning batch');
contains('repository', 'input.limit < 1', 'repository rejects empty pruning requests');
contains('repository', 'input.limit > MAX_REPLAY_PRUNING_BATCH_SIZE', 'repository rejects over-broad pruning requests');
contains('repository', 'input.cutoffMs < currentCutoffMs', 'repository rejects cutoff regression');
contains('repository', "WHERE scope='archive' AND cutoff_ms=?", 'repository advances the exact observed watermark');
inOrder('repository', [
  'public pruneExpiredUnusedReplayReservations(',
  'UPDATE platform_policy_replay_pruning_state',
  'DELETE FROM platform_policy_replay_reservations',
  'ORDER BY reservation.expires_at_ms,reservation.nonce',
  'LIMIT ?',
  'hasMore: remaining !== undefined'
], 'repository advances, deletes a deterministic bounded batch and reports remaining work');
contains('repository', 'WHERE reservation.expires_at_ms<?', 'repository only selects strictly expired reservations');
contains('repository', 'WHERE receipt.nonce=reservation.nonce', 'repository excludes consumed reservations');

contains('productionRuntime', 'REPLAY_PRUNING_BATCH_SIZE = 128', 'production uses a finite pruning batch');
inOrder('productionRuntime', [
  'const execution = repositoryContext(context, transaction);',
  'pruneExpiredUnusedReplayReservations(',
  '{ cutoffMs: reservation.reservedAtMs, limit: REPLAY_PRUNING_BATCH_SIZE }',
  'if (!pruned.ok) return pruned;',
  'reserveReplayNonce(execution, reservation)'
], 'production prunes fail-closed before reserving in the same transaction callback');

check((source.pruningTest.match(/\bit\(/gu) ?? []).length === 4, 'focused pruning runtime declares four tests');
for (const marker of [
  'prunes deterministic bounded batches',
  'keeps the cutoff exclusive',
  'rejects regressing cutoffs and invalid or unbounded batch sizes',
  'persists the monotonic cutoff across SQLite close and reopen'
]) contains('pruningTest', marker, `focused pruning runtime covers ${marker}`);
contains('durableRuntimeTest', 'never prunes a replay reservation consumed by a durable receipt', 'durable runtime protects consumed reservations');
contains('durableRuntimeTest', ").run('nonce-30v-consumed')).toThrow(/not expired and unused/u)", 'durable runtime tests direct-delete protection');
contains('productionRuntimeTest', 'nonce-30v-production-expired-unused', 'production runtime seeds an expired unused reservation');
contains('productionRuntimeTest', "SELECT cutoff_ms FROM platform_policy_replay_pruning_state WHERE scope='archive'", 'production runtime verifies the persisted cutoff');

check(predecessorCompletion.step === '30-U' && predecessorCompletion.officialStepStatus === 'COMPLETED', '30-U predecessor remains completed');
check(predecessorReceipt.status === 'PASS' && predecessorTransition.status === 'PASS', '30-U receipt and completion transition remain PASS');
check(typecheckFailure.status === 'FAIL' && typecheckFailure.exitCode === 1 && typecheckFailure.countedAsPass === false, 'initial typecheck PATH failure remains preserved FAIL and NOT_PASS');
check(packageJson.scripts?.['verify:30-v:replay-pruning-contract'] === 'node scripts/verify-30-v-replay-pruning-contract.mjs', 'package exposes the 30-V contract gate');
check(packageJson.scripts?.['verify:30-v:replay-pruning-runtime'] === 'node scripts/verify-30-v-replay-pruning-runtime.mjs', 'package exposes the 30-V runtime gate');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-V',
  requirement: 'PPK-002',
  phase: 'EXPIRED_UNUSED_REPLAY_RESERVATION_PRUNING_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  evidenceBoundary: {
    ...scope.evidenceBoundary,
    expiredUnusedReplayReservationPruning: localPass ? 'TARGETED_PASS' : 'TARGETED_NOT_YET_PASS'
  },
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-V replay pruning contract: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-V replay pruning contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
