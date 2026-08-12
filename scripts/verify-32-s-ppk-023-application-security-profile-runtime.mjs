import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const candidateMode = process.argv.includes('--candidate');
const normalize = (value) => String(value ?? '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const contractArgs = ['scripts/verify-32-s-ppk-023-application-security-profile-contract.mjs', ...(candidateMode ? ['--candidate'] : [])];
const securityRegressionFiles = [
  'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts',
  'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts',
  'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts',
  'apps/desktop/tests/ppk015-network-egress-policy.test.ts',
  'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts',
  'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts',
  'apps/desktop/tests/ppk018-immutable-policy-decision-audit.test.ts',
  'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts',
  'packages/platform-policy/policy-conformance-suite.test.ts',
  'apps/desktop/tests/ppk020-policy-conformance-integration.test.ts',
  'packages/platform-policy/platform-policy-ast-gate-policy.test.ts',
  'apps/desktop/tests/ppk021-platform-policy-ast-gate.test.ts',
  'apps/desktop/tests/ppk021-platform-policy-ast-gate-integration.test.ts',
  'packages/platform-policy/platform-capability-manifest-policy.test.ts',
  'apps/desktop/tests/ppk022-capability-manifest-gate.test.ts',
  'apps/desktop/tests/ppk022-capability-manifest-integration.test.ts',
  'packages/platform-policy/application-security-profile-policy.test.ts',
  'apps/desktop/tests/ppk023-application-security-profile-gate.test.ts',
  'apps/desktop/tests/ppk023-application-security-profile-integration.test.ts'
];

const commands = [
  { id: 'ppk-023-contract', args: contractArgs, expectOutput: `PPK-023${candidateMode ? ' candidate' : ''} contract: PASS` },
  { id: 'ppk-023-application-profile-gate', args: ['scripts/verify-application-security-profile-gate.mjs'], expectOutput: 'PPK-023 Application Security Profile Gate: PASS' },
  { id: 'ppk-021-ast-ratchet-regression', args: ['scripts/verify-platform-policy-ast-gate.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-022-capability-ratchet-regression', args: ['scripts/verify-platform-capability-manifest-gate.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'combined-platform-policy-gate', args: ['scripts/verify-platform-policy-gate.mjs'], expectOutput: 'application security profile gate PASS' },
  { id: 'ppk-023-targeted-policy-gate-ipc', args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/application-security-profile-policy.test.ts', 'apps/desktop/tests/ppk023-application-security-profile-gate.test.ts', 'apps/desktop/tests/ppk023-application-security-profile-integration.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 16 },
  { id: 'ppk-012-through-ppk-023-security-regression', args: ['node_modules/vitest/vitest.mjs', 'run', ...securityRegressionFiles, '--reporter=dot', '--maxWorkers=1'], minimumTests: 280 },
  { id: 'client-data-access-boundary-regression', args: ['scripts/verify-client-data-access-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'network-egress-boundary-regression', args: ['scripts/verify-network-egress-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'data-store-smoke', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-data-store-smoke.mjs'], expectOutput: '"checks": 14' },
  { id: 'migration-77-no-ppk023-schema-change', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'], ['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 77' },
  { id: 'foundation-regression', args: ['scripts/verify-foundation.mjs'], expectOutput: '"checks": 14' },
  { id: 'runtime-foundation-regression', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.runtime-foundation.json']], args: ['scripts/verify-runtime-foundation.mjs'], expectOutput: '"checks": 6' },
  { id: 'platform-policy-runtime', args: ['--experimental-strip-types', 'scripts/verify-platform-policy-runtime.mjs'], expectOutput: 'Platform Policy runtime: PASS (8 checks).' },
  { id: 'platform-policy-enforcement-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-m-policy-enforcement-runtime.mjs', '--no-report'], expectOutput: 'PASS (43 controlled checks' },
  { id: 'core-service-boundary', args: ['scripts/verify-core-service-boundary.mjs'], expectOutput: 'Core Service boundary: PASS (8 checks).' },
  { id: 'core-service-entrypoint-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'], expectOutput: '30-O Core Service Entrypoint Runtime: PASS (24 assertions).' },
  { id: 'desktop-core-service-startup-runtime', args: ['scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs'], expectOutput: 'Desktop Core Service Startup Runtime: PASS' },
  { id: 'platform-policy-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json', '--noEmit'] },
  { id: 'domain-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json', '--noEmit'] },
  { id: 'application-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json', '--noEmit'] },
  { id: 'core-service-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/core-service/tsconfig.json', '--noEmit'] },
  { id: 'desktop-electron-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit'] },
  { id: 'desktop-renderer-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit'] },
  { id: 'root-typescript', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'] }
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
  step: '32-S',
  requirement: 'PPK-023',
  phase: candidateMode ? 'APPLICATION_SECURITY_PROFILE_CANDIDATE_RUNTIME' : 'APPLICATION_SECURITY_PROFILE_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'FOURTEEN_CANONICAL_APPLICATIONS_EXACTLY_MAPPED',
    'ASVS_5_0_0_MASVS_2_1_0_AND_FINAL_SSDF_1_1_PINNED',
    'FOURTEEN_HASH_BOUND_APPLICATION_THREAT_MODELS',
    'FOUR_MOBILE_TARGETS_FULL_MASVS_AND_EXACT_NON_MOBILE_NA',
    'NEW_MISSING_DUPLICATE_STALE_UNOWNED_AND_HASH_DRIFT_FAIL_CLOSED',
    'PROFILE_MAPPING_DOES_NOT_CLAIM_CERTIFICATION_OR_RUNTIME_AUTHORITY',
    'PROFILE_ONLY_TARGETS_DO_NOT_CLAIM_NATIVE_VALIDATION',
    'CONTENT_FREE_ZERO_ARGUMENT_NO_CACHE_STATUS_IPC',
    'PPK_021_AND_PPK_022_SUCCESSOR_RATCHETS',
    'PPK_012_TO_PPK_023_SECURITY_REGRESSION',
    'MIGRATION_77_UNCHANGED_NO_TRANSFER_OR_CUTOVER',
    'ROOT_AND_CONSTITUENT_TYPESCRIPT'
  ],
  targetedTestsMinimum: 16,
  securityRegressionTestsMinimum: 280,
  canonicalApplications: 14,
  mappedApplications: 14,
  applicationThreatModels: 14,
  applicationWorkspaces: 2,
  assuranceProfiles: 2,
  asvsVersion: '5.0.0',
  asvsControls: 21,
  masvsVersion: '2.1.0',
  masvsControls: 24,
  ssdfVersion: '1.1',
  ssdfPractices: 19,
  maliciousSelfTests: 17,
  benignSelfTests: 4,
  mappingClaimsCompliance: false,
  profileOnlyNativeRuntimeValidationClaimed: false,
  mappingGrantsRuntimeAuthority: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  historicalBackfillPerformed: false,
  realDataTransferPerformed: false,
  cutoverPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-S-ppk-023-application-security-profile-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-S PPK-023${candidateMode ? ' candidate' : ''} runtime: FAIL (${failed.length}/${results.length}).`);
  failed.forEach((item) => console.error(`${item.id}: ${item.outputTail}`));
  process.exit(1);
}
console.log(`32-S PPK-023${candidateMode ? ' candidate' : ''} runtime: PASS (${results.length}/${results.length}).`);
