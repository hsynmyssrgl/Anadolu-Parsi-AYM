import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/gu;
const normalize = (value) => String(value ?? '').replace(ANSI, '').replace(/\r\n/gu, '\n').trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const buildPolicyPackages = [
  ['node_modules/typescript/bin/tsc', '-p', 'packages/platform-policy/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/domain/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/application/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/repository-contracts/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json'],
  ['node_modules/typescript/bin/tsc', '-p', 'packages/repositories/tsconfig.json']
];
const commands = [
  { id: 'ppk-016-contract', args: ['scripts/verify-32-l-ppk-016-derived-data-policy-inheritance-contract.mjs'], expectOutput: 'PPK-016 contract: PASS' },
  { id: 'derived-data-production-source-fail-gate', args: ['scripts/verify-derived-data-policy-boundary.mjs'], expectOutput: '"status": "PASS"' },
  { id: 'ppk-016-targeted-policy-use-case-schema', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 77 },
  { id: 'ppk-016-local-ocr-sealed-owner-integration', before: buildPolicyPackages, args: ['node_modules/vitest/vitest.mjs', 'run', 'packages/application/tests/local-governed-ocr-use-cases.test.ts', 'packages/repositories/local-governed-ocr-repository-policy.test.ts', 'apps/desktop/tests/local-governed-ocr-application-adapter.test.ts', 'apps/desktop/tests/local-governed-ocr-production-policy-runtime.test.ts', 'apps/desktop/tests/local-governed-ocr-runtime-adapter.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 40 },
  { id: 'family-import-content-free-lease-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts', 'apps/desktop/tests/family-data-import-location-read-receipt-runtime.test.ts', 'apps/desktop/tests/family-data-import-governed-rollback-runtime.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 10 },
  { id: 'plaintext-replica-retirement-contract', args: ['scripts/verify-build96-database-export-file-boundary.mjs'], expectOutput: 'RESULT 8/8 PASS' },
  { id: 'protected-backup-export-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/data-store.test.ts', '--reporter=dot', '--maxWorkers=1', '-t', 'korumasız .db dışa aktarımını reddeder'], minimumTests: 1 },
  { id: 'automation-content-free-derived-owner-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/health-cross-projection-privacy-runtime.test.ts', 'apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 5 },
  { id: 'archive-content-free-result-journal-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/archive-operation-idempotency-runtime.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 5 },
  { id: 'protected-operational-artifact-production-composition', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk016-protected-operational-artifact-composition.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 3 },
  { id: 'ppk-015-egress-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk015-network-egress-policy.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 17 },
  { id: 'ppk-014-versioned-api-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/core-service/tests/ppk014-versioned-core-service-api-boundary.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 17 },
  { id: 'ppk-013-direct-data-access-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/ppk013-client-data-access-boundary.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 20 },
  { id: 'ppk-012-sensitive-cache-no-cache-regression', args: ['node_modules/vitest/vitest.mjs', 'run', 'apps/desktop/tests/location-sensitive-ipc-cache-policy-runtime.test.ts', 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts', '--reporter=dot', '--maxWorkers=1'], minimumTests: 15 },
  { id: 'migration-77-policy-plus-94-ocr-metadata-runtime', before: [['node_modules/typescript/bin/tsc', '-p', 'packages/database/tsconfig.json']], args: ['scripts/verify-database-migrations.mjs'], expectOutput: '"version": 94' },
  { id: 'root-typescript', before: buildPolicyPackages, args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'], expectOutput: '' }
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
    outputTail: output.length <= 2200 ? output : output.slice(-2200)
  };
});
const failed = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-L',
  requirement: 'PPK-016',
  phase: 'DERIVED_DATA_POLICY_INHERITANCE_RUNTIME',
  status: failed.length ? 'FAIL' : 'PASS',
  checkCount: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
  validatedBoundaries: [
    'ZERO_DIRECT_DERIVED_DATA_PERSISTENCE_EXCEPTIONS',
    'MAXIMUM_SENSITIVITY_AND_DATA_CLASS_UNION',
    'ACCESS_INTERSECTION_AND_OBLIGATION_UNION',
    'EARLIEST_RETENTION_FAIL_CLOSED',
    'RECEIPT_CONTEXT_REQUEST_PACKAGE_LINEAGE_BINDING',
    'SOURCE_RECEIPT_30000MS_CREATION_FRESHNESS',
    'READ_TIME_PRODUCER_SOURCE_RECEIPT_PROVENANCE',
    'READ_TIME_CREATION_CHRONOLOGY_REVALIDATION',
    'CURRENT_PEP_HISTORICAL_RECEIPT_NOT_GRANT',
    'EXACT_RECURSIVE_UPSTREAM_LINEAGE',
    'MONOTONIC_UPSTREAM_POLICY_ROTATION',
    'MAXIMUM_512_ANCESTOR_AND_STORED_TRAVERSAL',
    'HASH_ONLY_SOURCE_LOOKUP_CURRENT_CONTEXT_BINDING',
    'DUPLICATE_SELF_CYCLE_DEPTH_REJECTION',
    'LOCALE_INDEPENDENT_CANONICAL_HASH',
    'MIGRATION_77_POLICY_LINEAGE_PLUS_MIGRATION_94_SEALED_OCR_METADATA',
    'EXACT_SINGLE_LOCAL_OCR_DERIVED_PAYLOAD_PRODUCER_ADAPTER',
    'CONTENT_FREE_OCR_METADATA_REPOSITORY',
    'MAIN_ONLY_HASH_VERIFIED_OCR_PAYLOAD_READ_CHAIN',
    'FAMILY_IMPORT_CONTENT_FREE_PREVIEW_LEASE',
    'PLAINTEXT_DATABASE_REPLICA_RETIRED',
    'PROTECTED_FULL_BACKUP_ONLY',
    'AUTOMATION_LIFE_ONLY_CONTENT_FREE_DERIVED_OWNER',
    'ARCHIVE_CONTENT_FREE_RESULT_HASH_JOURNAL',
    'PROTECTED_OPERATIONAL_ARTIFACT_PRODUCTION_COMPOSITION',
    'CONTENT_FREE_NO_CACHE_STATUS_IPC',
    'PPK_012_TO_PPK_015_SECURITY_REGRESSION',
    'ROOT_TYPESCRIPT'
  ],
  migrationDecision: 'MIGRATION_77_POLICY_LINEAGE_PLUS_MIGRATION_94_SEALED_OCR_METADATA',
  directDerivedDataPersistenceExceptions: 0,
  authorizedRepositoryAdapters: 1,
  authorizedDerivedProducerAdapters: 1,
  authorizedSealedMetadataReaders: 1,
  authorizedSealedPayloadReadChainComponents: 2,
  sourceReceiptMaximumAgeMsAtCreation: 30_000,
  futureSourceReceiptAllowedAtCreation: false,
  targetedTestMinimumTests: 77,
  readTimeProducerReceiptProvenanceRequired: true,
  readTimeSourceReceiptProvenanceRequired: true,
  creationChronologyRevalidatedAtRead: true,
  currentPepRequiredAtRead: true,
  monotonicUpstreamPolicyRequired: true,
  historicalPolicyVersionPackageExactMatchRequired: false,
  exactRecursiveUpstreamLineageRequired: true,
  ambiguousUpstreamRejected: true,
  maximumAncestorCount: 512,
  maximumStoredLineageTraversalCount: 512,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  realDataBackfillPerformed: false,
  derivedPayloadPersistedByValidation: true,
  currentDerivedPayloadRepositoryOrReadPathExists: true,
  futureCurrentPepReevaluationRequired: true,
  historicalReceiptAloneCountsAsRevocationPropagationEvidence: false,
  policySensitiveIpcNoCacheWeakened: false,
  requirementCompletionClaimed: failed.length === 0,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-L-ppk-016-derived-data-policy-inheritance-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  console.error(`32-L PPK-016 runtime: FAIL (${failed.length}/${results.length}).`);
  for (const item of failed) console.error(`${item.id}: ${item.outputTail}`);
  process.exit(1);
}
console.log(`32-L PPK-016 runtime: PASS (${results.length}/${results.length}).`);
