import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement && Object.values(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

const [
  registry, ledger, scope, inventory, boundary, migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister,
  applicationTest, parserTest, ipcTest, dataStoreTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-d-b4-controlled-import-open-banking-scope.json'),
  json('config/33-d-b4-controlled-import-open-banking-inventory.json'),
  json('artifacts/validation/33-D-b4-controlled-import-open-banking-boundary.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-215-b4-controlled-import-open-banking.md'),
  text('docs/security/THREAT_MODEL_33_D_B4_CONTROLLED_IMPORT_OPEN_BANKING.md'),
  text('docs/audit/33-D_B4_CONTROLLED_IMPORT_OPEN_BANKING_UST_KAPANIS.md'),
  text('docs/10_MASTER_DECISION_REGISTER.md'),
  text('packages/application/tests/finance-controlled-import-open-banking.test.ts'),
  text('apps/desktop/tests/finance-import-file-session.test.ts'),
  text('apps/desktop/tests/b4-finance-import-ipc-integration.test.ts'),
  text('apps/desktop/tests/data-store.test.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const ids = ['B4-13','B4-14'];
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const expectedEvidence = [
  'artifacts/validation/33-D-b4-controlled-import-open-banking-boundary.json',
  'artifacts/validation/33-D-b4-controlled-import-open-banking-contract.json',
  'artifacts/validation/33-D-b4-controlled-import-open-banking-runtime.json'
];
const latestMigration = Math.max(...[...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10)));
const migration82 = migrationManifest.migrationVersions?.find((item) => item.version === 82);

check('both requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('both requirements bind the exact 33-D evidence triplet', requirements.every((item) =>
  expectedEvidence.every((path) => item?.evidence?.includes(path))));
check('both requirements bind parser repository lifecycle and dedicated UI areas', requirements.every((item) =>
  item?.codeAreas?.includes('apps/desktop/src/main/finance-import-file-session.ts')
  && item?.codeAreas?.includes('packages/repositories/src/ai-consent-repository.ts')
  && item?.codeAreas?.includes('packages/repositories/src/person-lifecycle-repository.ts')
  && item?.codeAreas?.includes('apps/desktop/src/renderer/FinanceImportPanel.tsx')));
check('scope and inventory bind exact complete DEC-215 migration 82 package', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-215' && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE' && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 82 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('boundary evidence is exact green and truth preserving through successors', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 83
  && boundary.importTables === 2 && boundary.prohibitedPersistedColumns === 0
  && boundary.supportedFileFormats === 5
  && boundary.liveBankConnectionImplemented === false
  && boundary.networkAccessPerformed === false
  && boundary.credentialsCollected === false
  && boundary.externalConsentPerformed === false
  && boundary.ppk021ExactAllowlistEntries === 545
  && boundary.ppk021UseCaseCompositionSurfaces === 277
  && boundary.ppk022CapabilitySurfaces === 242);
check('DEC-215 is active and the decision ledger cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-215' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-215-b4-controlled-import-open-banking.md'));
check('migration 82 source and manifest checksum remain exact through successor migrations', latestMigration >= 83
  && migrations.includes("createMigrationDefinition(82, 'b4_controlled_import_open_banking', financeControlledImportOpenBankingSql)")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration82?.name === 'b4_controlled_import_open_banking'
  && migration82?.checksum === 'be32fbe6a79688ee879fda02a16faa78f6e0d4151e1462b2c9f28a1da44518c8');
check('decision records controlled formats duplicate fence and honest local adapter boundary', includesAll(decision, [
  'CSV, TSV, XLSX, OFX ve QFX', 'UNIQUE(family_id,row_fingerprint)',
  'FinanceOpenBankingAdapterPort', 'LocalOhvpsSandboxAdapter', 'Canlı banka bağlantısı',
  'Migration 82', "542'den 543'e", "274'ten 275'e", "PPK-022 238'den 242'ye"
]));
check('threat model covers all primary parser policy privacy and truth risks', includesAll(threatModel, [
  'Dosya yolu veya ham banka ekstresinin renderer', 'zip-bomb', 'XLSX makro',
  'Bozuk veya yol kaçışlı XLSX', 'Hatalı eşleme', 'Aynı hareketin yeniden içe alınması',
  'Sahip, gizlilik veya kategori sahteciliği', "Receipt'siz", 'Audit/outbox sızıntısı',
  "Sentetik sandbox'ın gerçek banka bağlantısı sanılması", 'Kimlik bilgisi/token'
]));
check('audit binds IDs exact evidence and no-live successor truth', ids.every((id) => auditDocument.includes(id))
  && expectedEvidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['Canlı banka hesabı bağlantısı', 'Sandbox verisi sentetiktir', 'B5']));
check('master register contains active DEC-215 summary', includesAll(masterRegister, [
  '## DEC-215', 'B4-13 ve B4-14', 'Migration 82', 'PPK-021 543',
  'DEC-215-b4-controlled-import-open-banking.md'
]));
check('targeted tests bind exact application parser IPC and durable runtime package', includesAll(applicationTest, [
  '33-D B4-13/B4-14', 'append-only batch', 'persistent duplicate', 'honest network-free adapter contract'
  ]) && includesAll(parserTest, ['33-D controlled finance import file session', 'reads OFX', 'bounded XLSX'])
  && includesAll(ipcTest, ['33-D B4-13/B4-14 finance import IPC boundary', 'exact mapping contract'])
  && includesAll(dataStoreTest, ['B4-13/B4-14', 'finance_import_entries']));
check('root lifecycle and explicit scripts bind 33-D', ['pretypecheck','prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-b4-controlled-import-open-banking-boundary.mjs'))
  && ['verify:b4-import:boundary','verify:b4-import:targeted','verify:b4-import:contract','verify:b4-import:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-d-b4-controlled-import-open-banking-scope.json',
  'config/33-d-b4-controlled-import-open-banking-inventory.json',
  'docs/decisions/DEC-215-b4-controlled-import-open-banking.md',
  'docs/security/THREAT_MODEL_33_D_B4_CONTROLLED_IMPORT_OPEN_BANKING.md',
  'docs/audit/33-D_B4_CONTROLLED_IMPORT_OPEN_BANKING_UST_KAPANIS.md',
  'scripts/verify-b4-controlled-import-open-banking-boundary.mjs',
  'scripts/verify-33-d-b4-controlled-import-open-banking-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-D',
  requirements: Object.freeze(ids),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: latestMigration,
  migration82Checksum: migration82?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/33-D-b4-controlled-import-open-banking-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B4 controlled import open banking contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
