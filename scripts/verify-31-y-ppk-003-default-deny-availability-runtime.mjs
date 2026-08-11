import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'ppk-003-contract',
    args: ['scripts/verify-31-y-ppk-003-default-deny-availability-contract.mjs']
  },
  {
    id: 'ppk-003-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/policy-decision-availability.test.ts', '--reporter=dot'],
    minimumTests: 9
  },
  {
    id: 'ppk-002-universal-enforcement-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts', '--reporter=dot'],
    minimumTests: 9
  },
  {
    id: 'full-vitest-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot'],
    minimumTests: 280
  }
];

const results = commands.map((command) => {
  const execution = spawnSync(process.execPath, command.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  const output = normalize(`${execution.stdout ?? ''}\n${execution.stderr ?? ''}`);
  const testMatch = output.match(/Tests\s+(\d+) passed/u);
  const tests = testMatch ? Number.parseInt(testMatch[1], 10) : undefined;
  const countSatisfied = command.minimumTests === undefined || (tests !== undefined && tests >= command.minimumTests);
  const passed = execution.status === 0 && execution.signal === null && execution.error === undefined && countSatisfied;
  return Object.freeze({
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: execution.status,
    signal: execution.signal,
    ...(execution.error ? { error: execution.error.message } : {}),
    ...(tests === undefined ? {} : { tests }),
    ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    outputSha256: sha256(output),
    outputTail: output.length <= 1_600 ? output : output.slice(-1_600)
  });
});

const failed = results.filter((result) => result.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-Y',
  requirement: 'PPK-003',
  phase: 'DEFAULT_DENY_AVAILABILITY_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'BOUNDED_AUTHORITY_RESOLUTION',
    'BOUNDED_RESOURCE_RESOLUTION',
    'BOUNDED_REPLAY_RESERVATION',
    'BOUNDED_POLICY_AUTHORIZATION',
    'BOUNDED_RECEIPT_VERIFICATION',
    'BOUNDED_RECEIPT_PERSISTENCE',
    'LATE_ALLOW_NON_EXECUTION',
    'UNIVERSAL_DESKTOP_API_REGRESSION',
    'FULL_VITEST_REGRESSION'
  ],
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/31-Y-ppk-003-default-deny-availability-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(`31-Y PPK-003 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`31-Y PPK-003 runtime: PASS (${results.length}/${results.length}).`);
