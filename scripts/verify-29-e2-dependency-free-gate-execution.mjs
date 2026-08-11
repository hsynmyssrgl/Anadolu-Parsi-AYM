import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const inventory = await readJson('artifacts/inventory/29-E1_TARGETED_TEST_SECURITY_GATE_INVENTORY.json');
const expected = inventory.scripts.filter((item) => item.executionClass === 'DEPENDENCY_FREE_NODE' && item.name.startsWith('verify:'));
const batchDirectory = 'artifacts/validation/29-E2_batches';
const batchFiles = (await readdir(batchDirectory)).filter((name) => /^batch-\d+\.json$/u.test(name)).sort((a, b) => Number(a.match(/\d+/u)[0]) - Number(b.match(/\d+/u)[0]));
const batches = await Promise.all(batchFiles.map((name) => readJson(`${batchDirectory}/${name}`)));
const results = batches.flatMap((batch) => batch.results);
check(batchFiles.length > 0, 'no batch evidence');
check(batches.every((batch) => batch.collectorProcessStatus === 'PASS'), 'collector process failure');
check(results.length === expected.length, `executed gate count mismatch=${results.length}/${expected.length}`);
check(new Set(results.map((item) => item.name)).size === results.length, 'duplicate executed gate');
check(expected.every((item, index) => results[index]?.name === item.name && results[index]?.command === item.command), 'gate order or command binding mismatch');
for (const item of results) {
  check(item.executionClass === 'DEPENDENCY_FREE_NODE', `${item.name} execution class mismatch`);
  check(item.segmentResults.length > 0, `${item.name} no process segment`);
  check(item.segmentResults.every((segment) => Number.isInteger(segment.exitCode)), `${item.name} missing real exit code`);
  check(item.exitCode === item.segmentResults.at(-1).exitCode, `${item.name} aggregate exit code mismatch`);
  check(item.segmentResults.every((segment) => segment.stdoutSha256 === sha256(segment.stdout) && segment.stderrSha256 === sha256(segment.stderr)), `${item.name} output hash mismatch`);
}
const failedResults = results.filter((item) => item.exitCode !== 0);
const securityResults = results.filter((item) => item.securityCandidate);
const targetedResults = results.filter((item) => item.targetedTestCandidate);
const plan = await readJson('config/work-segmentation-plan.json');
const e = plan.steps.find((item) => item.id === '29-E');
const e1 = e?.substeps?.find((item) => item.id === '29-E1');
const e2 = e?.substeps?.find((item) => item.id === '29-E2');
check(plan.currentStep === '29-E' && e?.status === 'IN_PROGRESS' && e?.activeMicroStep === '29-E2', '29-E active state mismatch');
check(e1?.status === 'COMPLETED' && e1.validationStatus === 'PASS' && e1.persistentReceiptStatus === 'PASS', '29-E1 durable prerequisite mismatch');
check(e2?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(e2.validationStatus) && e2.persistentReceiptStatus === 'PENDING', '29-E2 lifecycle mismatch');
check(e.substeps.filter((item) => item.status === 'IN_PROGRESS').length === 1, 'multiple active 29-E micro-steps');
const governance = await readJson('config/active-governance-ledger.json');
check(governance.activeMicroStep === '29-E2 dependency-free targeted contract/runtime and security gates', 'governance micro-step mismatch');
check(inventory.toolchain.npm.status === 'NOT_FOUND' && inventory.toolchain.nodeModules.status === 'NOT_FOUND', 'dependency state changed without evidence');
check(inventory.toolchain.dependencyBackedExecution.typecheck === 'NOT_RUN_NOT_PASS', 'dependency-backed execution overclaimed');
check(inventory.unresolvedTruth.governanceGapsOpen === 9 && inventory.unresolvedTruth.technicalFindingsOpen === 8 && inventory.unresolvedTruth.acceptedScopeIncomplete === 346, 'open truth changed');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-E2',
  phase: 'DEPENDENCY_FREE_TARGETED_CONTRACT_RUNTIME_SECURITY_GATE_EXECUTION',
  checks,
  failures,
  batchFiles,
  expected: expected.length,
  executed: results.length,
  passed: results.length - failedResults.length,
  failed: failedResults.length,
  securityGateExecuted: securityResults.length,
  securityGatePassed: securityResults.filter((item) => item.exitCode === 0).length,
  securityGateFailed: securityResults.filter((item) => item.exitCode !== 0).length,
  targetedGateExecuted: targetedResults.length,
  targetedGatePassed: targetedResults.filter((item) => item.exitCode === 0).length,
  targetedGateFailed: targetedResults.filter((item) => item.exitCode !== 0).length,
  failedCommands: failedResults.map((item) => ({ name: item.name, command: item.command, exitCode: item.exitCode, stderrSha256: item.segmentResults.at(-1).stderrSha256 })),
  childProcessExitCodesAllZero: failedResults.length === 0,
  dependencyBackedExecution: 'NOT_RUN_NOT_PASS',
  platformSpecificExecution: 'NOT_RUN_NOT_PASS',
  persistentReceiptStatus: 'PENDING',
  nextMicroStep: '29-E3',
  nextMicroStepStatus: 'PENDING_AWAITING_29-E2_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25,
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length === 0 && failedResults.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-E2_DEPENDENCY_FREE_GATE_EXECUTION.json', JSON.stringify(report, null, 2) + '\n');
if (report.status !== 'PASS') {
  console.error(`29-E2 dependency-free gates: FAIL (${report.passed}/${report.executed}; ${report.failed} child failures; ${failures.length} evidence failures).`);
  process.exit(1);
}
console.log(`29-E2 dependency-free gates: PASS (${checks} evidence checks / ${report.passed}/${report.executed} child processes / ${report.securityGatePassed} security gates).`);
