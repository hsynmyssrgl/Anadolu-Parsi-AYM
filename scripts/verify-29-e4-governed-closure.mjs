import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const closure = await readJson('artifacts/checkpoints/29-E4_29-E_GOVERNED_CLOSURE.json');
let officialCompletion = false;
try { await stat('artifacts/checkpoints/29-E4_COMPLETION_RECORD.json'); officialCompletion = true; } catch {}

check(closure.release === 'Bronze 04.08.2026.29' && closure.step === '29-E4' && closure.parentStep === '29-E', 'closure identity mismatch');
check(closure.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && closure.validationStatus === 'PASS' && closure.officialParentCompletionClaimed === false, 'closure local lifecycle mismatch');
check(closure.completedPrerequisites.length === 3 && new Set(closure.completedPrerequisites.map((item) => item.step)).size === 3, 'prerequisite identity mismatch');
for (const prerequisite of closure.completedPrerequisites) {
  check(prerequisite.status === 'COMPLETED' && prerequisite.validationStatus === 'PASS' && prerequisite.persistentReceiptStatus === 'PASS', `${prerequisite.step} lifecycle mismatch`);
  for (const binding of [prerequisite.completionRecord, prerequisite.receipt, prerequisite.libraryReadback, prerequisite.receiptReadback]) {
    const bytes = await readFile(binding.path);
    check(bytes.length === binding.sizeBytes && sha256(bytes) === binding.sha256, `${prerequisite.step} binding mismatch=${binding.path}`);
  }
  const receipt = await readJson(prerequisite.receipt.path);
  const library = await readJson(prerequisite.libraryReadback.path);
  const receiptReadback = await readJson(prerequisite.receiptReadback.path);
  check(receipt.status === 'PASS' && receipt.persistentReceiptStatus === 'PASS', `${prerequisite.step} receipt mismatch`);
  check(library.status === 'PASS' && library.executed === 20 && library.matched === 20 && library.failed === 0, `${prerequisite.step} Library readback mismatch`);
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, `${prerequisite.step} receipt readback mismatch`);
}
const e2 = closure.completedPrerequisites.find((item) => item.step === '29-E2');
const e3 = closure.completedPrerequisites.find((item) => item.step === '29-E3');
check(e2.activeGovernedExecution.expected === 24 && e2.activeGovernedExecution.executed === 24 && e2.activeGovernedExecution.passed === 24 && e2.activeGovernedExecution.failed === 0, 'E2 active execution mismatch');
check(e2.activeGovernedExecution.securityGatesPassed === 13 && e2.activeGovernedExecution.controlledRuntimesPassed === 3, 'E2 security/runtime mismatch');
check(e3.dependencyBackedExecution.expected === 6 && e3.dependencyBackedExecution.executed === 6 && e3.dependencyBackedExecution.passed === 6 && e3.dependencyBackedExecution.failed === 0, 'E3 dependency execution mismatch');
check(e3.dependencyBackedExecution.npmAuditVulnerabilities === 0 && e3.dependencyBackedExecution.typecheckProcessExitCode === 0, 'E3 audit/typecheck mismatch');
check(e3.dependencyBackedExecution.testFilesPassed === 8 && e3.dependencyBackedExecution.testsPassed === 61 && e3.dependencyBackedExecution.productionBuildProcessExitCode === 0, 'E3 test/build mismatch');
check(e3.dependencyBackedExecution.installerBuild === 'NOT_RUN_NOT_PASS', 'installer overclaim');
check(closure.closureSummary.totalExecutedCommandsPassed === 30 && closure.closureSummary.activeGovernedGateCommandsPassed === 24 && closure.closureSummary.dependencyBackedCommandsPassed === 6, 'closure command summary mismatch');
check(closure.closureSummary.productionBuild === 'PASS' && closure.closureSummary.installerBuild === 'NOT_RUN_NOT_PASS', 'closure build truth mismatch');
check(closure.preservedFailures.broadHistoricalGateProcessesFailed === 89 && closure.preservedFailures.dependencyBackedFailureEvidenceCount === 8 && closure.preservedFailures.closureForwardFailureEvidenceCount === 3 && closure.preservedFailures.countedAsPass === 0, 'preserved failure mismatch');
const e4ForwardFailure = await readJson('artifacts/checkpoints/29-E4_D6_FORWARD_COMPATIBILITY_FIRST_ATTEMPT_FAILURE.json');
check(e4ForwardFailure.status === 'FAIL' && e4ForwardFailure.processExitCode === 1 && e4ForwardFailure.countedAsPass === false, 'E4 forward failure mismatch');
const e4PrepackageFailure = await readJson('artifacts/checkpoints/29-E4_PREPACKAGE_D3_FORWARD_FIRST_ATTEMPT_FAILURE.json');
check(e4PrepackageFailure.status === 'FAIL' && e4PrepackageFailure.processExitCode === 1 && e4PrepackageFailure.executedCommands === 2 && e4PrepackageFailure.notRunCommands === 12 && e4PrepackageFailure.countedAsPass === false, 'E4 prepackage failure mismatch');
const e4PrepackageD4Failure = await readJson('artifacts/checkpoints/29-E4_PREPACKAGE_D4_FORWARD_SECOND_ATTEMPT_FAILURE.json');
check(e4PrepackageD4Failure.status === 'FAIL' && e4PrepackageD4Failure.processExitCode === 1 && e4PrepackageD4Failure.executedCommands === 3 && e4PrepackageD4Failure.notRunCommands === 11 && e4PrepackageD4Failure.countedAsPass === false, 'E4 prepackage D4 failure mismatch');
check(closure.openTruth.governanceGaps === 9 && closure.openTruth.governanceContradictions === 0 && closure.openTruth.technicalFindings === 8, 'open governance/technical truth mismatch');
check(closure.openTruth.acceptedScopeIncomplete === 346 && closure.openTruth.promotionRequiredIncomplete === 341, 'open scope truth mismatch');
check(closure.bronzeCompletedPercent === 25 && closure.silverStatus === 'FORBIDDEN_NOT_READY' && closure.goldStatus === 'FORBIDDEN_NOT_READY', 'release overclaim');
check(closure.conversationCapacity === 'UNAVAILABLE' && closure.mandatoryTruthSentence === TRUTH, 'capacity or truth mismatch');

const plan = await readJson('config/work-segmentation-plan.json');
const parent = plan.steps.find((item) => item.id === '29-E');
const substeps = parent?.substeps ?? [];
const f = plan.steps.find((item) => item.id === '29-F');
if (officialCompletion) {
  const workflowClosed = plan.workflowStatus === 'COMPLETED';
  check(plan.currentStep === '29-F' && parent?.status === 'COMPLETED' && parent.validationStatus === 'PASS' && parent.persistentReceiptStatus === 'PASS', '29-E parent completion mismatch');
  check(substeps.every((item) => item.status === 'COMPLETED' && item.validationStatus === 'PASS' && item.persistentReceiptStatus === 'PASS'), '29-E substep completion mismatch');
  check((f?.status === 'IN_PROGRESS' && f.validationStatus === 'PENDING' && f.persistentReceiptStatus === 'PENDING') || (workflowClosed && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS'), '29-F forward lifecycle mismatch');
} else {
  check(plan.currentStep === '29-E' && parent?.status === 'IN_PROGRESS' && parent.activeMicroStep === '29-E4', '29-E parent active mismatch');
  check(substeps.filter((item) => item.status === 'IN_PROGRESS').length === 1 && substeps.find((item) => item.id === '29-E4')?.status === 'IN_PROGRESS', '29-E4 active mismatch');
  check(substeps.filter((item) => item.id !== '29-E4').every((item) => item.status === 'COMPLETED' && item.validationStatus === 'PASS' && item.persistentReceiptStatus === 'PASS'), '29-E prerequisites plan mismatch');
  check(f?.status === 'PENDING', '29-F premature activation');
}
const governance = await readJson('config/active-governance-ledger.json');
const workflowClosed = plan.workflowStatus === 'COMPLETED';
check(governance.nextOfficialTask === (workflowClosed ? 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' : officialCompletion ? '29-F documents, deterministic package, exact-source and Library closure' : '29-E targeted tests and security gates'), 'next official task mismatch');
check(governance.activeMicroStep === (workflowClosed ? null : officialCompletion ? '29-F documents, deterministic package, exact-source and Library closure' : '29-E4 governed 29-E closure and durable receipt chain'), 'active governance micro-step mismatch');

if (officialCompletion) {
  const receipt = await readJson('artifacts/checkpoints/29-E4_LIBRARY_RECEIPT.json');
  const library = await readJson('artifacts/validation/29-E4_LIBRARY_READBACK_VERIFICATION.json');
  const receiptReadback = await readJson('artifacts/validation/29-E4_RECEIPT_READBACK_VERIFICATION.json');
  const completion = await readJson('artifacts/checkpoints/29-E4_COMPLETION_RECORD.json');
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS', 'E4 receipt mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, 'E4 payload roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, 'E4 ZIP readback mismatch');
  check(library.status === 'PASS' && library.executed === 20 && library.matched === 20 && library.failed === 0 && library.zipPassed === 3, 'E4 Library readback mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'E4 receipt readback mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.parent29EStatus === 'COMPLETED' && completion.nextOfficialStep === '29-F' && completion.nextOfficialStepStatus === 'IN_PROGRESS', 'E4 completion record mismatch');
  check([receipt, library, receiptReadback, completion].every((item) => item.mandatoryTruthSentence === TRUTH), 'E4 completion truth sentence mismatch');
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-E4',
  parentStep: '29-E',
  phase: 'GOVERNED_29-E_CLOSURE_VALIDATION',
  checks,
  failures,
  prerequisiteStepsCompleted: 3,
  durablePrerequisiteReceipts: 3,
  activeGovernedCommandsPassed: 24,
  dependencyBackedCommandsPassed: 6,
  totalCommandsPassed: 30,
  testsPassed: 61,
  productionBuild: 'PASS',
  installerBuild: 'NOT_RUN_NOT_PASS',
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  parent29EStatus: officialCompletion ? 'COMPLETED' : 'IN_PROGRESS_AWAITING_29-E4_LIBRARY_RECEIPT',
  nextOfficialStep: '29-F',
  nextOfficialStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-E4_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25,
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: closure.recordedAt,
  mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(officialCompletion ? 'artifacts/validation/29-E4-official-completion-regression.json' : 'artifacts/validation/29-E4-governed-29-e-closure.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-E4 governed 29-E closure: PASS (${checks} checks / 3 durable prerequisites / 30 executed commands).`);
