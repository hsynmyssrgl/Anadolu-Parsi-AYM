import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const changedPackageBuilds = [
  ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/logging/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/repositories/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'apps/core-service/tsconfig.json']
];

const commands = [
  { id: 'ppk-017-contract', args: ['scripts/verify-32-m-ppk-017-sensitive-log-policy-contract.mjs'], expectOutput: 'PPK-017 contract: PASS' },
  { id: 'sensitive-log-production-source-gate', args: ['scripts/verify-sensitive-log-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-017-policy-use-case-repository-ipc-targeted', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 21 },
  { id: 'logging-package-fail-closed-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/logging/tests/logging.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 10 },
  { id: 'diagnostic-report-archive-canary-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/data-store.test.ts', '--reporter=dot', '--maxWorkers=1', '-t', 'PPK-017'], minimumTests: 1 },
  { id: 'data-store-full-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/data-store.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 44 },
  { id: 'foundation-structured-logging-regression', before: changedPackageBuilds, args: ['scripts/verify-foundation.mjs'], expectOutput: '"checks": 14' },
  { id: 'runtime-protected-log-regression', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.runtime-foundation.json']], args: ['scripts/verify-runtime-foundation.mjs'], expectOutput: '"checks": 6' },
  { id: 'fatal-startup-content-free-contract', args: ['scripts/verify-build225-fatal-startup-contract.mjs'], expectOutput: 'Build225 fatal startup contract: PASS (10/10).' },
  { id: 'fatal-startup-content-free-tamper-runtime', args: ['scripts/verify-build225-fatal-startup-runtime.mjs'], expectOutput: 'Build225 fatal startup runtime/tamper: PASS (3/3).' },
  { id: 'core-service-content-free-entrypoint-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'], expectOutput: '30-O Core Service Entrypoint Runtime: PASS (24 assertions).' },
  { id: 'ppk-012-through-ppk-016-security-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 141 },
  { id: 'data-store-smoke', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-data-store-smoke.mjs'], expectOutput: '"checks": 14' },
  { id: 'migration-77-no-ppk017-schema-change', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'], ['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 77' },
  { id: 'root-typescript', before: changedPackageBuilds, args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'], expectOutput: '' }
];

const execute = (args) => spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 300_000,
  maxBuffer: 32 * 1024 * 1024,
  windowsHide: true
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
    outputTail: output.length <= 2200 ? output : output.slice(-2200)
  };
});

const failed = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-M',
  requirement: 'PPK-017',
  phase: 'SENSITIVE_LOG_POLICY_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'CENTRAL_FAIL_CLOSED_SENSITIVE_LOG_POLICY',
    'IDENTIFIER_HASH_RESULT_CORRELATION_METADATA_ONLY',
    'ZERO_PAYLOAD_OCR_TEXT_MESSAGE_STACK_PATH_LOGGING',
    'FLAT_BOUNDED_METADATA_ONLY',
    'PROTECTED_DESKTOP_PRODUCTION_SINK',
    'CONTENT_FREE_CORE_SERVICE_CONSOLE_BOUNDARY',
    'EARLY_STARTUP_ERROR_FINGERPRINT_ONLY',
    'CONTENT_FREE_DIAGNOSTIC_WRITE_AND_READ_BACK',
    'CONTENT_FREE_DIAGNOSTIC_REPORT_AND_ARCHIVE',
    'CONTENT_FREE_NO_CACHE_STATUS_IPC',
    'ZERO_DIRECT_CONSOLE_PLAINTEXT_SINK_DIAGNOSTIC_SQL_BYPASS',
    'PPK_012_TO_PPK_016_SECURITY_REGRESSION',
    'MIGRATION_77_UNCHANGED_NO_BACKFILL',
    'ROOT_TYPESCRIPT'
  ],
  targetedPolicyTestsMinimum: 21,
  loggingRegressionTestsMinimum: 10,
  dataStoreCanaryTestsMinimum: 1,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  payloadLoggingAllowed: false,
  ocrTextLoggingAllowed: false,
  plaintextDesktopProductionSinkAllowed: false,
  directConsolePrimitiveExceptions: 0,
  diagnosticSqlWriteExceptions: 0,
  auditDecisionChainCompletedByThisPackage: false,
  auditDecisionChainRequirement: 'PPK-018',
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  realDataBackfillPerformed: false,
  cutoverAuthorityAttached: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-M-ppk-017-sensitive-log-policy-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-M PPK-017 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-M PPK-017 runtime: PASS (${results.length}/${results.length}).`);
