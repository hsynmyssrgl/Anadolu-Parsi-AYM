import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'ppk-005-contract',
    args: ['scripts/verify-32-a-ppk-005-complete-data-classification-contract.mjs'],
    expectOutput: 'PASS (30/30)'
  },
  {
    id: 'ppk-005-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/policy-data-classification.test.ts', '--reporter=dot'],
    minimumTests: 24
  },
  {
    id: 'core-service-classified-context-api-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/core-service-method-dispatcher.test.ts', '--reporter=dot'],
    minimumTests: 3
  },
  {
    id: 'database-package-build',
    args: ['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'],
    expectOutput: ''
  },
  {
    id: 'migration-70-runtime',
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 70'
  },
  {
    id: 'durable-classification-repository-regression',
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
    minimumTests: 318
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
  step: '32-A',
  requirement: 'PPK-005',
  phase: 'COMPLETE_DATA_CLASSIFICATION_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'TEN_ACCEPTED_DATA_CLASSES',
    'CANONICAL_MULTI_CLASS_SET',
    'DECLARED_VS_POLICY_DEFAULT_AUTHORITY',
    'CAPABILITY_CLASS_COMPATIBILITY',
    'CHILD_BIOMETRIC_LEGACY_OBLIGATIONS',
    'SIGNED_CONTEXT_CLASS_BINDING',
    'STRICT_CORE_SERVICE_CLASSIFICATION',
    'MIGRATION_70_DATA_CLASSES',
    'SQLITE_CLASSIFICATION_TRIGGER',
    'FULL_VITEST_REGRESSION'
  ],
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-A-ppk-005-complete-data-classification-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(`32-A PPK-005 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`32-A PPK-005 runtime: PASS (${results.length}/${results.length}).`);
