import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const STEP = '30-U';
const REQUIREMENT = 'PPK-002';
const RECORD_PATH = 'artifacts/checkpoints/30-U_EXECUTION_RECORD.json';
const REPORT_PATH = 'artifacts/validation/30-U-execution-record-contract.json';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const record = await readJson(RECORD_PATH);
const contract = await readJson('artifacts/validation/30-U-pending-operation-identity-contract.json');
const runtime = await readJson('artifacts/validation/30-U-pending-operation-identity-runtime.json');
const processRuntime = await readJson('artifacts/validation/30-U-pending-operation-process-runtime.json');
const focused = await readJson('artifacts/validation/30-U-pending-operation-identity-vitest.json');
const full = await readJson('artifacts/validation/30-U-full-vitest-final.json');
const finalValidation = await readJson('artifacts/validation/30-U_FINAL_VALIDATION_PASS.json');
const security = await readJson('artifacts/validation/30-U_SECURITY_REVIEW.json');
const diagnostic = await readJson('artifacts/validation/30-U_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json');
const scopeReport = await readJson('artifacts/inventory/30-U_SCOPE_AND_STATUS_REPORT.json');
const plan = await readJson('config/work-segmentation-plan.json');
const ledger = await readJson('config/active-governance-ledger.json');
const registry = await readJson('config/accepted-scope-registry.json');

const checks = [];
const check = (name, condition, actual = undefined) => checks.push({
  name,
  status: condition ? 'PASS' : 'FAIL',
  ...(actual === undefined ? {} : { actual }),
});
const exactBinding = async (evidence) => {
  if (!evidence || typeof evidence.path !== 'string') return false;
  try {
    const info = await stat(evidence.path);
    return info.isFile() && info.size === evidence.sizeBytes && await sha256(evidence.path) === evidence.sha256;
  } catch {
    return false;
  }
};

check('record identity', record.step === STEP && record.requirement === REQUIREMENT);
check('local status is receipt bounded', record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT');
check('receipt remains pending', record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null);
check('official completion not claimed', record.officialCompletionClaimed === false);
check('target implementation flags are true', Object.keys(record.implemented ?? {}).length === 8 && Object.values(record.implemented ?? {}).every((value) => value === true));
check('contract count exact', record.validation?.contractChecks === 95 && record.validation?.contractPassed === 95 && contract.status === 'PASS' && contract.checkCount === 95 && contract.failed === 0);
check('runtime count exact', record.validation?.controlledRuntimeChecks === 85 && record.validation?.controlledRuntimePassed === 85 && runtime.status === 'PASS' && runtime.controlledChecks?.actual === 85);
check('two-process restart proof exact', record.validation?.twoProcessRestartChecks === 12 && record.validation?.twoProcessRestartPassed === 12 && processRuntime.status === 'PASS' && processRuntime.checkCount === 12 && processRuntime.passed === 12 && processRuntime.failed === 0);
check('focused and regression tests exact', record.validation?.focusedAndProductionRegressionTests === 52 && record.validation?.focusedAndProductionRegressionPassed === 52 && focused.success === true && focused.numTotalTests === 52 && focused.numPassedTests === 52 && focused.numFailedTests === 0);
check('full tests exact', record.validation?.fullVitestTests === 93 && record.validation?.fullVitestPassed === 93 && full.success === true && full.numTotalTests === 93 && full.numPassedTests === 93 && full.numFailedTests === 0);
check('IPC payload security exact', record.validation?.ipcPayloadSecurityChecks === 138 && record.validation?.ipcPayloadSecurityPassed === 138);
check('final process count exact', record.validation?.governedFinalProcesses === 24 && record.validation?.governedFinalProcessesPassed === 24);
check('final validation status', finalValidation.status === 'PASS' && finalValidation.expected === 24 && finalValidation.executed === 24 && finalValidation.passed === 24 && finalValidation.failed === 0 && finalValidation.notRun === 0);
check('all final exits are zero', Array.isArray(finalValidation.commands) && finalValidation.commands.length === 24 && finalValidation.commands.every((item) => item.exitCode === 0 && item.realExitCodeObserved === true && item.timedOut === false));
check('final semantic validation pass', finalValidation.semanticValidationStatus === 'PASS' && finalValidation.semanticFailures?.length === 0);
check('security review pass', security.status === 'PASS' && security.targetSliceStatus === 'PASS' && security.newP0FindingsWithinTargetSlice === 0 && security.newP1FindingsWithinTargetSlice === 0);
check('diagnostic accounting exact', diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS' && diagnostic.attemptCount === 6 && diagnostic.preservedFailedAttempts === 6 && diagnostic.failedAttemptsCountedAsPass === 0 && diagnostic.attempts?.length === 6);
check('diagnostic failures are not PASS', diagnostic.attempts?.every((item) => item.countedAsPass === false && item.exitCode === 1 && item.evidence?.status === 'FAIL'));
check('scope report is local receipt-bounded PASS', scopeReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && scopeReport.targetSliceStatus === 'PASS' && scopeReport.persistentReceiptStatus === 'PENDING' && scopeReport.officialCompletionClaimed === false);
check('PPK-002 remains partial', record.evidenceBoundary?.PPK002 === 'PARTIAL');
check('restart identity recovery target is exact PASS', record.evidenceBoundary?.rendererRestartPendingOperationIdentityRecovery === 'TARGETED_PASS');
check('new-correlation target remains PASS', record.evidenceBoundary?.newCorrelationRetryIdempotencyAfterUnknownCommitOutcome === 'TARGETED_PASS');
check('durable restart ledger target remains PASS', record.evidenceBoundary?.durableDatabaseLedgerAcrossSqliteRestart === 'TARGETED_PASS');
check('universal repository enforcement remains open', record.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE');
check('external monotonic authority remains open', record.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED');
check('replay pruning remains open', record.evidenceBoundary?.expiredUnusedReplayReservationPruning === 'NOT_IMPLEMENTED');
check('obligation execution not run', record.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS');
check('secure deletion atomicity remains open', record.evidenceBoundary?.secureFileDeletionAndDatabaseCommitAtomicity === 'NOT_IMPLEMENTED');
check('installed Core Service proof not run', record.evidenceBoundary?.installedCoreServiceRegistrationAndScmLifecycle === 'NOT_RUN_NOT_PASS');
check('requirement completion not claimed', record.evidenceBoundary?.requirementCompletionClaimed === false);
check('30-U remains sole active work', plan.currentStep === STEP && plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1);
const workItem = plan.steps?.find((item) => item.id === STEP);
check('30-U work state remains pending receipt', workItem?.status === 'IN_PROGRESS' && workItem?.validationStatus === 'PASS' && workItem?.persistentReceiptStatus === 'PENDING');
check('active ledger retains exact 30-U task', ledger.nextOfficialTask === '30-U PPK-002 durable renderer and application restart pending-operation identity recovery');
check('active ledger is awaiting 30-U receipt', ledger.libraryUploadStatus === '30-U_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT');
const ppk002 = registry.requirements?.find((item) => item.id === REQUIREMENT);
check('accepted PPK-002 remains partial', ppk002?.status === 'PARTIAL');
check('universal use-case and repository chain remains open', ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false);
check('tier hardware and installer locks', record.bronzeCompletedPercent === 25.0 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY' && record.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS' && record.installerBuild === 'NOT_RUN_NOT_PASS');
check('truth sentence exact', record.mandatoryTruthSentence === TRUTH && security.mandatoryTruthSentence === TRUTH && diagnostic.mandatoryTruthSentence === TRUTH && scopeReport.mandatoryTruthSentence === TRUTH);
check('evidence binding count exact', Array.isArray(record.evidenceBindings) && record.evidenceBindings.length === 14);
for (const evidence of record.evidenceBindings ?? []) {
  check(`binding ${evidence.path}`, await exactBinding(evidence), evidence);
}

const failures = checks.filter((item) => item.status !== 'PASS');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: STEP,
  requirement: REQUIREMENT,
  phase: 'EXECUTION_RECORD_CONTRACT_VERIFICATION',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  notRun: 0,
  checks: checks.map((item) => item.name),
  failures,
  executionRecord: {
    path: RECORD_PATH,
    sizeBytes: (await stat(RECORD_PATH)).size,
    sha256: await sha256(RECORD_PATH),
  },
  officialCompletionClaimed: false,
  persistentReceiptStatus: 'PENDING',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`30-U execution record contract: ${report.status} (${report.passed}/${report.expected}).`);
console.log(TRUTH);
if (failures.length > 0) process.exit(1);
