import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const gates = [
  ['29-D2-D parent', 'scripts/verify-29-d2-d3-parent-finalization.mjs', 'DURABLE_WORKFLOW_REGRESSION'],
  ['29-D3 analysis', 'scripts/verify-29-d3-rule-gap-conflict-analysis.mjs', 'DURABLE_WORKFLOW_REGRESSION'],
  ['29-D4 assessment', 'scripts/verify-29-d4-technical-assessment.mjs', 'DURABLE_WORKFLOW_REGRESSION'],
  ['29-D5 progress', 'scripts/verify-29-d5-scope-real-progress-report.mjs', 'DURABLE_WORKFLOW_REGRESSION'],
  ['29-D6 closure', 'scripts/verify-29-d6-governed-final-closure.mjs', 'DURABLE_WORKFLOW_REGRESSION'],
  ['29-E1 inventory', 'scripts/verify-29-e1-test-security-inventory.mjs', 'DURABLE_WORKFLOW_REGRESSION'],
  ['canonical rules', 'scripts/verify-canonical-rule-registry.mjs', 'ACTIVE_SECURITY_GOVERNANCE'],
  ['user decisions', 'scripts/verify-user-decision-ledger.mjs', 'ACTIVE_SECURITY_GOVERNANCE'],
  ['universal enforcement', 'scripts/verify-universal-rule-enforcement.mjs', 'ACTIVE_SECURITY_GOVERNANCE'],
  ['step checkpoint', 'scripts/verify-step-checkpoint-gate.mjs', 'ACTIVE_SECURITY_GOVERNANCE'],
  ['active release', 'scripts/verify-active-release-contract-v2.mjs', 'ACTIVE_RELEASE_CONTRACT'],
  ['workspace dependencies', 'scripts/verify-workspace-dependencies.mjs', 'ACTIVE_ARCHITECTURE_CONTRACT'],
  ['conversation capacity', 'scripts/verify-conversation-capacity-policy.mjs', 'ACTIVE_HONESTY_GATE'],
  ['feature reality', 'scripts/verify-feature-reality-gate.mjs', 'ACTIVE_HONESTY_GATE'],
  ['platform policy', 'scripts/verify-platform-policy-gate.mjs', 'ACTIVE_SECURITY_GOVERNANCE'],
  ['core service boundary', 'scripts/verify-core-service-boundary.mjs', 'ACTIVE_SECURITY_BOUNDARY'],
  ['local admin contract', 'scripts/verify-core-service-local-admin-contract.mjs', 'ACTIVE_SECURITY_BOUNDARY'],
  ['local admin runtime', 'scripts/verify-core-service-local-admin-runtime-wrapper.mjs', 'ACTIVE_CONTROLLED_RUNTIME'],
  ['desktop startup contract', 'scripts/verify-desktop-core-service-startup-contract.mjs', 'ACTIVE_SECURITY_BOUNDARY'],
  ['desktop startup runtime', 'scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs', 'ACTIVE_CONTROLLED_RUNTIME'],
  ['system health contract', 'scripts/verify-system-health-core-service-ipc-contract.mjs', 'ACTIVE_SECURITY_BOUNDARY'],
  ['system health runtime', 'scripts/verify-system-health-core-service-ipc-runtime-wrapper.mjs', 'ACTIVE_CONTROLLED_RUNTIME'],
  ['artifact index generation', 'scripts/generate-project-artifact-index-v2.mjs', 'ACTIVE_DOCUMENT_INTEGRITY'],
  ['artifact index verification', 'scripts/verify-project-artifact-index-v2.mjs', 'ACTIVE_DOCUMENT_INTEGRITY'],
];
const results = [];
for (const [name, script, scope] of gates) {
  const run = spawnSync(process.execPath, [script], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const stdout = run.stdout ?? '';
  const stderr = run.stderr ?? '';
  const exitCode = Number.isInteger(run.status) ? run.status : 125;
  results.push({ name, script, scope, exitCode, signal: run.signal ?? null, error: run.error ? `${run.error.name}: ${run.error.message}` : null, stdout, stderr, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr), status: exitCode === 0 ? 'PASS' : 'FAIL' });
}
const failed = results.filter((item) => item.exitCode !== 0).length;
const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '29-E2', phase: 'ACTIVE_GOVERNED_TARGETED_CONTRACT_RUNTIME_SECURITY_GATE_EXECUTION',
  selectionAuthority: ['scripts/run-governed-preflight.mjs', 'config/work-segmentation-plan.json', 'artifacts/checkpoints/29-E1_CLASSIFICATION_LIMITATION_CORRECTION.json'],
  expected: gates.length, executed: results.length, passed: results.length - failed, failed, results,
  childProcessExitCodesAllZero: failed === 0, status: failed === 0 ? 'PASS' : 'FAIL', generatedAt: new Date().toISOString(),
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-E2_ACTIVE_GOVERNED_GATE_EXECUTION_RAW.json', JSON.stringify(report, null, 2) + '\n');
console.log(`29-E2 active governed gates: ${report.status} (${report.passed}/${report.executed} real child process exit codes).`);
