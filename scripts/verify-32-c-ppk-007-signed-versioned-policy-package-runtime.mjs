import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'ppk-007-contract',
    args: ['scripts/verify-32-c-ppk-007-signed-versioned-policy-package-contract.mjs'],
    expectOutput: 'PASS (32/32)'
  },
  {
    id: 'ppk-007-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/policy-package-version-binding.test.ts', '--reporter=dot'],
    minimumTests: 17
  },
  {
    id: 'platform-policy-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy', '--reporter=dot'],
    minimumTests: 78
  },
  {
    id: 'core-service-package-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/core-service-method-dispatcher.test.ts', 'apps/core-service/tests/platform-policy-obligation-execution.test.ts', '--reporter=dot'],
    minimumTests: 5
  },
  {
    id: 'migration-72-runtime',
    before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']],
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 72'
  },
  {
    id: 'durable-package-repository-regression',
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
    minimumTests: 350
  }
];

const execute = (args) => spawnSync(process.execPath, args, {
  cwd: process.cwd(), encoding: 'utf8', timeout: 300_000,
  maxBuffer: 32 * 1024 * 1024, windowsHide: true
});
const results = commands.map((command) => {
  const preparations = (command.before ?? []).map(execute);
  const execution = preparations.some((item) => item.status !== 0) ? preparations.find((item) => item.status !== 0) : execute(command.args);
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
  step: '32-C',
  requirement: 'PPK-007',
  phase: 'SIGNED_VERSIONED_POLICY_PACKAGE_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'DETERMINISTIC_SIGNED_POLICY_PACKAGE',
    'SHA256_PAYLOAD_BINDING',
    'APPLICATION_VERSION_DEFAULT_DENY',
    'PROVIDER_PACKAGE_METADATA',
    'CORE_DESKTOP_STARTUP_VERSION_GATE',
    'MIGRATION_72_PACKAGE_BINDING',
    'DURABLE_REPOSITORY_BINDING',
    'FULL_VITEST_REGRESSION'
  ],
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-C-ppk-007-signed-versioned-policy-package-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(`32-C PPK-007 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`32-C PPK-007 runtime: PASS (${results.length}/${results.length}).`);
