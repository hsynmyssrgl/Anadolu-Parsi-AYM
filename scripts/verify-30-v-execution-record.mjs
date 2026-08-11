import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const RECORD_PATH = 'artifacts/checkpoints/30-V_EXECUTION_RECORD.json';
const REPORT_PATH = 'artifacts/validation/30-V-execution-record-contract.json';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const record = await readJson(RECORD_PATH);
const contract = await readJson('artifacts/validation/30-V-replay-pruning-contract.json');
const runtime = await readJson('artifacts/validation/30-V-replay-pruning-runtime.json');
const focused = await readJson('artifacts/validation/30-V-replay-pruning-vitest.json');
const full = await readJson('artifacts/validation/30-V-full-vitest-final.json');
const finalValidation = await readJson('artifacts/validation/30-V_FINAL_VALIDATION_PASS.json');
const security = await readJson('artifacts/validation/30-V_SECURITY_REVIEW.json');
const diagnostic = await readJson('artifacts/validation/30-V_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json');
const scopeReport = await readJson('artifacts/inventory/30-V_SCOPE_AND_STATUS_REPORT.json');
const migration = await readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json');
const plan = await readJson('config/work-segmentation-plan.json');
const ledger = await readJson('config/active-governance-ledger.json');
const registry = await readJson('config/accepted-scope-registry.json');

const checks = [];
const check = (name, condition, actual = undefined) => checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(actual === undefined ? {} : { actual }) });
const exactBinding = async (evidence) => {
  if (!evidence || typeof evidence.path !== 'string') return false;
  try {
    const info = await stat(evidence.path);
    return info.isFile() && info.size === evidence.sizeBytes && await sha256(evidence.path) === evidence.sha256;
  } catch {
    return false;
  }
};

check('record identity', record.step === '30-V' && record.requirement === 'PPK-002');
check('local status is receipt bounded', record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT');
check('receipt remains pending', record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null);
check('official completion not claimed', record.officialCompletionClaimed === false);
check('six target implementation flags are true', Object.keys(record.implemented ?? {}).length === 6 && Object.values(record.implemented ?? {}).every((value) => value === true));
check('contract exact', record.validation?.contractChecks === 65 && record.validation?.contractPassed === 65 && contract.status === 'PASS' && contract.checkCount === 65 && contract.passed === 65 && contract.failed === 0);
check('controlled runtime exact', record.validation?.controlledRuntimeChecks === 36 && record.validation?.controlledRuntimePassed === 36 && runtime.status === 'PASS' && runtime.controlledChecks?.actual === 36);
check('focused tests exact', record.validation?.focusedAndProductionRegressionTests === 24 && record.validation?.focusedAndProductionRegressionPassed === 24 && focused.success === true && focused.numTotalTests === 24 && focused.numPassedTests === 24 && focused.numFailedTests === 0);
check('full tests exact', record.validation?.fullVitestTests === 98 && record.validation?.fullVitestPassed === 98 && full.success === true && full.numTotalTests === 98 && full.numPassedTests === 98 && full.numFailedTests === 0);
check('migration runtime exact', record.validation?.databaseMigrationRuntimeChecks === 9 && record.validation?.databaseMigrationRuntimePassed === 9 && migration.status === 'passed' && migration.checkCount === 9);
check('migration 62 exact identity', migration.migrationVersions?.some((item) => item.version === 62 && item.name === 'expired_replay_reservation_pruning' && /^[0-9a-f]{64}$/u.test(item.checksum)));
check('IPC payload security exact', record.validation?.ipcPayloadSecurityChecks === 138 && record.validation?.ipcPayloadSecurityPassed === 138);
check('final validation status', finalValidation.status === 'PASS' && finalValidation.expected === 24 && finalValidation.executed === 24 && finalValidation.passed === 24 && finalValidation.failed === 0 && finalValidation.notRun === 0);
check('all final exits are zero', finalValidation.commands?.length === 24 && finalValidation.commands.every((item) => item.exitCode === 0 && item.realExitCodeObserved === true && item.timedOut === false));
check('security review pass', security.status === 'PASS' && security.targetSliceStatus === 'PASS' && security.reviewedControls?.length === 8 && security.newP0FindingsWithinTargetSlice === 0 && security.newP1FindingsWithinTargetSlice === 0);
check('diagnostic accounting exact', diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS' && diagnostic.attemptCount === 4 && diagnostic.preservedFailedAttempts === 3 && diagnostic.diagnosticNotTargetPassAttempts === 1 && diagnostic.failedAttemptsCountedAsPass === 0);
check('diagnostic attempts are not PASS', diagnostic.attempts?.every((item) => item.countedAsPass === false));
check('scope report local receipt-bounded PASS', scopeReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && scopeReport.targetSliceStatus === 'PASS' && scopeReport.persistentReceiptStatus === 'PENDING' && scopeReport.officialCompletionClaimed === false);
check('PPK-002 remains partial', record.evidenceBoundary?.PPK002 === 'PARTIAL');
check('replay pruning target exact PASS', record.evidenceBoundary?.expiredUnusedReplayReservationPruning === 'TARGETED_PASS');
check('prior targeted boundaries remain PASS', ['archiveCoreAndAccessoryReceiptFence', 'newCorrelationRetryIdempotencyAfterUnknownCommitOutcome', 'durableDatabaseLedgerAcrossSqliteRestart', 'rendererRestartPendingOperationIdentityRecovery'].every((key) => record.evidenceBoundary?.[key] === 'TARGETED_PASS'));
check('universal repository enforcement remains open', record.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE');
check('external monotonic authority remains open', record.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED');
check('other unrun/open boundaries preserved', record.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS' && record.evidenceBoundary?.secureFileDeletionAndDatabaseCommitAtomicity === 'NOT_IMPLEMENTED' && record.evidenceBoundary?.installedCoreServiceRegistrationAndScmLifecycle === 'NOT_RUN_NOT_PASS');
check('requirement completion not claimed', record.evidenceBoundary?.requirementCompletionClaimed === false);
const active = plan.steps?.filter((item) => item.status === 'IN_PROGRESS') ?? [];
const workItem = plan.steps?.find((item) => item.id === '30-V');
check('30-V remains sole active work', plan.currentStep === '30-V' && active.length === 1 && active[0]?.id === '30-V');
check('30-V work state remains pending receipt', workItem?.validationStatus === 'PASS' && workItem?.persistentReceiptStatus === 'PENDING');
check('active ledger retains exact task and local receipt state', ledger.activeMicroStep === '30-V' && ledger.nextOfficialTask === '30-V PPK-002 expired unused replay-reservation pruning and retention enforcement' && ledger.libraryUploadStatus === '30-V_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT');
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check('accepted PPK-002 remains partial', ppk002?.status === 'PARTIAL' && ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false);
check('tier and hardware locks', record.bronzeCompletedPercent === 25.0 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY' && record.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS' && record.installerBuild === 'NOT_RUN_NOT_PASS');
check('truth sentence exact', record.mandatoryTruthSentence === TRUTH && security.mandatoryTruthSentence === TRUTH && diagnostic.mandatoryTruthSentence === TRUTH && scopeReport.mandatoryTruthSentence === TRUTH);
check('evidence binding count exact', record.evidenceBindings?.length === 14);
for (const evidence of record.evidenceBindings ?? []) check(`binding ${evidence.path}`, await exactBinding(evidence), evidence);

const failures = checks.filter((item) => item.status !== 'PASS');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-V',
  requirement: 'PPK-002',
  phase: 'EXECUTION_RECORD_CONTRACT_VERIFICATION',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  notRun: 0,
  checks: checks.map((item) => item.name),
  failures,
  executionRecord: { path: RECORD_PATH, sizeBytes: (await stat(RECORD_PATH)).size, sha256: await sha256(RECORD_PATH) },
  officialCompletionClaimed: false,
  persistentReceiptStatus: 'PENDING',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`30-V execution record contract: ${report.status} (${report.passed}/${report.expected}).`);
console.log(TRUTH);
if (failures.length > 0) process.exit(1);
