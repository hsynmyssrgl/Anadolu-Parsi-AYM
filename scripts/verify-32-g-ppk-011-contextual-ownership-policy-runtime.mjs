import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const packageBuild = [
  ['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/domain/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/repository-contracts/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/security/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/repositories/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/application/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','tests/smoke/tsconfig.data-store.json']
];
const commands = [
  { id: 'ppk-011-contract', args: ['scripts/verify-32-g-ppk-011-contextual-ownership-policy-contract.mjs'], expectOutput: 'PASS (32/32)' },
  { id: 'ppk-011-targeted-contextual-ownership', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/ppk011-contextual-ownership-policy.test.ts','--reporter=dot'], minimumTests: 12 },
  { id: 'central-and-platform-policy-regression', args: ['node_modules/vitest/vitest.mjs','run','packages/platform-policy','packages/security','--reporter=dot'], minimumTests: 100 },
  { id: 'authorization-use-case-repository-runtime', before: packageBuild, args: ['scripts/verify-authorization-audit.mjs'], expectOutput: '12/12' },
  { id: 'migration-75-runtime', before: [['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 75' },
  { id: 'data-store-regression', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/data-store.test.ts','--reporter=dot'], minimumTests: 20 },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc','--noEmit'], expectOutput: '' },
  { id: 'full-vitest-regression', args: ['node_modules/vitest/vitest.mjs','run','--reporter=dot'], minimumTests: 392 }
];
const execute = (args) => spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 300_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const results = commands.map((command) => {
  const preparations = (command.before ?? []).map(execute);
  const execution = preparations.some((item) => item.status !== 0) ? preparations.find((item) => item.status !== 0) : execute(command.args);
  const output = normalize(`${execution.stdout ?? ''}\n${execution.stderr ?? ''}`);
  const match = output.match(/Tests\s+(\d+) passed/u);
  const tests = match ? Number.parseInt(match[1], 10) : undefined;
  const passed = execution.status === 0 && execution.signal === null && execution.error === undefined
    && (command.minimumTests === undefined || (tests !== undefined && tests >= command.minimumTests))
    && (command.expectOutput === undefined || output.includes(command.expectOutput));
  return { id: command.id, status: passed ? 'PASS' : 'FAIL', exitCode: execution.status, signal: execution.signal,
    ...(tests === undefined ? {} : { tests }), ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    ...(command.expectOutput === undefined ? {} : { expectedOutput: command.expectOutput }), outputSha256: sha256(output),
    outputTail: output.length <= 1600 ? output : output.slice(-1600) };
});
const failed = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-G', requirement: 'PPK-011',
  phase: 'CONTEXTUAL_OWNERSHIP_POLICY_RUNTIME', status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length, passed: results.length - failed.length, failed: failed.length, results,
  validatedBoundaries: ['PURPOSE_BRANCH_TIME_CONTEXT','EXPLICIT_DENY_PRECEDENCE','OWNERSHIP_BASIS_POINTS','SIGNED_OWNERSHIP_THRESHOLD','USE_CASE_REPOSITORY_ROUNDTRIP','MIGRATION_75_TRIGGERS','TYPED_UI_IPC','FULL_VITEST_REGRESSION'],
  bankAccountB402CompletionClaimed: false, cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-G-ppk-011-contextual-ownership-policy-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-G PPK-011 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-G PPK-011 runtime: PASS (${results.length}/${results.length}).`);
