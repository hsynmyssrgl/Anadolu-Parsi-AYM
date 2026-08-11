import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'ppk-008-contract',
    args: ['scripts/verify-32-d-ppk-008-application-identity-device-certificate-manifest-contract.mjs'],
    expectOutput: 'PASS (34/34)'
  },
  {
    id: 'ppk-008-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/application-identity-device-certificate.test.ts', '--reporter=dot'],
    minimumTests: 10
  },
  {
    id: 'platform-policy-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy', '--reporter=dot'],
    minimumTests: 88
  },
  {
    id: 'production-authority-regression',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/core-service-method-dispatcher.test.ts', 'apps/desktop/tests/archive-production-policy-runtime.test.ts', 'apps/desktop/tests/data-store.test.ts', '--reporter=dot'],
    minimumTests: 20
  },
  {
    id: 'migration-73-runtime',
    before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']],
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 73'
  },
  {
    id: 'durable-identity-repository-regression',
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
    minimumTests: 360
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
  step: '32-D',
  requirement: 'PPK-008',
  phase: 'APPLICATION_IDENTITY_DEVICE_CERTIFICATE_MANIFEST_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'CANONICAL_APPLICATION_IDENTITIES',
    'SIGNED_CAPABILITY_MANIFEST_SHA256',
    'TRUSTED_DEVICE_CERTIFICATE_BINDING',
    'STRICT_REQUEST_DECISION_RECEIPT_BINDING',
    'PRODUCTION_AUTHORITY_BINDING',
    'MIGRATION_73_IDENTITY_BINDING',
    'DURABLE_REPOSITORY_BINDING',
    'FULL_VITEST_REGRESSION'
  ],
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-D-ppk-008-application-identity-device-certificate-manifest-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(`32-D PPK-008 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`32-D PPK-008 runtime: PASS (${results.length}/${results.length}).`);
