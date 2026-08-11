import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const changedPackageBuilds = [
  ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json']
];
const electronBuild = [['apps/desktop/scripts/build-electron.mjs']];

const commands = [
  { id: 'ppk-018-contract', args: ['scripts/verify-32-n-ppk-018-immutable-policy-decision-audit-contract.mjs'], expectOutput: 'PPK-018 contract: PASS' },
  { id: 'immutable-policy-decision-audit-production-source-gate', args: ['scripts/verify-immutable-policy-decision-audit-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-018-policy-journal-ipc-targeted', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk018-immutable-policy-decision-audit.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 20 },
  { id: 'protected-receipt-journal-backward-compatibility-runtime', before: [...changedPackageBuilds, ...electronBuild], args: ['scripts/verify-30-o-protected-receipt-journal-runtime.mjs'], expectOutput: '30-O protected receipt journal runtime: PASS (14 checks).' },
  { id: 'strict-obligation-execution-regression', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/platform-policy/policy-obligation-suite.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 1 },
  { id: 'durable-policy-transaction-projection-regression', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 1 },
  { id: 'ppk-012-through-ppk-017-security-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts', 'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 162 },
  { id: 'data-store-smoke', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-data-store-smoke.mjs'], expectOutput: '"checks": 14' },
  { id: 'migration-77-no-ppk018-schema-change', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'], ['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 77' },
  { id: 'foundation-policy-receipt-regression', before: changedPackageBuilds, args: ['scripts/verify-foundation.mjs'], expectOutput: '"checks": 14' },
  { id: 'runtime-protected-artifact-regression', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.runtime-foundation.json']], args: ['scripts/verify-runtime-foundation.mjs'], expectOutput: '"checks": 6' },
  { id: 'platform-policy-enforcement-runtime', before: changedPackageBuilds, args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-m-policy-enforcement-runtime.mjs', '--no-report'], expectOutput: 'PASS (43 controlled checks' },
  { id: 'core-service-boundary', args: ['scripts/verify-core-service-boundary.mjs'], expectOutput: 'Core Service boundary: PASS (8 checks).' },
  { id: 'core-service-entrypoint-runtime', args: ['--experimental-strip-types', '--experimental-loader', './scripts/ts-workspace-loader.mjs', 'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'], expectOutput: '30-O Core Service Entrypoint Runtime: PASS (24 assertions).' },
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
  step: '32-N',
  requirement: 'PPK-018',
  phase: 'IMMUTABLE_POLICY_DECISION_AUDIT_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'ALLOW_AND_DENY_DECISIONS_AUDITED',
    'POLICY_VERSION_PACKAGE_OBLIGATIONS_REASON_EXACT_BINDING',
    'AUDIT_PERSISTENCE_BEFORE_OPERATION_OR_DENIAL_RETURN',
    'AUDIT_PERSISTENCE_FAILURE_BLOCKS_OPERATION',
    'STRICT_OBLIGATION_EXECUTION_ATTESTATION',
    'AES_256_GCM_PROTECTED_AUDIT_ENVELOPE',
    'HMAC_SHA256_APPEND_ONLY_CHAIN',
    'FSYNC_EXACT_READBACK_AND_NONCE_REPLAY_REJECTION',
    'TRUSTED_PROVIDER_RESTART_VERIFICATION',
    'EXTERNAL_MONOTONIC_CHECKPOINT',
    'DURABLE_SQLITE_RECEIPT_PROJECTION_PROOF',
    'LEGACY_RECEIPT_READ_WITHOUT_BACKFILL',
    'CONTENT_FREE_NO_CACHE_STATUS_IPC',
    'ZERO_NOOP_SINK_PLAINTEXT_CLIENT_PAYLOAD_BYPASS',
    'PPK_012_TO_PPK_017_SECURITY_REGRESSION',
    'MIGRATION_77_UNCHANGED_NO_TRANSFER_OR_CUTOVER',
    'ROOT_TYPESCRIPT'
  ],
  targetedPolicyTestsMinimum: 20,
  protectedJournalRuntimeChecks: 14,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  journalEntrySchemaVersion: 2,
  protectedAuditEnvelopeSchemaVersion: 1,
  allowedDecisionsRecorded: true,
  deniedDecisionsRecorded: true,
  decisionReasonRequired: true,
  obligationsRecordedExactly: true,
  clientAuditPayloadExposureAllowed: false,
  historicalBackfillPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  cutoverAuthorityAttached: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-N-ppk-018-immutable-policy-decision-audit-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-N PPK-018 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-N PPK-018 runtime: PASS (${results.length}/${results.length}).`);
