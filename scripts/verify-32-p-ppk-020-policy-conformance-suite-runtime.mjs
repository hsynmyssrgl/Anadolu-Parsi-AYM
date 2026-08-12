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
  { id: 'ppk-020-contract', args: ['scripts/verify-32-p-ppk-020-policy-conformance-suite-contract.mjs', ...(candidateMode ? ['--candidate'] : [])], expectOutput: `PPK-020${candidateMode ? ' candidate' : ''} contract: PASS` },
  { id: 'policy-conformance-production-source-gate', args: ['scripts/verify-policy-conformance-suite-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-020-real-kernel-matrix-and-ipc-integration', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/policy-conformance-suite.test.ts', 'apps/desktop/tests/ppk020-policy-conformance-integration.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 26 },
  { id: 'ppk-012-through-ppk-020-security-regression', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts', 'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts', 'apps/desktop/tests/ppk018-immutable-policy-decision-audit.test.ts', 'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts', 'packages/platform-policy/policy-conformance-suite.test.ts', 'apps/desktop/tests/ppk020-policy-conformance-integration.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 228 },
  { id: 'data-store-smoke', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-data-store-smoke.mjs'], expectOutput: '"checks": 14' },
  { id: 'migration-77-no-ppk020-schema-change', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'], ['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 77' },
  { id: 'foundation-regression', before: changedPackageBuilds, args: ['scripts/verify-foundation.mjs'], expectOutput: '"checks": 14' },
  { id: 'runtime-foundation-regression', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.runtime-foundation.json']], args: ['scripts/verify-runtime-foundation.mjs'], expectOutput: '"checks": 6' },
  { id: 'platform-policy-gate', before: changedPackageBuilds, args: ['scripts/verify-platform-policy-gate.mjs'], expectOutput: 'Platform Policy runtime: PASS (8 checks).' },
  { id: 'platform-policy-enforcement-runtime', before: changedPackageBuilds, args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-m-policy-enforcement-runtime.mjs', '--no-report'], expectOutput: 'PASS (43 controlled checks' },
  { id: 'core-service-boundary', args: ['scripts/verify-core-service-boundary.mjs'], expectOutput: 'Core Service boundary: PASS (8 checks).' },
  { id: 'core-service-entrypoint-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'], expectOutput: '30-O Core Service Entrypoint Runtime: PASS (24 assertions).' },
  { id: 'platform-policy-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json', '--noEmit'], expectOutput: '' },
  { id: 'application-typescript', before: changedPackageBuilds, args: ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json', '--noEmit'], expectOutput: '' },
  { id: 'desktop-electron-typescript', before: changedPackageBuilds, args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit'], expectOutput: '' },
  { id: 'desktop-renderer-typescript', before: changedPackageBuilds, args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit'], expectOutput: '' },
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
  step: '32-P',
  requirement: 'PPK-020',
  phase: candidateMode ? 'CROSS_PLATFORM_POLICY_CONFORMANCE_CANDIDATE_RUNTIME' : 'CROSS_PLATFORM_POLICY_CONFORMANCE_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'FOURTEEN_CANONICAL_APPLICATION_AND_SERVICE_TARGETS',
    'IDENTICAL_TWENTY_TWO_CASE_SET_PER_TARGET',
    'THREE_HUNDRED_EIGHT_REAL_POLICY_KERNEL_EVALUATIONS',
    'SIGNED_POLICY_PACKAGE_SELF_VERIFICATION',
    'STRICT_CONTEXT_APPLICATION_MANIFEST_AND_DEVICE_CERTIFICATE_BINDING',
    'POLICY_PACKAGE_AUTHORITY_APPLICATION_AND_CONTEXT_MISMATCH_DEFAULT_DENY',
    'CAPABILITY_ACTION_DATA_CLASS_DEVICE_MEMBERSHIP_SCOPE_DEFAULT_DENY',
    'PURPOSE_OFFLINE_CLUSTER_EXPLICIT_DENY_AND_OWNER_GRANT_DEFAULT_DENY',
    'EXACT_REPORT_HASH_AND_TAMPER_REJECTION',
    'DEPLOYED_VS_PROFILE_ONLY_TRUTH',
    'NO_NATIVE_APPLE_RUNTIME_FALSE_CLAIM',
    'REFERENCE_HARNESS_HAS_NO_RUNTIME_AUTHORITY',
    'CONTENT_FREE_ZERO_ARGUMENT_NO_CACHE_STATUS_IPC',
    'ZERO_SKIP_ONLY_TARGET_CASE_SUBSET_OR_UNAUTHORIZED_COMPOSITION',
    'PPK_012_TO_PPK_020_SECURITY_REGRESSION',
    'MIGRATION_77_UNCHANGED_NO_TRANSFER_OR_CUTOVER',
    'ROOT_AND_CONSTITUENT_TYPESCRIPT'
  ],
  targetedTestsMinimum: 26,
  matrixKernelEvaluations: 308,
  canonicalTargets: 14,
  identicalCasesPerTarget: 22,
  deployedRuntimeTargets: 2,
  profileOnlyTargets: 12,
  perTargetExclusions: 0,
  nativeRuntimeFalseClaims: 0,
  nativeAppleRuntimeExecutionClaimed: false,
  referenceHarnessGrantsRuntimeAuthority: false,
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
await writeFile('artifacts/validation/32-P-ppk-020-policy-conformance-suite-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-P PPK-020${candidateMode ? ' candidate' : ''} runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-P PPK-020${candidateMode ? ' candidate' : ''} runtime: PASS (${results.length}/${results.length}).`);
