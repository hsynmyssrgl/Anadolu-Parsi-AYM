import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const STEP = '30-S';
const REQUIREMENT = 'PPK-002';
const RECORD_PATH = 'artifacts/checkpoints/30-S_EXECUTION_RECORD.json';
const REPORT_PATH = 'artifacts/validation/30-S-execution-record-contract.json';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const record = await readJson(RECORD_PATH);
const contract = await readJson('artifacts/validation/30-S-archive-accessory-receipt-fence-contract.json');
const runtime = await readJson('artifacts/validation/30-S-archive-accessory-receipt-fence-runtime.json');
const focused = await readJson('artifacts/validation/30-S-archive-accessory-receipt-fence-vitest.json');
const full = await readJson('artifacts/validation/30-S-full-vitest-final.json');
const finalValidation = await readJson('artifacts/validation/30-S_FINAL_VALIDATION_PASS.json');
const security = await readJson('artifacts/validation/30-S_SECURITY_REVIEW.json');
const diagnostic = await readJson('artifacts/validation/30-S_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json');
const scopeReport = await readJson('artifacts/inventory/30-S_SCOPE_AND_STATUS_REPORT.json');
const plan = await readJson('config/work-segmentation-plan.json');
const ledger = await readJson('config/active-governance-ledger.json');
const registry = await readJson('config/accepted-scope-registry.json');

const checks = [];
const check = (name, condition, actual = undefined) => checks.push({
  name,
  status: condition ? 'PASS' : 'FAIL',
  ...(actual === undefined ? {} : { actual }),
});
const exactBinding = async (binding) => {
  if (!binding || typeof binding.path !== 'string') return false;
  try {
    const info = await stat(binding.path);
    return info.isFile() && info.size === binding.sizeBytes && await sha256(binding.path) === binding.sha256;
  } catch {
    return false;
  }
};

check('record identity', record.step === STEP && record.requirement === REQUIREMENT);
check('local status is receipt bounded', record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT');
check('receipt remains pending', record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null);
check('official completion not claimed', record.officialCompletionClaimed === false);
check('target implementation flags are true', Object.keys(record.implemented ?? {}).length === 10 && Object.values(record.implemented ?? {}).every((value) => value === true));
check('contract count exact', record.validation?.contractChecks === 87 && record.validation?.contractPassed === 87 && contract.status === 'PASS' && contract.checkCount === 87 && contract.failed === 0);
check('runtime count exact', record.validation?.controlledRuntimeChecks === 34 && record.validation?.controlledRuntimePassed === 34 && runtime.status === 'PASS' && runtime.controlledChecks?.actual === 34);
check('focused and regression tests exact', record.validation?.focusedAndProductionRegressionTests === 21 && record.validation?.focusedAndProductionRegressionPassed === 21 && focused.success === true && focused.numTotalTests === 21 && focused.numPassedTests === 21 && focused.numFailedTests === 0);
check('full tests exact', record.validation?.fullVitestTests === 85 && record.validation?.fullVitestPassed === 85 && full.success === true && full.numTotalTests === 85 && full.numPassedTests === 85 && full.numFailedTests === 0);
check('migration runtime exact', record.validation?.databaseMigrationRuntimeChecks === 9 && record.validation?.databaseMigrationRuntimePassed === 9);
check('final process count exact', record.validation?.governedFinalProcesses === 18 && record.validation?.governedFinalProcessesPassed === 18);
check('final validation status', finalValidation.status === 'PASS' && finalValidation.expected === 18 && finalValidation.executed === 18 && finalValidation.passed === 18 && finalValidation.failed === 0 && finalValidation.notRun === 0);
check('all final exits are zero', Array.isArray(finalValidation.commands) && finalValidation.commands.length === 18 && finalValidation.commands.every((item) => item.exitCode === 0 && item.realExitCodeObserved === true && item.timedOut === false));
check('final semantic validation pass', finalValidation.semanticValidationStatus === 'PASS' && finalValidation.semanticFailures?.length === 0);
check('security review pass', security.status === 'PASS' && security.targetSliceStatus === 'PASS' && security.newP0FindingsWithinTargetSlice === 0 && security.newP1FindingsWithinTargetSlice === 0);
check('diagnostic accounting exact', diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS' && diagnostic.attemptCount === 3 && diagnostic.preservedFailedAttempts === 3 && diagnostic.failedAttemptsCountedAsPass === 0 && diagnostic.attempts?.length === 3);
check('diagnostic failures are not PASS', diagnostic.attempts?.every((item) => item.countedAsPass === false));
check('scope report is local receipt-bounded PASS', scopeReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && scopeReport.persistentReceiptStatus === 'PENDING' && scopeReport.officialCompletionClaimed === false);
check('PPK-002 remains partial', record.evidenceBoundary?.PPK002 === 'PARTIAL');
check('core table target remains exact PASS', record.evidenceBoundary?.archiveCoreTableDirectSqlFence === 'TARGETED_PASS');
check('accessory table target is exact PASS', record.evidenceBoundary?.archiveAccessoryTableReceiptFence === 'TARGETED_PASS');
check('universal repository enforcement remains open', record.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE');
check('external monotonic authority remains open', record.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED');
check('unknown commit retry remains open', record.evidenceBoundary?.newCorrelationRetryIdempotencyAfterUnknownCommitOutcome === 'NOT_COMPLETE');
check('replay pruning remains open', record.evidenceBoundary?.expiredUnusedReplayReservationPruning === 'NOT_IMPLEMENTED');
check('obligation execution not run', record.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS');
check('requirement completion not claimed', record.evidenceBoundary?.requirementCompletionClaimed === false);
check('30-S remains sole active work', plan.currentStep === STEP && plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1);
const workItem = plan.steps?.find((item) => item.id === STEP);
check('30-S work state remains pending receipt', workItem?.status === 'IN_PROGRESS' && workItem?.validationStatus === 'PENDING' && workItem?.persistentReceiptStatus === 'PENDING');
check('active ledger retains exact 30-S task', ledger.nextOfficialTask === '30-S PPK-002 database-enforced receipt binding for archive accessory tables and cross-aggregate event attachment updates');
check('active ledger is awaiting 30-S receipt', ledger.libraryUploadStatus === '30-S_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT');
const ppk002 = registry.requirements?.find((item) => item.id === REQUIREMENT);
check('accepted PPK-002 remains partial', ppk002?.status === 'PARTIAL');
check('universal use-case and repository chain remains open', ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false);
check('tier hardware and installer locks', record.bronzeCompletedPercent === 25.0 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY' && record.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS' && record.installerBuild === 'NOT_RUN_NOT_PASS');
check('truth sentence exact', record.mandatoryTruthSentence === TRUTH && security.mandatoryTruthSentence === TRUTH && diagnostic.mandatoryTruthSentence === TRUTH && scopeReport.mandatoryTruthSentence === TRUTH);
check('evidence binding count exact', Array.isArray(record.evidenceBindings) && record.evidenceBindings.length === 13);
for (const binding of record.evidenceBindings ?? []) {
  check(`binding ${binding.path}`, await exactBinding(binding), binding);
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
console.log(`30-S execution record contract: ${report.status} (${report.passed}/${report.expected}).`);
console.log(TRUTH);
if (failures.length > 0) process.exit(1);
