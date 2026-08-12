import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const root = process.cwd();
const node = process.execPath;
const targetedFiles = Object.freeze([
  'packages/core-service-client/generated-policy-client.test.ts',
  'packages/core-service-client/core-service-policy-sdk.test.ts',
  'packages/platform-policy/typed-policy-sdk.test.ts',
  'apps/desktop/tests/ppk026-typed-policy-sdk-integration.test.ts',
  'apps/desktop/tests/finance-policy-enforcement-runtime.test.ts',
  'apps/desktop/tests/health-policy-enforcement-runtime.test.ts'
]);
const commands = Object.freeze([
  Object.freeze({
    id: 'ppk-026-contract',
    args: ['scripts/verify-32-v-ppk-026-typed-policy-sdk-contract.mjs'],
    expectOutput: 'PPK-026/XPF-003 contract: PASS'
  }),
  Object.freeze({
    id: 'ppk-026-deterministic-codegen',
    args: ['scripts/verify-ppk026-policy-client.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'ppk-026-static-sdk-boundary',
    args: ['scripts/verify-typed-policy-sdk-boundary.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'ppk-026-six-file-targeted-runtime',
    args: ['node_modules/vitest/vitest.mjs', 'run', ...targetedFiles, '--reporter=dot', '--maxWorkers=1'],
    minimumTests: 26,
    minimumTestFiles: 6
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
  step: '32-V',
  requirements: Object.freeze(['PPK-026', 'XPF-003']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length,
  checksFailed: failures.length,
  results: Object.freeze(results),
  failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0,
  dha011CompletedByThisPackage: false,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-V-ppk-026-typed-policy-sdk-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`PPK-026/XPF-003 runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
