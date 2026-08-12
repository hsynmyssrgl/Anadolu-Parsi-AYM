import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const candidateMode = process.argv.includes('--candidate');
const normalize = (value) => String(value ?? '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const node = process.execPath;
const nodeStep = (args, cwd = process.cwd()) => ({ executable: node, args, cwd });
const typeScriptBuildStep = (project) => nodeStep(['node_modules/typescript/bin/tsc', '-p', project]);
const contractArgs = [
  'scripts/verify-32-t-ppk-024-policy-service-availability-contract.mjs',
  ...(candidateMode ? ['--candidate'] : [])
];
const targetedFiles = [
  'packages/platform-policy/policy-service-availability-policy.test.ts',
  'apps/core-service/tests/ppk024-policy-service-availability-runtime.test.ts',
  'apps/desktop/tests/ppk024-policy-service-availability.test.ts',
  'apps/desktop/tests/ppk024-policy-service-availability-integration.test.ts'
];
const focusedRegressionFiles = [
  ...targetedFiles,
  'apps/desktop/tests/core-service-policy-reevaluation.test.ts',
  'apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts'
];
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
  'apps/desktop/tests/ppk023-application-security-profile-integration.test.ts',
  ...targetedFiles
];
const foundationPolicyFiles = [
  'packages/platform-policy/policy-decision-availability.test.ts',
  'packages/platform-policy/policy-package-version-binding.test.ts',
  'packages/platform-policy/application-identity-device-certificate.test.ts',
  'apps/desktop/tests/core-service-policy-reevaluation.test.ts',
  'apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts'
];
const productionWorkspaceBuildSteps = [
  typeScriptBuildStep('packages/core/tsconfig.json'),
  typeScriptBuildStep('packages/contracts/tsconfig.json'),
  typeScriptBuildStep('packages/config/tsconfig.json'),
  typeScriptBuildStep('packages/platform-policy/tsconfig.json'),
  typeScriptBuildStep('packages/logging/tsconfig.json'),
  typeScriptBuildStep('packages/database/tsconfig.json'),
  typeScriptBuildStep('packages/domain/tsconfig.json'),
  typeScriptBuildStep('packages/events/tsconfig.json'),
  typeScriptBuildStep('packages/repository-contracts/tsconfig.json'),
  typeScriptBuildStep('packages/security/tsconfig.json'),
  typeScriptBuildStep('packages/repositories/tsconfig.json'),
  typeScriptBuildStep('packages/core-service-contracts/tsconfig.json'),
  typeScriptBuildStep('packages/core-service-client/tsconfig.json'),
  typeScriptBuildStep('packages/application/tsconfig.json'),
  typeScriptBuildStep('packages/infrastructure/tsconfig.json'),
  typeScriptBuildStep('packages/test-data/tsconfig.json'),
  typeScriptBuildStep('apps/core-service/tsconfig.json'),
  nodeStep(['apps/desktop/scripts/build-electron.mjs']),
  nodeStep(['node_modules/vite/bin/vite.js', 'build', '--config', 'apps/desktop/vite.config.ts'])
];

const commands = [
  {
    id: 'ppk-024-contract',
    steps: [nodeStep(contractArgs)],
    expectOutput: `PPK-024${candidateMode ? ' candidate' : ''} contract: PASS`
  },
  {
    id: 'ppk-024-production-source-gate',
    steps: [nodeStep(['scripts/verify-policy-service-availability-boundary.mjs'])],
    expectOutput: '"status": "PASS"'
  },
  {
    id: 'combined-platform-policy-gate',
    steps: [nodeStep(['scripts/verify-platform-policy-gate.mjs'])],
    expectOutput: 'policy service availability gate PASS'
  },
  {
    id: 'ppk-024-four-file-targeted',
    steps: [nodeStep(['node_modules/vitest/vitest.mjs', 'run', ...targetedFiles, '--reporter=dot', '--maxWorkers=1'])],
    minimumTests: 71
  },
  {
    id: 'ppk-024-focused-policy-reevaluation-and-universal-gate-regression',
    steps: [nodeStep(['node_modules/vitest/vitest.mjs', 'run', ...focusedRegressionFiles, '--reporter=dot', '--maxWorkers=1'])],
    minimumTests: 90
  },
  {
    id: 'ppk-003-007-008-009-policy-foundation-regression',
    steps: [nodeStep(['node_modules/vitest/vitest.mjs', 'run', ...foundationPolicyFiles, '--reporter=dot', '--maxWorkers=1'])],
    minimumTests: 52
  },
  {
    id: 'ppk-012-through-ppk-024-security-regression',
    steps: [nodeStep(['node_modules/vitest/vitest.mjs', 'run', ...securityRegressionFiles, '--reporter=dot', '--maxWorkers=1'])],
    minimumTests: 351
  },
  {
    id: 'client-data-access-boundary-regression',
    steps: [nodeStep(['scripts/verify-client-data-access-boundary.mjs'])],
    expectOutput: '"status": "PASS"'
  },
  {
    id: 'versioned-core-service-api-boundary-regression',
    steps: [nodeStep(['scripts/verify-versioned-core-service-api-boundary.mjs'])],
    expectOutput: '"status": "PASS"'
  },
  {
    id: 'migration-77-no-ppk024-schema-change',
    steps: [
      nodeStep(['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']),
      nodeStep(['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']),
      nodeStep(['scripts/verify-database-migrations.mjs'])
    ],
    expectOutput: '"version": 77'
  },
  {
    id: 'platform-policy-runtime',
    steps: [nodeStep(['--experimental-strip-types', 'scripts/verify-platform-policy-runtime.mjs'])],
    expectOutput: 'Platform Policy runtime: PASS (8 checks).'
  },
  {
    id: 'platform-policy-enforcement-runtime',
    steps: [nodeStep(['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-m-policy-enforcement-runtime.mjs', '--no-report'])],
    expectOutput: 'PASS (43 controlled checks'
  },
  {
    id: 'core-service-boundary',
    steps: [nodeStep(['scripts/verify-core-service-boundary.mjs'])],
    expectOutput: 'Core Service boundary: PASS (8 checks).'
  },
  {
    id: 'core-service-entrypoint-runtime',
    steps: [nodeStep(['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'])],
    expectOutput: '30-O Core Service Entrypoint Runtime: PASS (24 assertions).'
  },
  {
    id: 'desktop-core-service-startup-runtime',
    steps: [nodeStep(['scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs'])],
    expectOutput: 'Desktop Core Service Startup Runtime: PASS'
  },
  { id: 'platform-policy-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json', '--noEmit'])] },
  { id: 'domain-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json', '--noEmit'])] },
  { id: 'application-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json', '--noEmit'])] },
  { id: 'core-service-contracts-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'packages/core-service-contracts/tsconfig.json', '--noEmit'])] },
  { id: 'core-service-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'apps/core-service/tsconfig.json', '--noEmit'])] },
  { id: 'desktop-electron-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.electron.json', '--noEmit'])] },
  { id: 'desktop-renderer-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'apps/desktop/tsconfig.renderer.json', '--noEmit'])] },
  { id: 'root-typescript', steps: [nodeStep(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'])] },
  {
    id: 'full-vitest',
    steps: [nodeStep(['node_modules/vitest/vitest.mjs', 'run', '--reporter=dot', '--maxWorkers=1'])],
    minimumTests: 759,
    minimumTestFiles: 84
  },
  {
    id: 'production-workspace-builds',
    steps: productionWorkspaceBuildSteps
  },
  {
    id: 'lockfile-dependency-supply-and-workspace-graph',
    steps: [
      nodeStep(['scripts/verify-lockfile-integrity.mjs']),
      nodeStep(['scripts/verify-dependency-supply.mjs']),
      nodeStep(['scripts/verify-workspace-dependencies.mjs'])
    ],
    expectOutput: 'acyclic production graph'
  },
  {
    id: 'decision-ledger',
    steps: [nodeStep(['scripts/verify-user-decision-ledger.mjs'])],
    expectOutput: '61 decisions'
  },
  {
    id: 'bronze-current-audit',
    steps: [nodeStep(['scripts/audit-bronze-current-state.mjs'])],
    expectOutput: 'Bronze current audit: PASS_WITH_OPEN_SCOPE'
  }
];

const execute = (step) => spawnSync(step.executable, step.args, {
  cwd: step.cwd,
  encoding: 'utf8',
  timeout: 900_000,
  maxBuffer: 64 * 1024 * 1024,
  windowsHide: true
});

const results = commands.map((command) => {
  const executions = [];
  for (const step of command.steps) {
    const execution = execute(step);
    executions.push({ step, execution });
    if (execution.status !== 0 || execution.signal !== null || execution.error !== undefined) break;
  }
  const output = normalize(executions.map(({ execution }) => `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`).join('\n'));
  const lastExecution = executions.at(-1)?.execution;
  const testsMatch = output.match(/Tests\s+(\d+) passed/u);
  const filesMatch = output.match(/Test Files\s+(\d+) passed/u);
  const tests = testsMatch ? Number.parseInt(testsMatch[1], 10) : undefined;
  const testFiles = filesMatch ? Number.parseInt(filesMatch[1], 10) : undefined;
  const allowedExitCodes = command.allowedExitCodes ?? [0];
  const allStepsPassed = executions.length === command.steps.length && executions.every(({ execution }) =>
    allowedExitCodes.includes(execution.status) && execution.signal === null && execution.error === undefined);
  const passed = allStepsPassed
    && (command.minimumTests === undefined || (tests !== undefined && tests >= command.minimumTests))
    && (command.minimumTestFiles === undefined || (testFiles !== undefined && testFiles >= command.minimumTestFiles))
    && (command.expectOutput === undefined || output.includes(command.expectOutput));
  return {
    id: command.id,
    status: passed ? 'PASS' : 'FAIL',
    exitCode: lastExecution?.status ?? null,
    signal: lastExecution?.signal ?? null,
    executedSteps: executions.length,
    expectedSteps: command.steps.length,
    commandLines: command.steps.map((step) => [step.executable, ...step.args].join(' ')),
    ...(tests === undefined ? {} : { tests }),
    ...(testFiles === undefined ? {} : { testFiles }),
    ...(command.minimumTests === undefined ? {} : { minimumTests: command.minimumTests }),
    ...(command.minimumTestFiles === undefined ? {} : { minimumTestFiles: command.minimumTestFiles }),
    ...(command.allowedExitCodes === undefined ? {} : { allowedExitCodes: command.allowedExitCodes }),
    ...(command.expectOutput === undefined ? {} : { expectedOutput: command.expectOutput }),
    outputSha256: sha256(output),
    outputTail: output.length <= 2400 ? output : output.slice(-2400)
  };
});

const failed = results.filter((item) => item.status === 'FAIL');
const targeted = results.find((item) => item.id === 'ppk-024-four-file-targeted');
const focused = results.find((item) => item.id === 'ppk-024-focused-policy-reevaluation-and-universal-gate-regression');
const securityRegression = results.find((item) => item.id === 'ppk-012-through-ppk-024-security-regression');
const fullVitest = results.find((item) => item.id === 'full-vitest');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-T',
  requirement: 'PPK-024',
  phase: candidateMode ? 'POLICY_SERVICE_AVAILABILITY_CANDIDATE_RUNTIME' : 'POLICY_SERVICE_AVAILABILITY_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'AUTHENTICATED_LIVE_CORE_HEALTH_PER_EVALUATION',
    'CORE_KERNEL_HMAC_SELF_VERIFICATION_ATTESTATION',
    'STARTUP_POLICY_VERSION_PACKAGE_VERSION_AND_SHA256_PIN',
    'EXACT_30000_MS_FRESH_AND_30001_MS_STALE_BOUNDARY',
    'EXACT_5000_MS_FUTURE_SKEW_AND_5001_MS_DENY_BOUNDARY',
    'UNAVAILABLE_MALFORMED_INVALID_MISMATCH_FUTURE_STALE_NOT_READY_AND_UNSAFE_DENY_READ_AND_WRITE',
    'FRESH_VERIFIED_COHERENT_NON_WRITABLE_READ_ONLY',
    'READ_ONLY_MUTATION_SIGNED_CLUSTER_NOT_WRITABLE_DENIAL',
    'UNIVERSAL_BOOTSTRAP_GATE_AND_DIRECT_PEP_DEFENSE',
    'CORE_PROVIDER_OBSERVER_REQUIRED_NON_CORE_PROVIDER_REGRESSION_PRESERVED',
    'CONTENT_FREE_ZERO_ARGUMENT_NO_CACHE_STATUS_IPC',
    'RESTRICTED_MODE_SHARED_AND_OFFLINE_SENSITIVE_CACHE_LOCK',
    'HISTORICAL_RECEIPT_AND_STARTUP_SNAPSHOT_NOT_CURRENT_AUTHORITY',
    'PPK_003_007_008_009_FOUNDATION_REGRESSION',
    'PPK_012_TO_PPK_024_SECURITY_REGRESSION',
    'MIGRATION_77_UNCHANGED_NO_TRANSFER_OR_CUTOVER',
    'ROOT_AND_CONSTITUENT_TYPESCRIPT',
    'FULL_VITEST_AND_EIGHTEEN_PRODUCTION_WORKSPACE_BUILDS',
    'LOCKFILE_SUPPLY_WORKSPACE_DECISION_AND_BRONZE_GOVERNANCE'
  ],
  targetedTestFiles: targetedFiles.length,
  targetedTests: targeted?.tests ?? null,
  focusedRegressionTestFiles: focusedRegressionFiles.length,
  focusedRegressionTests: focused?.tests ?? null,
  securityRegressionTestFiles: securityRegressionFiles.length,
  securityRegressionTests: securityRegression?.tests ?? null,
  fullVitestFiles: fullVitest?.testFiles ?? null,
  fullVitestTests: fullVitest?.tests ?? null,
  productionWorkspaceCount: 18,
  observationMaximumAgeMs: 30_000,
  maximumFutureSkewMs: 5_000,
  unavailableInvalidAndStaleSensitiveReadsAllowed: false,
  freshVerifiedNonWritableSensitiveReadsAllowed: true,
  freshVerifiedNonWritableMutationsAllowed: false,
  readOnlyMutationSignedReason: 'CLUSTER_NOT_WRITABLE',
  historicalReceiptGrantsCurrentAuthority: false,
  startupSnapshotGrantsCurrentAuthority: false,
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
await writeFile('artifacts/validation/32-T-ppk-024-policy-service-availability-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-T PPK-024${candidateMode ? ' candidate' : ''} runtime: FAIL (${failed.length}/${results.length}).`);
  failed.forEach((item) => console.error(`${item.id}: ${item.outputTail}`));
  process.exit(1);
}
console.log(`32-T PPK-024${candidateMode ? ' candidate' : ''} runtime: PASS (${results.length}/${results.length}).`);
