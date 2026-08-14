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
  ['node_modules/typescript/bin/tsc', '-p', 'packages/repository-contracts/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/repositories/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json']
];

const commands = [
  { id: 'ppk-019-contract', args: ['scripts/verify-32-o-ppk-019-source-deletion-propagation-contract.mjs', ...(candidateMode ? ['--candidate'] : [])], expectOutput: `PPK-019${candidateMode ? ' candidate' : ''} contract: PASS` },
  { id: 'source-deletion-propagation-production-source-gate', args: ['scripts/verify-source-deletion-propagation-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-019-policy-repository-cache-backup-targeted', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 23 },
  { id: 'ppk-019-local-ocr-file-first-source-deletion', before: changedPackageBuilds, args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/application/tests/local-governed-ocr-use-cases.test.ts', 'packages/repositories/local-governed-ocr-repository-policy.test.ts', 'apps/desktop/tests/local-governed-ocr-runtime-adapter.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 30 },
  { id: 'build136-data-lifecycle-runtime-regression', args: ['scripts/verify-build136-data-lifecycle-runtime.mjs'], expectOutput: 'Build 136 data lifecycle runtime: PASS (31/31)' },
  { id: 'build137-backup-purge-propagation-runtime-regression', args: ['scripts/verify-build137-backup-purge-propagation-runtime.mjs'], expectOutput: 'Build 137 backup purge propagation runtime: PASS (37/37)' },
  { id: 'ppk-012-through-ppk-019-security-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts', 'apps/desktop/tests/ppk017-sensitive-log-policy.test.ts', 'apps/desktop/tests/ppk018-immutable-policy-decision-audit.test.ts', 'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 202 },
  { id: 'data-store-smoke', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-data-store-smoke.mjs'], expectOutput: '"checks": 14' },
  { id: 'migration-94-existing-ocr-owner-no-ppk019-specific-schema', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'], ['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.data-store.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 94' },
  { id: 'foundation-regression', before: changedPackageBuilds, args: ['scripts/verify-foundation.mjs'], expectOutput: '"checks": 14' },
  { id: 'runtime-foundation-regression', before: [['node_modules/typescript/bin/tsc', '-p', 'tests/smoke/tsconfig.runtime-foundation.json']], args: ['scripts/verify-runtime-foundation.mjs'], expectOutput: '"checks": 6' },
  { id: 'platform-policy-gate', before: changedPackageBuilds, args: ['scripts/verify-platform-policy-gate.mjs'], expectOutput: 'Platform Policy runtime: PASS (8 checks).' },
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
  step: '32-O',
  requirement: 'PPK-019',
  phase: candidateMode ? 'SOURCE_DELETION_RETENTION_PROPAGATION_CANDIDATE_RUNTIME' : 'SOURCE_DELETION_RETENTION_PROPAGATION_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'EXACT_SEVEN_PROPAGATION_OWNER_KINDS',
    'THREE_RUNTIME_CACHE_REGISTRIES_INVALIDATED_BEFORE_DELETE',
    'PERSISTENT_OWNER_SCHEMA_SCAN_AND_TOCTOU_RESCAN',
    'UNREGISTERED_OWNER_AND_PLAINTEXT_REPLICA_DEFAULT_DENY',
    'CANONICAL_PLAN_HASH_AND_OWNER_EVIDENCE',
    'LIFECYCLE_LEGAL_HOLD_AND_EXACT_SOURCE_REVALIDATION',
    'ATOMIC_SOURCE_PERMISSION_AND_AI_CONSENT_DELETE',
    'BACKUP_PENDING_TOMBSTONE_RETENTION',
    'MANAGED_PROTECTED_BACKUP_VERIFIED_FRESH_REWRITE',
    'MANAGED_HISTORICAL_ARTIFACT_RECOVERABLE_QUARANTINE',
    'UNMANAGED_AND_EXTERNAL_COPY_ATTENTION_EVIDENCE_BOUNDARY',
    'CONTENT_FREE_NO_CACHE_STATUS_IPC',
    'ZERO_DIRECT_DELETE_DERIVED_WRITER_REPLICA_CACHE_BYPASS',
    'PPK_012_TO_PPK_019_SECURITY_REGRESSION',
    'MIGRATION_94_REGISTERED_OCR_OWNER_NO_PPK019_SPECIFIC_TRANSFER_OR_CUTOVER',
    'LOCAL_OCR_FILE_FIRST_VERIFIED_PURGE_THEN_ATOMIC_TOMBSTONE_LEDGER',
    'DERIVED_OCR_DELETE_PRESERVES_ARCHIVE_SOURCE',
    'ROOT_TYPESCRIPT'
  ],
  targetedTestsMinimum: 23,
  dataLifecycleRuntimeChecks: 31,
  backupPropagationRuntimeChecks: 37,
  ownerKinds: 7,
  requiredRuntimeCacheRegistries: 3,
  activeSemanticPersistentOwners: 2,
  currentMetadataOwners: 1,
  metadataOnlyAppendOnlyLedgers: 3,
  plaintextReplicaProductionOwners: 0,
  directBypassExceptions: 0,
  localPropagationMustPrecedeSourceDelete: true,
  managedBackupVerifiedRewriteRequired: true,
  unmanagedAndExternalBackupAttentionRequired: true,
  historicalBackupQuarantineIsNotPhysicalDestruction: true,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 94,
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
await writeFile('artifacts/validation/32-O-ppk-019-source-deletion-propagation-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-O PPK-019${candidateMode ? ' candidate' : ''} runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-O PPK-019${candidateMode ? ' candidate' : ''} runtime: PASS (${results.length}/${results.length}).`);
