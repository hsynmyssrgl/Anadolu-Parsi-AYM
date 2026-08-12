import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const node = process.execPath;
const commands = Object.freeze([
  Object.freeze({
    id: 'b4-loan-boundary',
    args: ['scripts/verify-b4-loan-management-boundary.mjs'],
    expectOutput: 'B4 loan management boundary: PASS'
  }),
  Object.freeze({
    id: 'b4-loan-contract',
    args: ['scripts/verify-33-b-b4-loan-management-contract.mjs'],
    expectOutput: 'B4 loan management contract: PASS'
  }),
  Object.freeze({
    id: 'b4-loan-targeted-tests',
    args: ['node_modules/vitest/vitest.mjs', 'run',
      'packages/application/tests/loan-management.test.ts',
      'apps/desktop/tests/b4-loan-management-ipc-integration.test.ts',
      'apps/desktop/tests/data-store.test.ts',
      '-t', '33-B|B4-08/B4-09', '--reporter=dot', '--maxWorkers=1'],
    minimumTests: 21,
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
    id: 'migration-80-runtime',
    args: ['scripts/verify-database-migrations.mjs'],
    expectOutput: '"version": 80'
  }),
  Object.freeze({
    id: 'ppk021-ast-ratchet',
    args: ['scripts/verify-platform-policy-ast-gate.mjs'],
    expectOutput: '"exactAllowlistEntries": 540'
  }),
  Object.freeze({
    id: 'ppk022-capability-ratchet',
    args: ['scripts/verify-platform-capability-manifest-gate.mjs'],
    expectOutput: '"exactManifestSurfaces": 238'
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
    && execution.signal === null && execution.error === undefined
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
const targeted = results.find((result) => result.id === 'b4-loan-targeted-tests');
const report = Object.freeze({
  schemaVersion: 1,
  step: '33-B',
  requirements: Object.freeze(['B4-08', 'B4-09']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length,
  checksFailed: failures.length,
  targetedTestFilesPassed: targeted?.testFiles ?? 0,
  targetedTestsPassed: targeted?.tests ?? 0,
  latestDatabaseMigration: 80,
  ppk021ExactAllowlistEntries: 540,
  ppk021UseCaseCompositionSurfaces: 272,
  ppk022CapabilitySurfaces: 238,
  prohibitedSecretColumns: 0,
  bankVerificationPerformed: false,
  bankExecutionPerformed: false,
  results: Object.freeze(results),
  failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-B-b4-loan-management-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 loan management runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
