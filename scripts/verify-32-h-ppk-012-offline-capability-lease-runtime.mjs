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
  { id: 'ppk-012-contract', args: ['scripts/verify-32-h-ppk-012-offline-capability-lease-contract.mjs'], expectOutput: 'PASS (32/32)' },
  { id: 'ppk-012-targeted-policy-cache', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts','--reporter=dot'], minimumTests: 12 },
  { id: 'ppk-012-data-store-repository-runtime', before: packageBuild, args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/data-store.test.ts','-t','PPK-012','--reporter=dot'], minimumTests: 1 },
  { id: 'sensitive-cache-regression', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/location-sensitive-ipc-cache-policy-runtime.test.ts','apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts','--reporter=dot'], minimumTests: 15 },
  { id: 'migration-76-runtime', before: [['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 76' },
  { id: 'root-typescript', before: packageBuild, args: ['node_modules/typescript/bin/tsc','--noEmit'], expectOutput: '' },
  { id: 'dependency-lock-integrity', args: ['scripts/verify-lockfile-integrity.mjs'], expectOutput: 'Lockfile integrity verified' },
  { id: 'full-vitest-regression', args: ['node_modules/vitest/vitest.mjs','run','--reporter=dot'], minimumTests: 405 }
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
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-H', requirement: 'PPK-012',
  phase: 'OFFLINE_CAPABILITY_LEASE_RUNTIME', status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length, passed: results.length - failed.length, failed: failed.length, results,
  validatedBoundaries: ['FINITE_OFFLINE_LEASE','LEASE_INTEGRITY_AND_CONTEXT_BINDING','EXACT_EXPIRY_LOCK','REVOCATION_LOCK','SENSITIVE_CACHE_CLEAR','USE_CASE_REPOSITORY_ROUNDTRIP','MIGRATION_76_TRIGGERS','TYPED_UI_IPC','FULL_VITEST_REGRESSION'],
  persistentSensitivePayloadCacheIntroduced: false, policySensitiveIpcNoCacheWeakened: false,
  cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failed.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-H-ppk-012-offline-capability-lease-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-H PPK-012 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-H PPK-012 runtime: PASS (${results.length}/${results.length}).`);
