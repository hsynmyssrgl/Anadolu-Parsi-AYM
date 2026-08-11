import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const raw = await readJson('artifacts/validation/29-E2_ACTIVE_GOVERNED_GATE_EXECUTION_RAW.json');
const broadFailure = await readJson('artifacts/checkpoints/29-E2_BROAD_HISTORICAL_GATE_SELECTION_FIRST_ATTEMPT_FAILURE.json');
const correction = await readJson('artifacts/checkpoints/29-E1_CLASSIFICATION_LIMITATION_CORRECTION.json');
let officialCompletion = false;
try { await stat('artifacts/checkpoints/29-E2_COMPLETION_RECORD.json'); officialCompletion = true; } catch {}
check(raw.expected === 24 && raw.executed === 24 && raw.results.length === 24, 'active gate count mismatch');
check(new Set(raw.results.map((item) => item.script)).size === 24, 'duplicate active gate');
for (const item of raw.results) {
  check(Number.isInteger(item.exitCode), `${item.script} missing real exit code`);
  check(item.stdoutSha256 === sha256(item.stdout) && item.stderrSha256 === sha256(item.stderr), `${item.script} output hash mismatch`);
  check(item.status === (item.exitCode === 0 ? 'PASS' : 'FAIL'), `${item.script} status/exit mismatch`);
}
check(raw.childProcessExitCodesAllZero === true && raw.failed === 0 && raw.passed === 24 && raw.status === 'PASS', 'active governed gates not clean PASS');
const securityResults = raw.results.filter((item) => /SECURITY|HONESTY|RELEASE|ARCHITECTURE/u.test(item.scope));
const runtimeResults = raw.results.filter((item) => item.scope === 'ACTIVE_CONTROLLED_RUNTIME');
check(securityResults.length >= 10 && securityResults.every((item) => item.exitCode === 0), 'active security gate failure');
check(runtimeResults.length === 3 && runtimeResults.every((item) => item.exitCode === 0), 'controlled runtime gate failure');
check(broadFailure.status === 'FAIL' && broadFailure.executedBeforeFailClosedStop === 100 && broadFailure.passed === 11 && broadFailure.failed === 89 && broadFailure.countedAsPass === false, 'broad failure evidence mismatch');
check(correction.status === 'CORRECTION_ACTIVE' && correction.originalInventoryRewritten === false && correction.countedAsPass === false, 'selection correction mismatch');
const plan = await readJson('config/work-segmentation-plan.json');
const e = plan.steps.find((item) => item.id === '29-E');
const e1 = e?.substeps?.find((item) => item.id === '29-E1');
const e2 = e?.substeps?.find((item) => item.id === '29-E2');
const e3 = e?.substeps?.find((item) => item.id === '29-E3');
const e4 = e?.substeps?.find((item) => item.id === '29-E4');
const f = plan.steps.find((item) => item.id === '29-F');
const workflowClosed = plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS';
const eClosedForward = plan.currentStep === '29-F' && e?.status === 'COMPLETED' && e.validationStatus === 'PASS' && e.persistentReceiptStatus === 'PASS' && (f?.status === 'IN_PROGRESS' || workflowClosed);
check(eClosedForward || (plan.currentStep === '29-E' && e?.status === 'IN_PROGRESS' && (officialCompletion ? ['29-E3', '29-E4'].includes(e?.activeMicroStep) : e?.activeMicroStep === '29-E2')), '29-E active state mismatch');
check(e1?.status === 'COMPLETED' && e1.validationStatus === 'PASS' && e1.persistentReceiptStatus === 'PASS', '29-E1 prerequisite mismatch');
if (officialCompletion) {
  check(e2?.status === 'COMPLETED' && e2.validationStatus === 'PASS' && e2.persistentReceiptStatus === 'PASS', '29-E2 completed lifecycle mismatch');
  check(e2.persistentReceiptPath === 'artifacts/checkpoints/29-E2_LIBRARY_RECEIPT.json' && e2.receiptReadbackVerificationPath === 'artifacts/validation/29-E2_RECEIPT_READBACK_VERIFICATION.json', '29-E2 plan receipt binding mismatch');
  if (eClosedForward) {
    check(e3?.status === 'COMPLETED' && e3.validationStatus === 'PASS' && e3.persistentReceiptStatus === 'PASS', '29-E3 durable lifecycle mismatch');
    check(e4?.status === 'COMPLETED' && e4.validationStatus === 'PASS' && e4.persistentReceiptStatus === 'PASS', '29-E4 durable lifecycle mismatch');
  } else if (e.activeMicroStep === '29-E3') {
    check(e3?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e3.validationStatus) && e3.persistentReceiptStatus === 'PENDING', '29-E3 active lifecycle mismatch');
  } else {
    check(e3?.status === 'COMPLETED' && e3.validationStatus === 'PASS' && e3.persistentReceiptStatus === 'PASS', '29-E3 durable lifecycle mismatch');
    check(e4?.status === 'IN_PROGRESS' && e4.validationStatus === 'PENDING' && e4.persistentReceiptStatus === 'PENDING', '29-E4 active lifecycle mismatch');
  }
} else {
  check(e2?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e2.validationStatus) && e2.persistentReceiptStatus === 'PENDING', '29-E2 lifecycle mismatch');
  check(e3?.status === 'PENDING', '29-E3 premature lifecycle');
}
check(e.substeps.filter((item) => item.status === 'IN_PROGRESS').length === (eClosedForward ? 0 : 1), 'multiple active micro-steps');
const governance = await readJson('config/active-governance-ledger.json');
check(governance.activeMicroStep === (workflowClosed
  ? null
  : eClosedForward
  ? '29-F documents, deterministic package, exact-source and Library closure'
  : officialCompletion
    ? e.activeMicroStep === '29-E4'
      ? '29-E4 governed 29-E closure and durable receipt chain'
      : '29-E3 dependency-backed typecheck, tests and build capability execution'
    : '29-E2 dependency-free targeted contract/runtime and security gates'), 'governance micro-step mismatch');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const d4 = await readJson('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json');
const d5 = await readJson('artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json');
check(d3.summary.openGapCount === 9 && d3.summary.openContradictionCount === 0, 'governance truth changed');
check(d4.findingSummary.open === 8, 'technical finding truth changed');
check(d5.scopeMetrics.strictCompleteCount === 4 && d5.scopeMetrics.strictIncompleteCount === 346 && d5.scopeMetrics.promotionRequired.incomplete === 341, 'scope truth changed');
if (officialCompletion) {
  const receiptPath = 'artifacts/checkpoints/29-E2_LIBRARY_RECEIPT.json';
  const libraryReadbackPath = 'artifacts/validation/29-E2_LIBRARY_READBACK_VERIFICATION.json';
  const receiptReadbackPath = 'artifacts/validation/29-E2_RECEIPT_READBACK_VERIFICATION.json';
  const completionPath = 'artifacts/checkpoints/29-E2_COMPLETION_RECORD.json';
  const recordPath = 'artifacts/checkpoints/29-E2_EXECUTION_RECORD.json';
  const [receipt, libraryReadback, receiptReadback, completion, record] = await Promise.all([receiptPath, libraryReadbackPath, receiptReadbackPath, completionPath, recordPath].map(readJson));
  const [receiptBytes, libraryBytes, receiptReadbackBytes, rawBytes, activeBytes] = await Promise.all([
    readFile(receiptPath), readFile(libraryReadbackPath), readFile(receiptReadbackPath),
    readFile('artifacts/validation/29-E2_ACTIVE_GOVERNED_GATE_EXECUTION_RAW.json'),
    readFile('artifacts/validation/29-E2_ACTIVE_GOVERNED_GATE_EXECUTION.json'),
  ]);
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS' && receipt.officialStepCompletionClaimed === false, 'receipt semantic mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, 'receipt payload roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, 'receipt ZIP roundtrip mismatch');
  check(receipt.activeExecution.executed === 24 && receipt.activeExecution.passed === 24 && receipt.activeExecution.failed === 0 && receipt.activeExecution.childProcessExitCodesAllZero === true, 'receipt active execution mismatch');
  check(receipt.activeExecution.rawSha256 === sha256(rawBytes) && receipt.activeExecution.validationSha256 === sha256(activeBytes), 'receipt execution hash binding mismatch');
  check(receipt.executedTestOrSecurityGateCommands.length === 24 && receipt.executedTestOrSecurityGateCommands.every((item) => item.processExitCode === 0 && item.status === 'PASS'), 'receipt command exit binding mismatch');
  check(receipt.preservedFailures.length === 3 && receipt.preservedFailures.every((item) => item.status === 'FAIL' && item.countedAsPass === false), 'receipt preserved failures mismatch');
  check(receipt.dependencyBackedTypecheck === 'NOT_RUN_NOT_PASS' && receipt.dependencyBackedTests === 'NOT_RUN_NOT_PASS' && receipt.productionBuild === 'NOT_RUN_NOT_PASS' && receipt.installerBuild === 'NOT_RUN_NOT_PASS', 'receipt dependency-backed overclaim');
  check(libraryReadback.status === 'PASS' && libraryReadback.executed === 20 && libraryReadback.matched === 20 && libraryReadback.failed === 0 && libraryReadback.zipPassed === 3, 'Library readback mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'receipt readback mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.nextMicroStep === '29-E3' && completion.nextMicroStepStatus === 'IN_PROGRESS', 'completion lifecycle mismatch');
  check(completion.activeExecution.rawSha256 === sha256(rawBytes) && completion.activeExecution.validationSha256 === sha256(activeBytes), 'completion execution binding mismatch');
  check(completion.receipt.sizeBytes === receiptBytes.length && completion.receipt.sha256 === sha256(receiptBytes), 'completion receipt binding mismatch');
  check(completion.libraryReadback.sizeBytes === libraryBytes.length && completion.libraryReadback.sha256 === sha256(libraryBytes), 'completion Library binding mismatch');
  check(completion.receiptReadback.sizeBytes === receiptReadbackBytes.length && completion.receiptReadback.sha256 === sha256(receiptReadbackBytes), 'completion receipt-readback binding mismatch');
  check(completion.receiptReadback.persistenceExecuted === 2 && completion.receiptReadback.persistenceMatched === 2 && completion.receiptReadback.persistenceFailed === 0 && completion.receiptReadback.persistenceStatus === 'PASS', 'receipt-readback persistence mismatch');
  check(completion.preservedFailureCount === 3 && completion.failedHistoricalGateProcessesPreserved === 89 && completion.failuresCountedAsPass === 0, 'completion failure truth mismatch');
  check(record.status === 'PASS' && record.officialStepStatus === 'COMPLETED' && record.persistentReceiptStatus === 'PASS', 'execution record completion mismatch');
  check([receipt, libraryReadback, receiptReadback, completion].every((item) => item.mandatoryTruthSentence === TRUTH), 'official truth sentence mismatch');
}
const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '29-E2', phase: 'ACTIVE_GOVERNED_TARGETED_CONTRACT_RUNTIME_SECURITY_GATE_VALIDATION',
  checks, failures, expected: 24, executed: raw.executed, passed: raw.passed, failed: raw.failed,
  securityGateExecuted: securityResults.length, securityGatePassed: securityResults.filter((item) => item.exitCode === 0).length,
  controlledRuntimeExecuted: runtimeResults.length, controlledRuntimePassed: runtimeResults.filter((item) => item.exitCode === 0).length,
  broadHistoricalDiagnostic: { executed: 100, passed: 11, failed: 89, status: 'FAIL_NOT_COUNTED_AS_PASS' },
  dependencyBackedTypecheck: 'NOT_RUN_NOT_PASS', dependencyBackedTests: 'NOT_RUN_NOT_PASS', productionBuild: 'NOT_RUN_NOT_PASS', installerBuild: 'NOT_RUN_NOT_PASS',
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING', nextMicroStep: '29-E3', nextMicroStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-E2_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25, silverStatus: 'FORBIDDEN_NOT_READY', goldStatus: 'FORBIDDEN_NOT_READY', conversationCapacity: 'UNAVAILABLE',
  status: failures.length === 0 ? 'PASS' : 'FAIL', generatedAt: raw.generatedAt, mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(officialCompletion ? 'artifacts/validation/29-E2-official-completion-regression.json' : 'artifacts/validation/29-E2_ACTIVE_GOVERNED_GATE_EXECUTION.json', JSON.stringify(report, null, 2) + '\n');
for (const path of ['artifacts/validation/29-E2_ACTIVE_GOVERNED_GATE_EXECUTION_RAW.json', 'artifacts/checkpoints/29-E2_BROAD_HISTORICAL_GATE_SELECTION_FIRST_ATTEMPT_FAILURE.json', 'artifacts/checkpoints/29-E1_CLASSIFICATION_LIMITATION_CORRECTION.json', ...(officialCompletion ? ['artifacts/checkpoints/29-E2_LIBRARY_RECEIPT.json', 'artifacts/validation/29-E2_LIBRARY_READBACK_VERIFICATION.json', 'artifacts/validation/29-E2_RECEIPT_READBACK_VERIFICATION.json', 'artifacts/checkpoints/29-E2_COMPLETION_RECORD.json'] : [])]) {
  try { await stat(path); } catch { failures.push(`${path} missing`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-E2 active governed gates: PASS (${checks} evidence checks / 24/24 real process exits / ${securityResults.length} security gates / 3 runtimes).`);
