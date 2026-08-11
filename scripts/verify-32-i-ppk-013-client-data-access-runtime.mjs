import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const packageBuild = [
  ['node_modules/typescript/bin/tsc','-p','packages/domain/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/application/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/core-service-contracts/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/core-service-client/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/repository-contracts/tsconfig.json'],
  ['node_modules/typescript/bin/tsc','-p','packages/repositories/tsconfig.json']
];
const commands = [
  { id: 'ppk-013-contract', args: ['scripts/verify-32-i-ppk-013-client-data-access-contract.mjs'], expectOutput: 'PPK-013 contract: PASS' },
  { id: 'client-source-fail-gate', args: ['scripts/verify-client-data-access-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-013-targeted-policy-use-case', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/ppk013-client-data-access-boundary.test.ts','--reporter=dot'], minimumTests: 20 },
  { id: 'universal-pep-and-core-policy-regression', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts','apps/desktop/tests/core-service-policy-reevaluation.test.ts','--reporter=dot'], minimumTests: 19 },
  { id: 'ppk-012-sensitive-cache-no-cache-regression', args: ['node_modules/vitest/vitest.mjs','run','apps/desktop/tests/location-sensitive-ipc-cache-policy-runtime.test.ts','apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts','--reporter=dot'], minimumTests: 15 },
  { id: 'migration-76-no-new-schema-runtime', before: [['node_modules/typescript/bin/tsc','-p','packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 76' },
  { id: 'client-boundary-package-build', before: packageBuild, args: ['node_modules/typescript/bin/tsc','-p','apps/desktop/tsconfig.electron.json','--noEmit'], expectOutput: '' },
  { id: 'root-typescript', before: packageBuild, args: ['node_modules/typescript/bin/tsc','--noEmit'], expectOutput: '' },
  { id: 'dependency-lock-integrity', args: ['scripts/verify-lockfile-integrity.mjs'], expectOutput: 'Lockfile integrity verified' },
  { id: 'full-vitest-regression', args: ['node_modules/vitest/vitest.mjs','run','--reporter=dot','--maxWorkers=1'], minimumTests: 425 }
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
  return {
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: execution.status,
    signal: execution.signal,
    ...(tests === undefined ? {} : { tests }),
    ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    ...(command.expectOutput === undefined ? {} : { expectedOutput: command.expectOutput }),
    outputSha256: sha256(output),
    outputTail: output.length <= 1800 ? output : output.slice(-1800)
  };
});
const failed = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-I',
  requirement: 'PPK-013',
  phase: 'CLIENT_DATA_ACCESS_BOUNDARY_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'ZERO_DIRECT_ACCESS_EXCEPTIONS', 'CLIENT_SOURCE_FAIL_GATE', 'TYPED_IPC_APPLICATION_SERVICE_ONLY',
    'IDENTITY_DEVICE_SUBJECT_FAMILY_BINDING', 'POLICY_MANIFEST_CERTIFICATE_CONTEXT_BINDING',
    'PPK_012_CACHE_AND_NO_CACHE_REGRESSION', 'NO_NEW_MIGRATION', 'FULL_VITEST_REGRESSION'
  ],
  migrationDecision: 'NO_NEW_SCHEMA_MIGRATION_REUSE_74_POLICY_RECEIPT_AUTHORITY',
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-I-ppk-013-client-data-access-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-I PPK-013 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-I PPK-013 runtime: PASS (${results.length}/${results.length}).`);
