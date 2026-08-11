import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const commands = [
  {
    id: 'top-closure-contract',
    args: ['scripts/verify-31-x-ppk-002-top-closure-contract.mjs']
  },
  {
    id: 'remaining-boundaries-full-regression',
    args: ['scripts/verify-31-u-w-ppk-002-remaining-boundaries-runtime.mjs']
  },
  {
    id: 'focused-repository-policy-scope',
    args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts', '--reporter=dot'],
    minimumTests: 9
  }
];

const results = commands.map((command) => {
  const execution = spawnSync(process.execPath, command.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 240_000,
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
  step: '31-X',
  requirement: 'PPK-002',
  phase: 'TOP_CLOSURE_RUNTIME',
  status: failed.length === 0 ? 'PASS' : 'FAIL',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'UNIVERSAL_RENDERER_API_PEP',
    'UNIVERSAL_PRODUCTION_REPOSITORY_SCOPE_GATE',
    'SIGNED_BACKGROUND_SCHEDULER_PEP',
    'SIGNED_VAULT_SESSION_GUARD_PEP',
    'EXACT_BOOTSTRAP_REGISTRY',
    'STRICT_OBLIGATION_EXECUTION',
    'EXTERNAL_MONOTONIC_RECEIPT_AUTHORITY',
    'FULL_51_FILE_REGRESSION'
  ],
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/31-X-ppk-002-top-closure-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length > 0) {
  console.error(`31-X PPK-002 top-closure runtime: FAIL (${failed.length}/${results.length}).`);
  for (const result of failed) console.error(`${result.id}: ${result.outputTail}`);
  process.exit(1);
}
console.log(`31-X PPK-002 top-closure runtime: PASS (${results.length}/${results.length}).`);
