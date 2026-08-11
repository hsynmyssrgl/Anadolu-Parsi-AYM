import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const checks = [];
const failures = [];
const check = (label, condition) => {
  checks.push(label);
  if (!condition) failures.push(label);
};

const root = process.cwd();
const recordPath = resolve(root, 'artifacts/checkpoints/30-Q_EXECUTION_RECORD.json');
const outputPath = resolve(root, 'artifacts/validation/30-Q-execution-record-contract.json');
const record = load(recordPath);
const plan = load(resolve(root, 'config/work-segmentation-plan.json'));
const registry = load(resolve(root, 'config/accepted-scope-registry.json'));
const finalValidation = load(resolve(root, record.finalValidationEvidence.path));
const contract = load(resolve(root, 'artifacts/validation/30-Q-journal-proof-contract.json'));
const runtime = load(resolve(root, 'artifacts/validation/30-Q-journal-proof-runtime.json'));
const focused = load(resolve(root, 'artifacts/validation/30-Q-journal-proof-vitest.json'));
const full = load(resolve(root, 'artifacts/validation/30-Q-full-vitest-final.json'));
const diagnostic = load(resolve(root, 'artifacts/validation/30-Q_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json'));
const security = load(resolve(root, 'artifacts/validation/30-Q_SECURITY_REVIEW.json'));
const statusReport = load(resolve(root, 'artifacts/inventory/30-Q_SCOPE_AND_STATUS_REPORT.json'));
const workItem = plan.steps.find((item) => item.id === '30-Q');
const requirement = registry.requirements.find((item) => item.id === 'PPK-002');

check('record identity', record.schemaVersion === 1 && record.release === 'Bronze 04.08.2026.29' && record.step === '30-Q' && record.requirement === 'PPK-002');
check('local status is receipt bounded', record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT');
check('receipt remains pending', record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null);
check('official completion not claimed', record.officialCompletionClaimed === false);
check('target implementation flags are true', Object.values(record.implemented).every((value) => value === true));
check('contract count exact', record.validation.contractChecks === 89 && record.validation.contractPassed === 89);
check('runtime count exact', record.validation.controlledRuntimeChecks === 30 && record.validation.controlledRuntimePassed === 30);
check('focused tests exact', record.validation.focusedVitestTests === 16 && record.validation.focusedVitestPassed === 16);
check('full tests exact', record.validation.fullVitestTests === 83 && record.validation.fullVitestPassed === 83);
check('archive regression exact', record.validation.archiveUseCaseRegressionChecks === 16 && record.validation.archiveUseCaseRegressionPassed === 16);
check('final process count exact', record.validation.governedFinalProcesses === 18 && record.validation.governedFinalProcessesPassed === 18);
check('final validation status', finalValidation.status === 'PASS' && finalValidation.expected === 18 && finalValidation.executed === 18 && finalValidation.passed === 18 && finalValidation.failed === 0 && finalValidation.notRun === 0);
check('all final exits are zero', Array.isArray(finalValidation.commands) && finalValidation.commands.length === 18 && finalValidation.commands.every((item) => item.exitCode === 0 && item.realExitCodeObserved === true && item.timedOut === false));
check('final semantic validation pass', finalValidation.semanticValidationStatus === 'PASS' && Array.isArray(finalValidation.semanticFailures) && finalValidation.semanticFailures.length === 0);
check('contract evidence exact', contract.status === 'PASS' && contract.checkCount === 89 && contract.failed === 0);
check('runtime evidence exact', runtime.status === 'PASS' && runtime.controlledChecks?.expected === 30 && runtime.controlledChecks?.actual === 30);
check('focused Vitest evidence exact', focused.success === true && focused.numTotalTests === 16 && focused.numPassedTests === 16 && focused.numFailedTests === 0);
check('full Vitest evidence exact', full.success === true && full.numTotalTests === 83 && full.numPassedTests === 83 && full.numFailedTests === 0);
check('security review pass', security.status === 'PASS' && security.targetSliceStatus === 'PASS' && security.newP0FindingsWithinTargetSlice === 0 && security.newP1FindingsWithinTargetSlice === 0);
check('diagnostic accounting exact', diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS' && diagnostic.attemptCount === 13 && diagnostic.preservedFailedAttempts === 13 && diagnostic.failedAttemptsCountedAsPass === 0 && diagnostic.attempts.length === 13 && diagnostic.attempts.every((item) => item.countedAsPass === false));
check('execution diagnostic count exact', record.preservedFailedAttempts === 13 && record.failedAttemptsCountedAsPass === 0);
check('scope report local status', statusReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && statusReport.officialCompletionClaimed === false && statusReport.persistentReceiptStatus === 'PENDING');
check('PPK-002 remains partial', requirement?.status === 'PARTIAL' && record.evidenceBoundary.PPK002 === 'PARTIAL' && record.evidenceBoundary.requirementCompletionClaimed === false);
check('external monotonic authority remains open', record.evidenceBoundary.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED');
check('universal repository enforcement remains open', record.evidenceBoundary.universalRepositoryEnforcement === 'NOT_COMPLETE');
check('direct SQL universal fence remains open', record.evidenceBoundary.directSqlArchiveTableUniversalFenceEnforcement === 'NOT_COMPLETE');
check('unknown commit retry remains open', record.evidenceBoundary.newCorrelationRetryIdempotencyAfterUnknownCommitOutcome === 'NOT_COMPLETE');
check('replay pruning remains open', record.evidenceBoundary.expiredUnusedReplayReservationPruning === 'NOT_IMPLEMENTED');
check('obligation execution not run', record.evidenceBoundary.obligationExecution === 'NOT_RUN_NOT_PASS');
check('30-Q remains sole active work', plan.currentStep === '30-Q' && workItem?.status === 'IN_PROGRESS' && workItem?.validationStatus === 'PENDING' && workItem?.persistentReceiptStatus === 'PENDING' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1);
check('release gates remain closed', record.bronzeCompletedPercent === 25 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY');
check('hardware and installer not promoted', record.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS' && record.installerBuild === 'NOT_RUN_NOT_PASS');
check('truth sentence exact', record.mandatoryTruthSentence === TRUTH && finalValidation.mandatoryTruthSentence === TRUTH && diagnostic.mandatoryTruthSentence === TRUTH && security.mandatoryTruthSentence === TRUTH);
check('evidence binding count exact', Array.isArray(record.evidenceBindings) && record.evidenceBindings.length === 12);

for (const binding of record.evidenceBindings) {
  const path = resolve(root, binding.path);
  const valid = existsSync(path) && statSync(path).isFile() && statSync(path).size === binding.sizeBytes && sha256(path) === binding.sha256;
  check(`binding ${binding.path}`, valid);
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-Q',
  phase: 'EXECUTION_RECORD_CONTRACT_VERIFICATION',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  notRun: 0,
  checks,
  failures,
  executionRecord: {
    path: 'artifacts/checkpoints/30-Q_EXECUTION_RECORD.json',
    sizeBytes: statSync(recordPath).size,
    sha256: sha256(recordPath)
  },
  officialCompletionClaimed: false,
  persistentReceiptStatus: 'PENDING',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, passed: report.passed, expected: report.expected, failures }, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
