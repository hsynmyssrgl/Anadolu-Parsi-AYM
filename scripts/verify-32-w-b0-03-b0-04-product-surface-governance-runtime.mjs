import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const root = process.cwd();
const node = process.execPath;
const commands = Object.freeze([
  Object.freeze({
    id: 'b0-surface-contract',
    args: ['scripts/verify-32-w-b0-03-b0-04-product-surface-governance-contract.mjs'],
    expectOutput: 'B0-03/B0-04 product surface contract: PASS'
  }),
  Object.freeze({
    id: 'b0-surface-source-boundary',
    args: ['scripts/verify-product-surface-governance.mjs'],
    expectOutput: 'B0-03/B0-04 product surface boundary: PASS'
  }),
  Object.freeze({
    id: 'feature-reality-gate',
    args: ['scripts/verify-feature-reality-gate.mjs'],
    expectOutput: 'Feature Reality Gate: PASS'
  }),
  Object.freeze({
    id: 'b0-surface-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run',
      'packages/application/tests/product-surface-governance-use-cases.test.ts',
      'apps/desktop/tests/b0-product-surface-governance-integration.test.ts',
      '--reporter=dot', '--maxWorkers=1'],
    minimumTests: 6,
    minimumTestFiles: 2
  }),
  Object.freeze({
    id: 'root-typescript',
    args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']
  }),
  Object.freeze({
    id: 'decision-ledger',
    args: ['scripts/verify-user-decision-ledger.mjs'],
    expectOutput: 'User Decision Ledger: PASS'
  })
]);

const execute = (command) => spawnSync(node, command.args, {
  cwd: root,
  encoding: 'utf8',
  timeout: 900_000,
  maxBuffer: 64 * 1024 * 1024,
  windowsHide: true,
  env: process.env
});

const results = commands.map((command) => {
  const execution = execute(command);
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
const report = Object.freeze({
  schemaVersion: 1,
  step: '32-W',
  requirements: Object.freeze(['B0-03', 'B0-04']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length,
  checksFailed: failures.length,
  results: Object.freeze(results),
  failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0,
  b901CompletedByThisPackage: false,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-W-b0-03-b0-04-product-surface-governance-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B0-03/B0-04 product surface runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
