import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const node = process.execPath;
const commands = Object.freeze([
  Object.freeze({
    id: 'desktop-security-contract',
    args: ['scripts/verify-32-x-b2-03-b2-04-desktop-security-contract.mjs'],
    expectOutput: 'B2-03/B2-04 desktop security contract: PASS'
  }),
  Object.freeze({
    id: 'desktop-security-boundary',
    args: ['scripts/verify-desktop-security-boundary.mjs'],
    expectOutput: 'B2-03/B2-04 desktop security boundary: PASS'
  }),
  Object.freeze({
    id: 'electron-fuse-static-policy',
    args: ['scripts/verify-electron-fuse-policy.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'ppk021-ast-ratchet',
    args: ['scripts/verify-platform-policy-ast-gate.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'ppk022-capability-ratchet',
    args: ['scripts/verify-platform-capability-manifest-gate.mjs'],
    expectOutput: '"status": "PASS"'
  }),
  Object.freeze({
    id: 'desktop-security-targeted-tests',
    args: ['node_modules/vitest/vitest.mjs', 'run',
      'packages/security/tests/session-lock.test.ts',
      'packages/application/tests/desktop-security-use-cases.test.ts',
      'apps/desktop/tests/b2-desktop-security-integration.test.ts',
      '--reporter=dot', '--maxWorkers=1'],
    minimumTests: 11,
    minimumTestFiles: 3
  }),
  Object.freeze({
    id: 'root-typescript',
    args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit']
  }),
  Object.freeze({
    id: 'feature-reality-and-decision-ledger',
    args: ['scripts/verify-feature-reality-gate.mjs'],
    expectOutput: 'Feature Reality Gate: PASS'
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
const report = Object.freeze({
  schemaVersion: 1,
  step: '32-X',
  requirements: Object.freeze(['B2-03', 'B2-04']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: results.length - failures.length,
  checksFailed: failures.length,
  results: Object.freeze(results),
  failures: Object.freeze(failures),
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-X-b2-03-b2-04-desktop-security-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B2-03/B2-04 desktop security runtime: ${report.status} (${report.checksPassed}/${results.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
