import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'ppk-006-contract',
    args: ['scripts/verify-32-b-ppk-006-complete-policy-obligation-suite-contract.mjs'],
    expectOutput: 'PASS (32/32)'
  },
  {
    id: 'ppk-006-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/policy-obligation-suite.test.ts', '--reporter=dot'],
    minimumTests: 15
  },
  {
    id: 'core-service-obligation-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/platform-policy-obligation-execution.test.ts', '--reporter=dot'],
    minimumTests: 2
  },
  {
    id: 'database-package-build',
    args: ['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'],
    expectOutput: ''
  },
  {
    id: 'migration-71-runtime',
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 71'
  },
  {
    id: 'durable-obligation-repository-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts', '--reporter=dot'],
    minimumTests: 17
  },
  {
    id: 'root-typescript',
    args: ['node_modules/typescript/bin/tsc', '--noEmit'],
    expectOutput: ''
  },
  {
    id: 'full-vitest-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot'],
    minimumTests: 333
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
  const outputSatisfied = command.expectOutput === undefined || output.includes(command.expectOutput);
  const passed = execution.status === 0 && execution.signal === null && execution.error === undefined && countSatisfied && outputSatisfied;
  return Object.freeze({
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: execution.status,
    signal: execution.signal,
    ...(execution.error ? { error: execution.error.message } : {}),
    ...(tests === undefined ? {} : { tests }),
    ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    ...(command.expectOutput === undefined ? {} : { expectedOutput: command.expectOutput }),
    outputSha256: sha256(output),
    outputTail: output.length <= 1_600 ? output : output.slice(-1_600)
  });
});

const failed = results.filter((result) => result.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-B',
  requirement: 'PPK-006',
  phase: 'COMPLETE_POLICY_OBLIGATION_SUITE_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'EIGHT_SIGNED_OBLIGATIONS',
    'CANONICAL_OBLIGATION_VALIDATION',
    'CONFLICTING_OPERATION_DEFAULT_DENY',
    'PRE_OPERATION_CONTROL_EXECUTION',
    'SHA256_EXECUTION_ATTESTATION',
    'MIGRATION_71_EXECUTION_HASH',
    'SQLITE_OBLIGATION_TRIGGER',
    'DURABLE_REPOSITORY_BINDING',
    'FULL_VITEST_REGRESSION'
  ],
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-B-ppk-006-complete-policy-obligation-suite-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(`32-B PPK-006 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`32-B PPK-006 runtime: PASS (${results.length}/${results.length}).`);
