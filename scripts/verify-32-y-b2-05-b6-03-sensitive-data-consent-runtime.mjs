import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const node = process.execPath;
const commands = Object.freeze([
  Object.freeze({
    id: 'sensitive-data-consent-boundary',
    args: ['scripts/verify-sensitive-data-consent-boundary.mjs'],
    expectOutput: 'B2-05/B6-03 sensitive data consent boundary: PASS'
  }),
  Object.freeze({
    id: 'sensitive-data-consent-contract',
    args: ['scripts/verify-32-y-b2-05-b6-03-sensitive-data-consent-contract.mjs'],
    expectOutput: 'B2-05/B6-03 sensitive data consent contract: PASS'
  }),
  Object.freeze({
    id: 'ppk021-ast-ratchet',
    args: ['scripts/verify-platform-policy-ast-gate.mjs'],
    expectOutput: '"exactAllowlistEntries": 531'
  }),
  Object.freeze({
    id: 'ppk022-capability-ratchet',
    args: ['scripts/verify-platform-capability-manifest-gate.mjs'],
    expectOutput: '"exactManifestSurfaces": 238'
  }),
  Object.freeze({
    id: 'sensitive-data-consent-targeted-tests',
    args: ['node_modules/vitest/vitest.mjs', 'run',
      'packages/application/tests/sensitive-data-consent-use-cases.test.ts',
      'apps/desktop/tests/b2-b6-sensitive-data-consent-integration.test.ts',
      'apps/desktop/tests/data-store.test.ts',
      '-t', 'B2-05/B6-03|hassas veri profillerini',
      '--reporter=dot', '--maxWorkers=1'],
    minimumTests: 8,
    minimumTestFiles: 3
  }),
  Object.freeze({
    id: 'root-typescript',
    args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']
  }),
  Object.freeze({
    id: 'database-package-build',
    args: ['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']
  }),
  Object.freeze({
    id: 'migration-77-regression',
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 77'
  }),
  Object.freeze({
    id: 'decision-ledger',
    args: ['scripts/verify-user-decision-ledger.mjs'],
    expectOutput: 'User Decision Ledger: PASS'
  })
]);

const results = commands.map((command) => {
  const execution = spawnSync(node, command.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 900_000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    env: process.env
  });
  const output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`.replace(/\r\n/gu, '\n').trim();
  const testsMatch = output.match(/Tests\s+(\d+) passed/u);
  const filesMatch = output.match(/Test Files\s+(\d+) passed/u);
  const tests = testsMatch ? Number.parseInt(testsMatch[1], 10) : undefined;
  const testFiles = filesMatch ? Number.parseInt(filesMatch[1], 10) : undefined;
  const passed = execution.status === 0
    && execution.signal === null
    && execution.error === undefined
    && (command.expectOutput === undefined || output.includes(command.expectOutput))
    && (command.minimumTests === undefined || (tests ?? 0) >= command.minimumTests)
    && (command.minimumTestFiles === undefined || (testFiles ?? 0) >= command.minimumTestFiles);
  return Object.freeze({
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: execution.status,
    signal: execution.signal,
    ...(tests === undefined ? {} : { tests }),
    ...(testFiles === undefined ? {} : { testFiles }),
    outputTail: output.slice(-4_000)
  });
});
const failures = results.filter((result) => result.status !== 'PASS').map((result) => result.id);
const targeted = results.find((result) => result.id === 'sensitive-data-consent-targeted-tests');
const report = Object.freeze({
  schemaVersion: 1,
  step: '32-Y',
  requirements: Object.freeze(['B2-05', 'B6-03']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length,
  checksFailed: failures.length,
  targetedTestFilesPassed: targeted?.testFiles ?? 0,
  targetedTestsPassed: targeted?.tests ?? 0,
  latestDatabaseMigration: 77,
  ppk021ExactAllowlistEntries: 531,
  ppk022CapabilitySurfaces: 238,
  outboundTransferPerformed: false,
  results: Object.freeze(results),
  failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B2-05/B6-03 sensitive data consent runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
