import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const rawPath = 'artifacts/validation/29-E3_DEPENDENCY_BACKED_CAPABILITY_EXECUTION_RAW.json';
const raw = await readJson(rawPath);
let officialCompletion = false;
try { await stat('artifacts/checkpoints/29-E3_COMPLETION_RECORD.json'); officialCompletion = true; } catch {}

check(raw.step === '29-E3' && raw.attempt === 5, 'execution identity mismatch');
check(raw.expected === 6 && raw.executed === 6 && raw.passed === 6 && raw.failed === 0, 'command count mismatch');
check(raw.status === 'PASS' && raw.childProcessExitCodesAllZero === true, 'execution is not clean PASS');
check(Array.isArray(raw.results) && raw.results.length === 6 && new Set(raw.results.map((item) => item.name)).size === 6, 'command result identity mismatch');
for (const item of raw.results) {
  check(Number.isInteger(item.exitCode) && item.exitCode === 0, `${item.name} missing real zero exit code`);
  const stdoutRaw = Buffer.from(item.stdoutRawBase64, 'base64');
  const stderrRaw = Buffer.from(item.stderrRawBase64, 'base64');
  check(item.stdoutSizeBytes === stdoutRaw.length && item.stderrSizeBytes === stderrRaw.length, `${item.name} output size mismatch`);
  check(item.stdoutSha256 === sha256(stdoutRaw) && item.stderrSha256 === sha256(stderrRaw), `${item.name} output hash mismatch`);
}

check(raw.toolchain.nodeVersion === '24.14.0' && raw.toolchain.npmVersion === '10.9.2' && raw.toolchain.packageManager === 'npm@10.9.2', 'toolchain identity mismatch');
check(raw.dependencyAudit.processExitCode === 0 && raw.dependencyAudit.vulnerabilities.total === 0, 'npm audit mismatch');
check(Object.values(raw.dependencyAudit.vulnerabilities).every((value) => value === 0), 'nonzero audit severity');
check(raw.dependencyTree.processExitCode === 0 && raw.dependencyTree.status === 'PASS', 'dependency tree mismatch');
check(raw.typecheck.processExitCode === 0 && raw.typecheck.status === 'PASS', 'typecheck mismatch');
check(raw.tests.processExitCode === 0 && raw.tests.testFilesPassed === 8 && raw.tests.testFilesTotal === 8, 'test file count mismatch');
check(raw.tests.testsPassed === 61 && raw.tests.testsTotal === 61 && raw.tests.status === 'PASS', 'test count mismatch');
check(raw.productionBuild.processExitCode === 0 && raw.productionBuild.status === 'PASS' && raw.productionBuild.cleanBuild === true, 'production build mismatch');
const buildOutput = raw.results.find((item) => item.name === '06_production_build')?.stdout ?? '';
for (const workspace of raw.productionBuild.requiredWorkspaceBuilds) check(buildOutput.includes(`${workspace}@4.8.2026-29 build`), `${workspace} build missing`);
check(raw.installerBuild === 'NOT_RUN_NOT_PASS', 'installer overclaim');
check(raw.packageLock.sha256 === '228e72333a8fb370907a9b1bad879bb16cd6a86f020679a0819d73b21b763e6a', 'package-lock binding mismatch');
check(raw.packageJson.sha256 === '8a742bd4d4e2e6de3ec6405f1812875b4e1df144e100ac803b09b6a22392a52d', 'package.json binding mismatch');
check(raw.mandatoryTruthSentence === TRUTH, 'truth sentence mismatch');

check(raw.preservedFailurePaths.length === 8, 'preserved failure count mismatch');
for (const path of raw.preservedFailurePaths) {
  const failure = await readJson(path);
  check(failure.status === 'FAIL', `${path} status changed`);
  check(failure.countedAsPass === false, `${path} counted as PASS`);
}
const plan = await readJson('config/work-segmentation-plan.json');
const e = plan.steps.find((item) => item.id === '29-E');
const e2 = e?.substeps?.find((item) => item.id === '29-E2');
const e3 = e?.substeps?.find((item) => item.id === '29-E3');
const e4 = e?.substeps?.find((item) => item.id === '29-E4');
const f = plan.steps.find((item) => item.id === '29-F');
const workflowClosed = plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS';
const eClosedForward = plan.currentStep === '29-F' && e?.status === 'COMPLETED' && e.validationStatus === 'PASS' && e.persistentReceiptStatus === 'PASS' && (f?.status === 'IN_PROGRESS' || workflowClosed);
check(eClosedForward || (plan.currentStep === '29-E' && e?.status === 'IN_PROGRESS'), '29-E lifecycle mismatch');
check(e2?.status === 'COMPLETED' && e2.validationStatus === 'PASS' && e2.persistentReceiptStatus === 'PASS', '29-E2 prerequisite mismatch');
if (officialCompletion) {
  check(e3?.status === 'COMPLETED' && e3.validationStatus === 'PASS' && e3.persistentReceiptStatus === 'PASS', '29-E3 completion lifecycle mismatch');
  if (eClosedForward) {
    check(e4?.status === 'COMPLETED' && e4.validationStatus === 'PASS' && e4.persistentReceiptStatus === 'PASS', '29-E4 durable closure mismatch');
  } else {
    check(e?.activeMicroStep === '29-E4' && e4?.status === 'IN_PROGRESS' && e4.validationStatus === 'PENDING' && e4.persistentReceiptStatus === 'PENDING', '29-E4 activation mismatch');
  }
} else {
  check(e?.activeMicroStep === '29-E3' && e3?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e3.validationStatus) && e3.persistentReceiptStatus === 'PENDING', '29-E3 active lifecycle mismatch');
  check(e4?.status === 'PENDING', '29-E4 premature lifecycle');
}
check(e.substeps.filter((item) => item.status === 'IN_PROGRESS').length === (eClosedForward ? 0 : 1), 'multiple active micro-steps');
const governance = await readJson('config/active-governance-ledger.json');
check(governance.activeMicroStep === (workflowClosed ? null : eClosedForward ? '29-F documents, deterministic package, exact-source and Library closure' : officialCompletion ? '29-E4 governed 29-E closure and durable receipt chain' : '29-E3 dependency-backed typecheck, tests and build capability execution'), 'governance micro-step mismatch');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const d4 = await readJson('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json');
const d5 = await readJson('artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json');
check(d3.summary.openGapCount === 9 && d3.summary.openContradictionCount === 0, 'governance truth changed');
check(d4.findingSummary.open === 8, 'technical finding truth changed');
check(d5.scopeMetrics.strictCompleteCount === 4 && d5.scopeMetrics.strictIncompleteCount === 346 && d5.scopeMetrics.promotionRequired.incomplete === 341, 'scope truth changed');

if (officialCompletion) {
  const receipt = await readJson('artifacts/checkpoints/29-E3_LIBRARY_RECEIPT.json');
  const library = await readJson('artifacts/validation/29-E3_LIBRARY_READBACK_VERIFICATION.json');
  const receiptReadback = await readJson('artifacts/validation/29-E3_RECEIPT_READBACK_VERIFICATION.json');
  const completion = await readJson('artifacts/checkpoints/29-E3_COMPLETION_RECORD.json');
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS', 'receipt semantic mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, 'payload readback mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, 'ZIP readback mismatch');
  check(library.status === 'PASS' && library.executed === 20 && library.matched === 20 && library.failed === 0 && library.zipPassed === 3, 'Library readback mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'receipt readback mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.nextMicroStep === '29-E4' && completion.nextMicroStepStatus === 'IN_PROGRESS', 'completion record mismatch');
  check([receipt, library, receiptReadback, completion].every((item) => item.mandatoryTruthSentence === TRUTH), 'completion truth sentence mismatch');
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-E3',
  phase: 'DEPENDENCY_BACKED_TYPECHECK_TEST_BUILD_CAPABILITY_VALIDATION',
  checks,
  failures,
  expected: 6,
  executed: raw.executed,
  passed: raw.passed,
  failed: raw.failed,
  npmVersion: raw.toolchain.npmVersion,
  npmAuditVulnerabilities: raw.dependencyAudit.vulnerabilities.total,
  typecheckProcessExitCode: raw.typecheck.processExitCode,
  testFilesPassed: raw.tests.testFilesPassed,
  testsPassed: raw.tests.testsPassed,
  productionBuildProcessExitCode: raw.productionBuild.processExitCode,
  installerBuild: 'NOT_RUN_NOT_PASS',
  preservedFailures: raw.preservedFailurePaths.length,
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  nextMicroStep: '29-E4',
  nextMicroStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-E3_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25,
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: raw.generatedAt,
  mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(officialCompletion ? 'artifacts/validation/29-E3-official-completion-regression.json' : 'artifacts/validation/29-E3_DEPENDENCY_BACKED_CAPABILITY_EXECUTION.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-E3 dependency-backed capability: PASS (${checks} checks / 6/6 process exits / 61/61 tests / production build).`);
