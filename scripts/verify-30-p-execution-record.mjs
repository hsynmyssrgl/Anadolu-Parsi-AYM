import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-P-execution-record-contract.json';
const RECORD_PATH = 'artifacts/checkpoints/30-P_EXECUTION_RECORD.json';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const failures = [];
const checks = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failures.push(label);
};
const verifyBinding = async (binding) => {
  if (!binding || typeof binding.path !== 'string' || !Number.isInteger(binding.sizeBytes) || !/^[0-9a-f]{64}$/u.test(binding.sha256 ?? '')) return false;
  try {
    const bytes = await readFile(binding.path);
    return bytes.byteLength === binding.sizeBytes && sha256(bytes) === binding.sha256;
  } catch {
    return false;
  }
};
const gate = (report, expected, label) => {
  const actual = report.controlledChecks?.actual ?? report.checkCount ?? report.checks ?? report.numTotalTests;
  const failed = report.failed ?? report.numFailedTests ?? 0;
  check((report.status === 'PASS' || report.success === true) && actual === expected && failed === 0, `${label} is PASS ${expected} of ${expected}`);
};

const [
  record,
  diagnostic,
  plan,
  registry,
  scope,
  priority,
  contract,
  runtime,
  vitest,
  predecessorPriority,
  predecessorExecution,
  predecessorContract,
  predecessorRuntime,
  predecessorVitest,
  historical30OVitest,
  historicalRecovery,
  securityFirst,
  securityCorrection,
  packageJson
] = await Promise.all([
  readJson(RECORD_PATH),
  readJson('artifacts/validation/30-P_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/30-p-durable-policy-transaction-scope.json'),
  readJson('artifacts/validation/30-P-durable-policy-transaction-priority-selection-contract.json'),
  readJson('artifacts/validation/30-P-durable-policy-transaction-contract-clean.json'),
  readJson('artifacts/validation/30-P-durable-policy-transaction-runtime-clean-2.json'),
  readJson('artifacts/validation/30-P-durable-policy-transaction-vitest-clean-2.json'),
  readJson('artifacts/validation/30-P-30-O-archive-production-priority-selection-regression.json'),
  readJson('artifacts/validation/30-P-30-O-execution-record-regression.json'),
  readJson('artifacts/validation/30-P-30-O-archive-production-composition-contract-regression-clean.json'),
  readJson('artifacts/validation/30-P-30-O-archive-production-composition-runtime-regression-clean.json'),
  readJson('artifacts/validation/30-P-30-O-archive-production-composition-vitest-regression-clean.json'),
  readJson('artifacts/validation/30-O-archive-production-composition-vitest.json'),
  readJson('artifacts/validation/30-P_HISTORICAL_30-O_VITEST_RECOVERY_CORRECTION.json'),
  readJson('artifacts/validation/30-P_SECURITY_REAUDIT_FIRST_ATTEMPT_FAILURE.json'),
  readJson('artifacts/validation/30-P_SECURITY_REAUDIT_CORRECTION.json'),
  readJson('package.json')
]);

check(record.step === '30-P' && record.requirement === 'PPK-002', 'execution record identity is 30-P/PPK-002');
check(record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'execution record remains bounded local PASS awaiting Library receipt');
check(record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', 'official step remains in progress awaiting persistent receipt');
check(record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null, 'persistent receipt remains PENDING without a claimed path');
check(record.officialCompletionClaimed === false, 'official completion is not claimed');
check(record.scopeStatus === 'PARTIAL_DURABLE_ARCHIVE_POLICY_TRANSACTION_SLICE_UNIVERSAL_ENFORCEMENT_PENDING', 'scope status is the bounded durable transaction slice');
check(record.mandatoryTruthSentence === TRUTH, 'execution record preserves the mandatory truth sentence');

for (const field of [
  'durableSqliteReplayReservation',
  'multiProcessNonceAndCorrelationRaceRejection',
  'exactDatabaseFenceContextValidation',
  'sameTransactionPolicyReceiptAndArchiveMutation',
  'receiptBoundArchiveAuditAndOutbox',
  'trustedPostCommitJournalProjection',
  'restartPendingProjectionRecovery',
  'deadProjectionLockRecovery',
  'incompleteFinalByteTailRecoveryWithForensicCopy',
  'policyBoundProductionRepositoryPath'
]) check(record.implemented?.[field] === true, `implemented.${field} is true`);
for (const field of [
  'universalRepositoryEnforcement',
  'directSqlArchiveTableUniversalFenceEnforcement',
  'journalAcknowledgementCryptographicProofToken',
  'newCorrelationRetryIdempotencyAfterUnknownCommitOutcome',
  'expiredUnusedReplayReservationPruning',
  'completeTailJournalRollbackDetection',
  'obligationExecution',
  'auditAndOutboxRepositoryEnforcement',
  'eventAttachmentCrossAggregateReceiptBinding',
  'secureFileDeletionAndDatabaseCommitAtomicity',
  'installedCoreServiceRegistrationAndScmLifecycle',
  'protectedCoreServiceAuthorityProvisioningRotationAndAcl'
]) check(record.implemented?.[field] === false, `implemented.${field} does not overclaim completion`);

check(record.targetedSliceResults?.durableMultiProcessReplayProtection === 'PASS', 'durable multi-process replay target is PASS');
check(record.targetedSliceResults?.receiptAndBusinessCommitAtomicity === 'PASS', 'receipt and business atomicity target is PASS');
check(record.targetedSliceResults?.crossProcessFenceAndSQLiteCommitAtomicity === 'PASS_POLICY_BOUND_ARCHIVE_PATH', 'database fence target is limited to the policy-bound archive path');
check(record.targetedSliceResults?.archiveAuditAndOutboxReceiptBinding === 'PASS_POLICY_BOUND_ARCHIVE_PATH', 'audit/outbox target is limited to the policy-bound archive path');
check(record.targetedSliceResults?.deadProjectionLockAndIncompleteTailRecovery === 'PASS', 'dead-lock and incomplete-tail target is PASS');

gate(priority, 101, '30-P priority selection');
gate(contract, 141, '30-P durable transaction contract');
gate(runtime, 40, '30-P durable transaction runtime');
gate(vitest, 15, '30-P focused Vitest');
gate(predecessorPriority, 54, '30-O priority successor regression');
gate(predecessorExecution, 59, '30-O execution successor regression');
gate(predecessorContract, 191, '30-O contract successor regression');
gate(predecessorRuntime, 111, '30-O runtime successor regression');
gate(predecessorVitest, 44, '30-O runtime successor Vitest');

check(historical30OVitest.success === true && historical30OVitest.numTotalTests === 44 && historical30OVitest.numPassedTests === 44 && historical30OVitest.numFailedTests === 0, 'historical 30-O Vitest is restored as its canonical 44/44 PASS');
check(sha256(await readFile('artifacts/validation/30-O-archive-production-composition-vitest.json')) === '8278057b1f188b0f72f5ae8ba9b343b9cb74386a9a2df3630ee2b15a8b695152', 'historical 30-O Vitest SHA-256 matches the persistent checkpoint manifest');
check(historicalRecovery.status === 'PASS' && historicalRecovery.failedSuccessorEvidence?.countedAsPass === false, 'historical recovery preserves the failed successor report as NOT_PASS');

check(securityFirst.status === 'FAIL' && securityFirst.countedAsPass === false, 'first security reaudit remains FAIL and is not counted PASS');
check(securityCorrection.status === 'PASS' && securityCorrection.targetSliceStatus === 'PASS', 'security correction passes the bounded target slice');
check(securityCorrection.findingDispositionCount?.fixed === 5 && securityCorrection.findingDispositionCount?.preservedOpenBoundary === 5, 'security correction preserves five fixed and five open findings');
check(securityCorrection.independentReaudit?.unresolvedHighRiskWithinTargetSlice === false, 'security correction reports no unresolved high risk inside the target slice');
check(securityCorrection.preservedProgramBoundaries?.PPK002 === 'PARTIAL' && securityCorrection.preservedProgramBoundaries?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'security correction preserves PPK-002 PARTIAL and universal NOT_COMPLETE');

check(diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS', 'failed-attempt aggregate is diagnostic-only NOT_PASS');
check(diagnostic.attemptCount === 14 && diagnostic.preservedFailedAttempts === 14 && diagnostic.attempts?.length === 14, 'failed-attempt aggregate preserves exactly fourteen attempts');
check(diagnostic.failedAttemptsCountedAsPass === 0, 'failed-attempt aggregate credits no failure as PASS');
check(diagnostic.attempts?.every((attempt, index) => attempt.sequence === index + 1 && attempt.countedAsPass === false), 'every failed attempt has ordered identity and is not PASS');
check(diagnostic.attempts?.every((attempt) => attempt.exitCode === 1 || (attempt.staticReview === true && attempt.exitCode === null)), 'every executed failed attempt has exit code 1 and the sole static review is explicitly non-process');
check(diagnostic.attempts?.every((attempt) => attempt.finalCleanCounterpart?.status === 'PASS' && attempt.finalCleanCounterpart?.exitCode === 0), 'every failed attempt has a separate clean exit-zero counterpart');

for (const binding of [
  record.evidence?.failedAttemptDiagnosticBinding,
  record.evidence?.securityReauditFirstAttemptFailure,
  record.evidence?.securityReauditCorrection,
  record.evidence?.historical30OVitestRecovery,
  record.evidence?.finalValidationFirstAttemptFailure
]) check(await verifyBinding(binding), `source evidence binding is exact: ${binding?.path ?? 'UNAVAILABLE'}`);

const finalBinding = record.finalValidationEvidence;
check(finalBinding?.status === 'PASS' && finalBinding?.expected === 34 && finalBinding?.executed === 34 && finalBinding?.passed === 34 && finalBinding?.failed === 0 && finalBinding?.notRun === 0, 'full governed validation binds a clean 34/34 process result');
check(finalBinding?.fullVitestTests === 82 && finalBinding?.fullVitestPassed === 82, 'full governed validation binds 82/82 Vitest');
check(await verifyBinding(finalBinding), 'external full-validation report size and SHA-256 binding are exact');
const finalReport = await readJson(finalBinding.path);
check(finalReport.status === 'PASS' && finalReport.semanticValidationStatus === 'PASS', 'external full-validation report is semantic PASS');
check(finalReport.expected === 34 && finalReport.executed === 34 && finalReport.passed === 34 && finalReport.failed === 0 && finalReport.notRun === 0, 'external full-validation report records all 34 real process exits');
check(finalReport.commands?.length === 34 && finalReport.commands.every((item) => item.exitCode === 0 && item.realExitCodeObserved === true), 'every full-validation child process returned a real exit code 0');
check(finalReport.actualFullVitestTests === 82 && finalReport.fullVitestCountStatus === 'PASS', 'external full-validation report records 82 passing tests');

const active = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
const step = plan.steps.find((item) => item.id === '30-P');
check(plan.currentStep === '30-P' && step?.status === 'IN_PROGRESS' && active.length === 1 && active[0]?.id === '30-P', '30-P remains the sole active work step');
check(step?.validationStatus === 'PENDING' && step?.persistentReceiptStatus === 'PENDING' && step?.persistentReceiptPath === null, 'work plan remains PENDING until a real Library receipt exists');
check(step?.localEvidence?.includes(RECORD_PATH), 'work plan binds the 30-P execution record');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.evidence?.includes(RECORD_PATH), 'accepted PPK-002 remains PARTIAL and binds the execution record');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL' && scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope preserves PPK-002 PARTIAL and universal NOT_COMPLETE');
check(scope.evidenceBoundary?.completeTailJournalRollbackDetection === 'NOT_IMPLEMENTED' && scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope preserves complete-tail and completion boundaries');

const boundaryExpected = {
  PPK002: 'PARTIAL',
  universalRepositoryEnforcement: 'NOT_COMPLETE',
  directSqlArchiveTableUniversalFenceEnforcement: 'NOT_COMPLETE',
  journalAcknowledgementCryptographicProofToken: 'NOT_IMPLEMENTED',
  newCorrelationRetryIdempotencyAfterUnknownCommitOutcome: 'NOT_COMPLETE',
  expiredUnusedReplayReservationPruning: 'NOT_IMPLEMENTED',
  completeTailJournalRollbackDetection: 'NOT_IMPLEMENTED',
  obligationExecution: 'NOT_RUN_NOT_PASS',
  auditAndOutboxRepositoryEnforcement: 'NOT_COMPLETE',
  eventAttachmentCrossAggregateReceiptBinding: 'NOT_COMPLETE',
  secureFileDeletionAndDatabaseCommitAtomicity: 'NOT_IMPLEMENTED',
  installedCoreServiceRegistrationAndScmLifecycle: 'NOT_RUN_NOT_PASS',
  protectedCoreServiceAuthorityProvisioningRotationAndAcl: 'NOT_IMPLEMENTED',
  requirementCompletionClaimed: false
};
for (const [field, expected] of Object.entries(boundaryExpected)) check(record.evidenceBoundary?.[field] === expected, `execution boundary ${field} remains ${String(expected)}`);
check(record.preservedFailedAttempts === 14 && record.failedAttemptsCountedAsPass === 0, 'execution record preserves fourteen failures and credits none as PASS');
check(record.bronzeCompletedPercent === 25 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY', 'release stage and Bronze percentage remain unchanged');
check(record.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS' && record.installerBuild === 'NOT_RUN_NOT_PASS', 'hardware and installer evidence remain NOT_RUN_NOT_PASS');
check(packageJson.scripts?.['verify:30-p:execution-record'] === 'node scripts/verify-30-p-execution-record.mjs', 'package exposes the 30-P execution-record gate');

const report = {
  schemaVersion: 1,
  release: record.release,
  step: '30-P',
  requirement: 'PPK-002',
  phase: 'EXECUTION_RECORD_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  scopeStatus: 'PARTIAL',
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  preservedFailedAttempts: 14,
  failedAttemptsCountedAsPass: 0,
  evidenceBoundary: boundaryExpected,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`30-P execution record: PASS (${checks.length}/${checks.length}; Library receipt PENDING; PPK-002 PARTIAL).`);
