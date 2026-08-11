import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const buildVersionedApiPackages = [
  ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/core-service-contracts/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/core-service-client/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'apps/core-service/tsconfig.json']
];
const commands = [
  { id: 'ppk-014-contract', args: ['scripts/verify-32-j-ppk-014-versioned-core-service-api-contract.mjs'], expectOutput: 'PPK-014 contract: PASS' },
  { id: 'non-core-application-source-fail-gate', args: ['scripts/verify-versioned-core-service-api-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-014-targeted-policy-and-runtime', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', '--reporter=dot'], minimumTests: 17 },
  { id: 'core-service-local-admin-runtime', before: buildVersionedApiPackages, args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-core-service-local-admin-runtime.mjs'], expectOutput: 'Core Service Local Admin Runtime: PASS' },
  { id: 'desktop-core-service-startup-runtime', args: ['scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs'], expectOutput: 'Desktop Core Service Startup Runtime: PASS' },
  { id: 'ppk-013-direct-data-access-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', '--reporter=dot'], minimumTests: 20 },
  { id: 'ppk-012-sensitive-cache-no-cache-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/location-sensitive-ipc-cache-policy-runtime.test.ts', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', '--reporter=dot'], minimumTests: 15 },
  { id: 'migration-76-no-new-schema-runtime', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 76' },
  { id: 'desktop-production-bundle', before: [...buildVersionedApiPackages, ['apps/desktop/scripts/build-electron.mjs']], args: ['node_modules/vite/bin/vite.js', 'build', 'apps/desktop', '--config', 'apps/desktop/vite.config.ts'], expectOutput: 'built in' },
  { id: 'root-typescript', before: buildVersionedApiPackages, args: ['node_modules/typescript/bin/tsc', '--noEmit'], expectOutput: '' },
  { id: 'dependency-lock-integrity', args: ['scripts/verify-lockfile-integrity.mjs'], expectOutput: 'Lockfile integrity verified' },
  { id: 'full-vitest-regression', args: ['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot', '--maxWorkers=1'], minimumTests: 442 }
];
const execute = (args) => spawnSync(process.execPath, args, {
  cwd: process.cwd(), encoding: 'utf8', timeout: 300_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true
});
const results = commands.map((command) => {
  const preparations = (command.before ?? []).map(execute);
  const preparationFailure = preparations.find((item) => item.status !== 0 || item.signal !== null || item.error !== undefined);
  const execution = preparationFailure ?? execute(command.args);
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
  step: '32-J',
  requirement: 'PPK-014',
  phase: 'VERSIONED_CORE_SERVICE_API_BOUNDARY_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'ZERO_DIRECT_CORE_SERVICE_IMPORT_EXCEPTIONS', 'EXACT_VERSIONED_REQUEST_AND_RESPONSE',
    'SIGNED_CLIENT_APPLICATION_VERSION_BINDING', 'FRESHNESS_AND_REPLAY_FAIL_CLOSED',
    'AUTHENTICATED_LOCAL_TRANSPORT', 'DESKTOP_STARTUP_BOUNDARY_VERIFICATION',
    'PPK_013_DIRECT_DATA_ACCESS_REGRESSION', 'PPK_012_CACHE_AND_NO_CACHE_REGRESSION',
    'NO_NEW_MIGRATION', 'FULL_VITEST_REGRESSION'
  ],
  migrationDecision: 'NO_NEW_SCHEMA_MIGRATION_REUSE_EXISTING_VERSIONED_CONTRACTS',
  directCoreServiceImportExceptions: 0,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-J-ppk-014-versioned-core-service-api-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-J PPK-014 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-J PPK-014 runtime: PASS (${results.length}/${results.length}).`);
