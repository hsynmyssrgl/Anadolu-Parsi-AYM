import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) {
  throw new Error(`Unsafe source root: ${root}`);
}

const lifecycleChecks = Object.freeze([
  ['31-L contract', 'scripts/verify-31-l-protected-cutover-readiness-journal-port-contract.mjs', '--successor-regression'],
  ['31-L completion', 'scripts/verify-31-l-protected-cutover-readiness-journal-port-completion-transition.mjs'],
  ['31-M contract', 'scripts/verify-31-m-signed-cutover-readiness-evidence-verifier-boundary-contract.mjs', '--successor-regression'],
  ['31-M completion', 'scripts/verify-31-m-signed-cutover-readiness-evidence-verifier-boundary-completion-transition.mjs'],
  ['31-N contract', 'scripts/verify-31-n-synthetic-single-writer-proof-harness-contract.mjs', '--successor-regression'],
  ['31-N completion', 'scripts/verify-31-n-synthetic-single-writer-proof-harness-completion-transition.mjs'],
  ['31-O contract', 'scripts/verify-31-o-synthetic-key-lifecycle-proof-harness-contract.mjs', '--successor-regression'],
  ['31-O completion', 'scripts/verify-31-o-synthetic-key-lifecycle-proof-harness-completion-transition.mjs'],
  ['31-P contract', 'scripts/verify-31-p-synthetic-rollback-recovery-drill-contract.mjs', '--successor-regression'],
  ['31-P completion', 'scripts/verify-31-p-synthetic-rollback-recovery-drill-completion-transition.mjs'],
  ['31-Q contract', 'scripts/verify-31-q-end-to-end-security-evidence-aggregator-contract.mjs', '--successor-regression'],
  ['31-Q completion', 'scripts/verify-31-q-end-to-end-security-evidence-aggregator-completion-transition.mjs'],
  ['31-R contract', 'scripts/verify-31-r-explicit-user-approval-receipt-boundary-contract.mjs', '--successor-regression'],
  ['31-R completion', 'scripts/verify-31-r-explicit-user-approval-receipt-boundary-completion-transition.mjs'],
  ['31-S contract', 'scripts/verify-31-s-versioned-cutover-decision-preflight-contract.mjs', '--successor-regression'],
  ['31-S completion', 'scripts/verify-31-s-versioned-cutover-decision-preflight-completion-transition.mjs']
]);

const targetedTests = Object.freeze([
  'apps/core-service/tests/protected-cutover-readiness-journal-port.test.ts',
  'apps/core-service/tests/signed-cutover-readiness-evidence-verifier.test.ts',
  'apps/core-service/tests/synthetic-single-writer-proof-harness.test.ts',
  'apps/core-service/tests/synthetic-key-lifecycle-proof-harness.test.ts',
  'apps/core-service/tests/synthetic-rollback-recovery-drill.test.ts',
  'apps/core-service/tests/end-to-end-security-evidence-aggregator.test.ts',
  'apps/core-service/tests/explicit-user-cutover-approval-receipt.test.ts',
  'apps/core-service/tests/versioned-cutover-decision-preflight.test.ts',
  'apps/core-service/tests/cutover-foundation-fuzz.test.ts'
]);

const run = (name, args) => {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    maxBuffer: 24 * 1024 * 1024
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  if (result.status !== 0) {
    if (output) console.error(output);
    throw new Error(`${name} failed with exit code ${result.status ?? 1}`);
  }
  return output;
};

for (const [name, ...args] of lifecycleChecks) run(name, args);
const vitestOutput = run('31-L through 31-S targeted Vitest', [
  'node_modules/vitest/vitest.mjs',
  'run',
  ...targetedTests
]);
const fileCount = Number(vitestOutput.match(/Test Files\s+(\d+) passed/u)?.[1] ?? 0);
const testCount = Number(vitestOutput.match(/Tests\s+(\d+) passed/u)?.[1] ?? 0);
if (fileCount !== targetedTests.length || testCount < 1) {
  throw new Error(`Targeted Vitest count mismatch: files=${fileCount}; tests=${testCount}`);
}

console.log(`31-L..31-S cutover foundation gate: PASS (${lifecycleChecks.length}/${lifecycleChecks.length} lifecycle checks; ${testCount}/${testCount} tests in ${fileCount} files).`);
