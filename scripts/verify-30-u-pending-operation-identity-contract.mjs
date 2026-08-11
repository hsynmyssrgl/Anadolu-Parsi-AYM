import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-U-pending-operation-identity-contract.json';
const paths = {
  authority: 'artifacts/authority/30-U_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-U_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-u-durable-pending-operation-identity-recovery-scope.json',
  statusReport: 'artifacts/inventory/30-U_SCOPE_AND_STATUS_REPORT.json',
  decision: 'docs/decisions/DEC-146-ppk-002-durable-pending-operation-identity-recovery.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  main: 'apps/desktop/src/main/main.ts',
  repositoryTest: 'apps/desktop/tests/archive-pending-operation-restart-runtime.test.ts',
  dataStoreTest: 'apps/desktop/tests/archive-pending-operation-data-store.test.ts',
  processWorker: 'scripts/30-u-pending-operation-process-worker.mjs',
  processVerifier: 'scripts/verify-30-u-pending-operation-process-runtime.mjs',
  processReport: 'artifacts/validation/30-U-pending-operation-process-runtime.json',
  predecessorCompletion: 'artifacts/checkpoints/30-T_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-T_LIBRARY_RECEIPT.json',
  predecessorTransition: 'artifacts/validation/30-T_COMPLETION_TRANSITION_VALIDATION.json',
  typecheckFailure: 'artifacts/validation/30-U_DESKTOP_TYPECHECK_FIRST_ATTEMPT_STALE_DECLARATION_FAILURE.json',
  dataStoreFailure: 'artifacts/validation/30-U_DATA_STORE_RESTART_TEST_FIRST_ATTEMPT_AUTH_ID_FAILURE.json',
  processFailure1: 'artifacts/validation/30-U_PROCESS_RUNTIME_FIRST_ATTEMPT_LOADER_PATH_FAILURE.json',
  processFailure2: 'artifacts/validation/30-U_PROCESS_RUNTIME_SECOND_ATTEMPT_TYPESCRIPT_STRIP_FAILURE.json',
  processFailure3: 'artifacts/validation/30-U_PROCESS_RUNTIME_THIRD_ATTEMPT_SOURCE_IMPORT_FAILURE.json',
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
const processReport = json('processReport');
const predecessorCompletion = json('predecessorCompletion');
const predecessorReceipt = json('predecessorReceipt');
const predecessorTransition = json('predecessorTransition');
const packageJson = json('packageJson');

check(authority.step === '30-U' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-U/PPK-002');
check(authority.selectedPriority === 'P0' && authority.targetedBoundary === 'rendererRestartPendingOperationIdentityRecovery', 'authority selects the restart-recovery P0 boundary');
check(authority.predecessor?.step === '30-T' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'authority binds the completed persistent predecessor');
check(authority.mandatoryTruthSentence === TRUTH, 'authority preserves the truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === selection.semanticExpected && selection.semanticExpected === 14, 'priority selection is 14/14 semantic PASS');
check(selection.processPassed === selection.processExpected && selection.processExpected === 5, 'priority selection is 5/5 process PASS');

check(scope.step === '30-U' && scope.scope === 'DURABLE_RENDERER_AND_APPLICATION_RESTART_PENDING_OPERATION_IDENTITY_RECOVERY', 'scope has the canonical 30-U identity');
check(scope.targets?.length === 6 && new Set(scope.targets.map((target) => target.id)).size === 6, 'scope declares six unique targets');
check(scope.evidenceBoundary?.rendererRestartPendingOperationIdentityRecovery === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the target');
check(scope.evidenceBoundary?.newCorrelationRetryIdempotencyAfterUnknownCommitOutcome === 'TARGETED_PASS', 'scope preserves the 30-T targeted PASS');
check(scope.evidenceBoundary?.expiredUnusedReplayReservationPruning === 'NOT_IMPLEMENTED', 'scope keeps unused-reservation pruning open');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal enforcement open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');
const localPass = statusReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
check(
  (localPass && statusReport.targetSliceStatus === 'PASS' && statusReport.persistentReceiptStatus === 'PENDING')
    || statusReport.status === 'IN_PROGRESS_SELECTION_LOCKED_IMPLEMENTATION_NOT_YET_PASS',
  'status report matches the current receipt-bounded lifecycle phase'
);
check(
  statusReport.cleanLocalEvidence?.prioritySelection === 'PASS_14_OF_14_SEMANTIC_AND_5_OF_5_PROCESS'
    && (!localPass || statusReport.cleanLocalEvidence?.governedFinalValidation === 'PASS_24_OF_24'),
  'status report binds the evidence required by its lifecycle phase'
);

contains('decision', '# DEC-146', 'DEC-146 heading exists');
contains('decision', 'renderer veya uygulama yeniden başladığında', 'DEC-146 names both restart boundaries');
contains('decision', 'exactly-once', 'DEC-146 requires exactly-once evidence');
contains('decision', 'PPK-002 `PARTIAL`', 'DEC-146 preserves the requirement boundary');

const active = plan.steps.filter((step) => step.status === 'IN_PROGRESS');
const selectedStep = active.find((step) => step.id === '30-U');
check(plan.currentStep === '30-U' && active.length === 1, 'work plan has exactly one active 30-U step');
check(
  selectedStep?.persistentReceiptStatus === 'PENDING'
    && selectedStep?.validationStatus === (localPass ? 'PASS' : 'PENDING'),
  'work plan matches the receipt-bounded validation phase'
);
check(ledger.activeMicroStep === '30-U' && ledger.nextOfficialTask.startsWith('30-U PPK-002'), 'governance ledger selects the exact 30-U task');
check(
  ledger.libraryUploadStatus === (localPass
    ? '30-U_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
    : '30-U_IN_PROGRESS_PREDECESSOR_30-T_RECEIPT_CHAIN_PASS'),
  'ledger distinguishes local validation from persistent completion'
);
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.chain?.repository === false, 'accepted scope keeps PPK-002 PARTIAL');
check(ppk002?.evidence?.includes('artifacts/validation/30-U_PRIORITY_SELECTION_VALIDATION.json'), 'registry binds the 30-U selection evidence');

for (const marker of [
  'PlatformPolicyArchivePendingOperationMutation',
  'PlatformPolicyArchivePendingOperationIdentityInput',
  'BindPlatformPolicyArchivePendingOperationInput',
  'PlatformPolicyArchivePendingOperationRecord',
  'acquireArchivePendingOperation',
  'bindArchivePendingOperation',
  'acknowledgeArchivePendingOperation',
  'findArchivePendingOperation'
]) contains('repositoryContract', marker, `repository contract declares ${marker}`);

contains('migration', "createMigrationDefinition(61, 'archive_pending_operation_identity_recovery'", 'migration 61 is registered');
contains('migration', 'CREATE TABLE platform_policy_archive_pending_operations', 'migration creates the durable pending identity table');
contains('migration', 'idx_platform_policy_archive_pending_intent', 'migration has one unacknowledged identity per canonical intent');
contains('migration', 'WHERE acknowledged_at IS NULL', 'pending uniqueness excludes acknowledged history');
contains('migration', 'trg_platform_policy_archive_pending_operation_update', 'database restricts pending-identity transitions');
contains('migration', 'trg_platform_policy_archive_pending_operation_acknowledgement', 'database validates acknowledgement outcomes');
contains('migration', 'trg_platform_policy_archive_operation_pending_binding', 'operation insert validates an existing pending binding');
contains('migration', 'archive pending operation recovery evidence is durable', 'pending recovery evidence deletion is blocked');
contains('migration', 'REVISION-30-U-PPK-002-DURABLE-PENDING-OPERATION-IDENTITY-RECOVERY', 'schema generation records 30-U');

contains('repository', 'ARCHIVE_PENDING_OPERATION_MUTATIONS', 'repository has a closed mutation allowlist');
contains('repository', 'assertArchivePendingOperationIdentity', 'repository validates actor-bound intent identity');
contains('repository', 'context.actor.userId !== input.actorAccountId', 'repository rejects actor mismatch');
inOrder('repository', [
  'public acquireArchivePendingOperation(',
  'INSERT INTO platform_policy_archive_pending_operations(',
  'ON CONFLICT DO NOTHING',
  'acknowledged_at IS NULL'
], 'repository atomically creates or recovers one open identity');
contains('repository', 'Archive pending operation acquisition resolved a conflicting durable identity', 'repository fails closed on ambiguous acquisition');
contains('repository', 'Archive pending operation was rebound to a different operation fingerprint', 'repository rejects final fingerprint rebinding');
contains('repository', "acknowledgementKind = 'completed'", 'repository distinguishes committed acknowledgement');
contains('repository', "acknowledgementKind = 'cancelled'", 'repository distinguishes side-effect-free cancellation');
contains('repository', 'Committed archive operation cannot be acknowledged without a pending-operation binding', 'repository rejects missing binding after commit');

contains('dataStore', 'ArchivePendingOperationIntentInput', 'DataStore exposes a typed pending intent');
contains('dataStore', '#archivePendingIntentIdentity(', 'DataStore derives canonical actor/family intent identity');
contains('dataStore', "createHash('sha256').update(canonicalIntent", 'DataStore hashes the canonical pending intent');
contains('dataStore', '#bindArchivePendingOperation(context, pendingMutation)', 'DataStore binds before governed archive execution');
contains('dataStore', 'public acquireArchivePendingOperationIdentity(', 'DataStore exposes durable acquisition');
contains('dataStore', 'public requireArchivePendingOperationIdentity(', 'DataStore exposes production pending-identity enforcement');
contains('dataStore', 'public acknowledgeArchivePendingOperationIdentity(', 'DataStore exposes explicit acknowledgement');
contains('dataStore', "operationId: candidateOperationId", 'DataStore supplies a collision-resistant candidate');
contains('dataStore', 'recovered: acquired.value.operationId !== candidateOperationId', 'DataStore reports recovered identities');

contains('preload', 'ArchiveMutationChannel', 'preload has a closed archive mutation channel union');
contains('preload', "'archive:operationIdentity:acquire'", 'preload invokes durable identity acquisition');
contains('preload', "'archive:operationIdentity:acknowledge'", 'preload invokes explicit acknowledgement');
inOrder('preload', [
  "'archive:operationIdentity:acquire'",
  'const result = await invoke<TResult>(channel',
  "'archive:operationIdentity:acknowledge'",
  'archiveMutationRetries.delete(retryKey)'
], 'preload acquires, mutates, acknowledges and only then clears retry state');
contains('preload', 'if (state?.inflight) return state.inflight', 'preload coalesces concurrent identical renderer calls');
contains('preload', 'delete state.inflight', 'preload retains acquired identity after an unknown failure');
contains('preload', 'acknowledged.intentFingerprint !== retryState.intentFingerprint', 'preload verifies acknowledgement identity');
contains('main', "'archive:operationIdentity:acquire'", 'main registers the acquisition IPC boundary');
contains('main', "'archive:operationIdentity:acknowledge'", 'main registers the acknowledgement IPC boundary');
contains('main', 'store().acknowledgeArchivePendingOperationIdentity(input)', 'main delegates acknowledgement to authenticated DataStore state');
check((source.main.match(/requireArchivePendingOperationIdentity/gu) ?? []).length === 7, 'all seven production archive mutation handlers require a durable pending identity');
inOrder('main', [
  "registerIpcHandler('archive:import'",
  'requireArchivePendingOperationIdentity',
  'dialog.showOpenDialog'
], 'archive import verifies the durable identity before opening the file boundary');

check((source.repositoryTest.match(/\bit\(/gu) ?? []).length === 3, 'repository focused runtime declares three tests');
check((source.dataStoreTest.match(/\bit\(/gu) ?? []).length === 1, 'DataStore focused runtime declares one test');
for (const marker of [
  'SQLite restart and replays the business mutation exactly once',
  'coalesces concurrent candidates',
  'fails closed for binding or intent conflicts',
  'side-effect-free cancellation',
  'application restart and acknowledges it explicitly'
]) check(source.repositoryTest.includes(marker) || source.dataStoreTest.includes(marker), `focused tests cover ${marker}`);
contains('processWorker', "stage === 'prepare'", 'process worker has an independent prepare stage');
contains('processWorker', "stage === 'recover'", 'process worker has an independent recovery stage');
contains('processVerifier', "await execute('prepare'", 'process verifier launches the first application process');
contains('processVerifier', "await execute('recover'", 'process verifier launches the restarted application process');
check(processReport.status === 'PASS' && processReport.passed === processReport.checkCount && processReport.checkCount === 12, 'two-process restart report is 12/12 PASS');
check(processReport.processes?.length === 2 && processReport.processes.every((item) => item.exitCode === 0), 'both restart processes have real exit code 0');

for (const key of ['typecheckFailure', 'dataStoreFailure', 'processFailure1', 'processFailure2', 'processFailure3']) {
  const failure = json(key);
  check(failure.status === 'FAIL' && failure.exitCode === 1 && failure.countedAsPass === false, `${key} remains preserved FAIL and NOT_PASS`);
}
check(predecessorCompletion.step === '30-T' && predecessorCompletion.officialStepStatus === 'COMPLETED', '30-T predecessor remains completed');
check(predecessorReceipt.status === 'PASS' && predecessorTransition.status === 'PASS', '30-T receipt and completion transition remain PASS');
check(packageJson.scripts?.['verify:30-u:pending-operation-identity-contract'] === 'node scripts/verify-30-u-pending-operation-identity-contract.mjs', 'package exposes the 30-U contract gate');
check(packageJson.scripts?.['verify:30-u:pending-operation-process-runtime'] === 'node scripts/verify-30-u-pending-operation-process-runtime.mjs', 'package exposes the two-process gate');
check(packageJson.scripts?.['verify:30-u:pending-operation-identity-runtime'] === 'node scripts/verify-30-u-pending-operation-identity-runtime.mjs', 'package exposes the controlled runtime gate');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-U',
  requirement: 'PPK-002',
  phase: 'DURABLE_PENDING_OPERATION_IDENTITY_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  evidenceBoundary: {
    ...scope.evidenceBoundary,
    rendererRestartPendingOperationIdentityRecovery: localPass ? 'TARGETED_PASS' : 'TARGETED_NOT_YET_PASS'
  },
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-U pending operation identity contract: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-U pending operation identity contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
