import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertGovernedSourceRoot } from './lib/governed-source-root.mjs';

const noWrite = process.argv.includes('--no-write');
const root = assertGovernedSourceRoot({ allowReleaseChannel: noWrite });
const output = 'artifacts/validation/33-R-archive-evidence-relations-media-lifecycle-unified-authorized-search-contract.json';
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const readText = async (path) => readFile(resolve(root, path), 'utf8');
const hasAll = (source, markers) => markers.every((marker) => source.includes(marker));
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const [scope, inventory, migrationManifest, migrations, repositoryContract, repository,
  archiveAdapter, searchAdapter, main, preload, globalTypes, decision, threat,
  evidenceApplicationTest, evidenceRepositoryTest, archiveReceiptFenceTest, evidenceDataStoreTest, evidenceIpcUiTest,
  searchApplicationTest, searchAdapterTest, searchIpcUiTest] = await Promise.all([
  readJson('config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-scope.json'),
  readJson('config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-inventory.json'),
  readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  readText('packages/database/src/family-database-migrations.ts'),
  readText('packages/repository-contracts/src/archive-repository.ts'),
  readText('packages/repositories/src/archive-repository.ts'),
  readText('apps/desktop/src/main/archive-application-adapter.ts'),
  readText('apps/desktop/src/main/unified-authorized-search-application-adapter.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('docs/decisions/DEC-229-archive-evidence-relations-media-lifecycle-unified-authorized-search.md'),
  readText('docs/security/THREAT_MODEL_33_R_ARCHIVE_EVIDENCE_RELATIONS_MEDIA_LIFECYCLE_UNIFIED_AUTHORIZED_SEARCH.md'),
  readText('packages/application/tests/archive-evidence-media-use-cases.test.ts'),
  readText('packages/repositories/archive-evidence-media-repository-policy.test.ts'),
  readText('apps/desktop/tests/archive-core-table-receipt-fence.test.ts'),
  readText('apps/desktop/tests/archive-evidence-media-data-store.test.ts'),
  readText('apps/desktop/tests/archive-evidence-media-ipc-ui.test.ts'),
  readText('packages/application/tests/unified-authorized-search-use-cases.test.ts'),
  readText('apps/desktop/tests/unified-authorized-search-application-adapter.test.ts'),
  readText('apps/desktop/tests/unified-authorized-search-ipc-ui.test.ts')
]);

const migrationMatch = migrations.match(/const archiveEvidenceRelationsMediaLifecycleSql = `([\s\S]*?)`;\r?\n\r?\n(?=const [A-Za-z_$][A-Za-z0-9_$]*Sql =|export const FAMILY_DATABASE_MIGRATIONS)/u);
const migrationSha256 = migrationMatch
  ? createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g, '\n').trim()}\n`).digest('hex')
  : '';
const migration96 = migrationManifest.migrationVersions?.find((item) => item.version === 96);
const testFiles = scope.validation?.targetedTestFiles ?? [];

const definitions = [
  ['scope inventory and test matrix are exact', exact(scope.requirements, ['B3-01', 'B3-03', 'B3-05'])
    && exact(inventory.requirements, scope.requirements) && exact(inventory.implementedTargetedTests, testFiles)
    && testFiles.length === 8 && scope.validation?.targetedTestFileRatchet === 8 && scope.validation?.targetedTestRatchet === 30],
  ['migration 96 source and manifest checksums are canonical', migration96?.name === 'archive_evidence_relations_media_search'
    && migration96?.checksum === migrationSha256 && migrationSha256 === scope.validation?.migrationSha256
    && migrationSha256 === 'c00b2a72bf49d2200c85b2045a8ab7a01ef7a41882b2b14eb5a1f4715bde1eb2'],
  ['migration owns immutable evidence ledgers and version update receipt', hasAll(migrations,
    ['archive_relation_evidence_mutations', 'archive_relation_evidence', 'trg_33r_relation_evidence_mutation_delete',
      'trg_33r_relation_evidence_delete', "version.version_no=1 AND NEW.action='create'",
      "version.version_no>1 AND NEW.action='update'"])],
  ['repository contract exposes evidence version and search-safe archive operations', hasAll(repositoryContract,
    ['listRelationEvidence', 'listRelationEvidenceHistory', 'insertRelationEvidence', 'removeRelationEvidence', 'replaceItemFile'])],
  ['repository enforces exact write binding and optimistic removal', hasAll(repository,
    ["archivePolicyBinding(context,input.archiveItemId,'update')", "status='active'", "status='removed'", 'optimistic update failed'])],
  ['desktop adapters preserve central archive policy and authorized search sources', hasAll(archiveAdapter,
    ['RepositoryBackedArchiveUnitOfWork', 'listRelationEvidenceHistory'])
      && hasAll(searchAdapter, ['RepositoryBackedUnifiedAuthorizedSearchSourcePort', 'loadFamilyAndEvents', 'listArchive', 'listFinance', 'listHealth', 'listLife'])],
  ['main and preload expose exact safe channels without renderer path authority', hasAll(main,
    ["registerIpcHandler('unifiedSearch:search'", "registerIpcHandler('archive:addVersion'", 'showOpenDialog'])
      && hasAll(preload, ['searchUnifiedAuthorizedRecords', 'addArchiveRelationEvidence', 'removeArchiveRelationEvidence', 'addArchiveItemVersion'])
      && hasAll(globalTypes, ['searchUnifiedAuthorizedRecords', 'listArchiveRelationEvidenceHistory'])],
  ['evidence application tests cover replay mismatch and future date denial', hasAll(evidenceApplicationTest,
    ['future evidence', 'stable operation identity', 'optimistic revision', 'duplicate content'])],
  ['repository tests prove owner isolation forged receipt rollback and immutable history', hasAll(evidenceRepositoryTest,
    ['owner-bound evidence', 'foreign-family relation', 'receipt for another archive resource', 'version two'])],
  ['archive receipt-fence regression accepts v1 create and rejects v2 create replay', hasAll(archiveReceiptFenceTest,
    ['versionNo: 1', 'fresh exact parent create or update policy receipt', 'replayed and cross-resource SQL'])],
  ['DataStore test proves encrypted files restart replay rollback and no raw metadata leak', hasAll(evidenceDataStoreTest,
    ['persists/replays relation evidence', 'without leaking plaintext or paths', 'restartte-degisen-renderer-kimligi', 'audit_log', 'event_outbox'])],
  ['IPC and UI tests pin safe keys channels and immutable history disclosure', hasAll(evidenceIpcUiTest,
    ['ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS', 'rejecting renderer authority fields', 'immutable-history truth'])],
  ['unified search tests cover six modules bounds and fail closed source errors', hasAll(searchApplicationTest,
    ['selected already-authorized sources', 'fails closed without partial output', 'duplicate modules', 'module/resource mismatches'])
      && hasAll(searchAdapterTest, ['selected governed sources', 'fails the whole source load'])
      && hasAll(searchIpcUiTest, ['unifiedSearch:search', 'query echo', 'module/resource mismatch'])],
  ['decision and threat model record bounded restart recovery without false atomicity or acceptance claim', hasAll(decision,
    ['countsAsRequirementPass=false', 'Process restart sonrası renderer kimliği değişse bile', 'genel filesystem/SQLite crash atomikliği', 'NOT_RUN'])
      && hasAll(threat, ['filesystem ile SQLite arasında sahte atomiklik', 'kısmi sonuç dönmez', 'certification'])],
  ['PPK ratchets are pinned exactly while requirement remains open', scope.validation?.ppk021?.scannedProductionFiles === 590
    && scope.validation?.ppk021?.exactPrivilegedSurfaceCount === 897
    && scope.validation?.ppk021?.exactAllowlistSha256 === '9ea5b846e552e760fbd8dd5f8bee7fb83988ef19bb93e3bbd4ac0465c4b71205'
    && scope.validation?.ppk022?.scannedProductionFiles === 590
    && scope.validation?.ppk022?.exactCapabilitySurfaceCount === 447
    && scope.validation?.ppk022?.exactCapabilityManifestSha256 === '54061e189e7771868552efa869c69a75426f24e4edd846af1c62496c82f0e1d6'
    && scope.validation?.countsAsRequirementPass === false && inventory.validation?.countsAsRequirementPass === false]
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  step: '33-R',
  decision: 'DEC-229',
  status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED',
  countsAsRequirementPass: false,
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  migration96Sha256: migrationSha256,
  checks,
  generatedAt: new Date().toISOString()
};

if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' });
}
if (failures.length) {
  console.error(`33-R contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure.name);
  process.exit(1);
}
console.log(`33-R contract: PASS (${checks.length}/${checks.length}).`);
