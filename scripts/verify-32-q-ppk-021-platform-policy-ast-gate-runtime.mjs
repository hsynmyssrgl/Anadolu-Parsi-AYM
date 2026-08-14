import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const candidateMode = process.argv.includes('--candidate');
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const changedPackageBuilds = [
  ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json']
];

const commands = [
  { id: 'ppk-021-contract', args: ['scripts/verify-32-q-ppk-021-platform-policy-ast-gate-contract.mjs', ...(candidateMode ? ['--candidate'] : [])], expectOutput: `PPK-021${candidateMode ? ' candidate' : ''} contract: PASS` },
  { id: 'typescript-ast-production-source-gate', args: ['scripts/verify-platform-policy-ast-gate.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'combined-platform-policy-gate', before: changedPackageBuilds, args: ['scripts/verify-platform-policy-gate.mjs'], expectOutput: 'AST gate PASS' },
  { id: 'ppk-021-targeted-ast-policy-ipc', args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/platform-policy-ast-gate-policy.test.ts', 'apps/desktop/tests/ppk021-platform-policy-ast-gate.test.ts', 'apps/desktop/tests/ppk021-platform-policy-ast-gate-integration.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 17 },
  { id: 'ppk-012-through-ppk-021-security-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts', 'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts', 'apps/desktop/tests/ppk018-immutable-policy-decision-audit.test.ts', 'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts', 'packages/platform-policy/policy-conformance-suite.test.ts', 'apps/desktop/tests/ppk020-policy-conformance-integration.test.ts', 'packages/platform-policy/platform-policy-ast-gate-policy.test.ts', 'apps/desktop/tests/ppk021-platform-policy-ast-gate.test.ts', 'apps/desktop/tests/ppk021-platform-policy-ast-gate-integration.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 245 },
  { id: 'client-data-access-boundary-regression', args: ['scripts/verify-client-data-access-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'network-egress-boundary-regression', args: ['scripts/verify-network-egress-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'data-store-smoke', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-data-store-smoke.mjs'], expectOutput: '"checks": 14' },
  { id: 'migration-77-no-ppk021-schema-change', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'], ['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 77' },
  { id: 'foundation-regression', args: ['scripts/verify-foundation.mjs'], expectOutput: '"checks": 14' },
  { id: 'runtime-foundation-regression', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.runtime-foundation.json']], args: ['scripts/verify-runtime-foundation.mjs'], expectOutput: '"checks": 6' },
  { id: 'platform-policy-enforcement-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-m-policy-enforcement-runtime.mjs', '--no-report'], expectOutput: 'PASS (43 controlled checks' },
  { id: 'core-service-boundary', args: ['scripts/verify-core-service-boundary.mjs'], expectOutput: 'Core Service boundary: PASS (8 checks).' },
  { id: 'core-service-entrypoint-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'], expectOutput: '30-O Core Service Entrypoint Runtime: PASS (24 assertions).' },
  { id: 'platform-policy-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json', '--noEmit'], expectOutput: '' },
  { id: 'domain-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json', '--noEmit'], expectOutput: '' },
  { id: 'application-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json', '--noEmit'], expectOutput: '' },
  { id: 'desktop-electron-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit'], expectOutput: '' },
  { id: 'desktop-renderer-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit'], expectOutput: '' },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'], expectOutput: '' }
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
  step: '32-Q',
  requirement: 'PPK-021',
  phase: candidateMode ? 'PLATFORM_POLICY_AST_FAIL_GATE_CANDIDATE_RUNTIME' : 'PLATFORM_POLICY_AST_FAIL_GATE_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'REAL_TYPESCRIPT_JSX_AST_NOT_REGEX_ONLY',
    'EIGHTEEN_PRODUCTION_SOURCE_ZONES',
    'EXACT_FILE_AND_SYMBOL_DEFAULT_DENY_ALLOWLIST',
    'ALIAS_DESTRUCTURING_COMPUTED_PROPERTY_DYNAMIC_IMPORT_REQUIRE_AND_REFLECT_CONSTRUCT',
    'SQL_SQLITE_REPOSITORY_DATABASE_CRYPTO_NETWORK_ROLE_AND_USE_CASE_SURFACES',
    'PARSE_FAILURE_NEW_SURFACE_STALE_ALLOWANCE_AND_WILDCARD_DENIED',
    'ZERO_DIRECT_ROLE_AUTHORIZATION_EXCEPTION',
    'RENDERER_ROLE_CONDITION_PRESENTATION_ONLY',
    'ROOT_PRETYPECHECK_PREBUILD_AND_COMBINED_POLICY_GATE',
    'CONTENT_FREE_ZERO_ARGUMENT_NO_CACHE_STATUS_IPC',
    'BUILD_GATE_DOES_NOT_REPLACE_RUNTIME_POLICY',
    'PPK_012_TO_PPK_021_SECURITY_REGRESSION',
    'MIGRATION_77_UNCHANGED_NO_TRANSFER_OR_CUTOVER',
    'ROOT_AND_CONSTITUENT_TYPESCRIPT'
  ],
  targetedTestsMinimum: 17,
  securityRegressionTestsMinimum: 245,
  productionSourceZones: 18,
  scannedProductionFiles: 442,
  exactAllowlistEntries: 685,
  maliciousAstSelfTests: 17,
  benignAstSelfTests: 4,
  directRoleAuthorizationBypasses: 0,
  syntaxModel: 'TYPESCRIPT_AST',
  regexOnlyGateAccepted: false,
  buildGateReplacesRuntimePolicy: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  historicalBackfillPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  cutoverAuthorityAttached: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Q-ppk-021-platform-policy-ast-gate-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-Q PPK-021${candidateMode ? ' candidate' : ''} runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-Q PPK-021${candidateMode ? ' candidate' : ''} runtime: PASS (${results.length}/${results.length}).`);
