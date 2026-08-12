import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement
  && Object.keys(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);
const ids = Object.freeze(['EXT-030', 'EXT-032']);
const evidence = Object.freeze([
  'artifacts/validation/33-F-home-inventory-utility-belongings-boundary.json',
  'artifacts/validation/33-F-home-inventory-utility-belongings-contract.json',
  'artifacts/validation/33-F-home-inventory-utility-belongings-runtime.json'
]);

const [
  registry, ledger, scope, inventory, boundary, migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister,
  applicationTest, repositoryTest, ipcTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-f-home-inventory-utility-belongings-scope.json'),
  json('config/33-f-home-inventory-utility-belongings-inventory.json'),
  json(evidence[0]),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-217-home-inventory-utility-belongings.md'),
  text('docs/security/THREAT_MODEL_33_F_HOME_INVENTORY_UTILITY_BELONGINGS.md'),
  text('docs/audit/33-F_HOME_INVENTORY_UTILITY_BELONGINGS_UST_KAPANIS.md'),
  text('docs/10_MASTER_DECISION_REGISTER.md'),
  text('packages/application/tests/managed-life-assets.test.ts'),
  text('packages/repositories/managed-life-repository-policy.test.ts'),
  text('apps/desktop/tests/b5-managed-life-ipc-integration.test.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const migration84 = migrationManifest.migrationVersions?.find((item) => item.version === 84);

check('two requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('two requirements bind the exact 33-F evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('two requirements bind domain database application repository IPC and UI', requirements.every((item) =>
  ['packages/domain/src/app-data.ts', 'packages/database/src/family-database-migrations.ts',
    'packages/application/src/life-use-cases.ts', 'packages/repositories/src/life-repository.ts',
    'apps/desktop/src/main/ipc-integration-policy.ts', 'apps/desktop/src/renderer/ManagedLifePanel.tsx']
    .every((path) => item?.codeAreas?.includes(path))));
check('scope and inventory close exact DEC-217 package', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-217' && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE' && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 84 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('scope truth remains manual local no-lookup no-OCR no-payment', scope.truth?.dataSource === 'manual'
  && scope.truth?.smartMeterLookup === 'not_performed'
  && scope.truth?.providerContact === 'not_performed'
  && scope.truth?.warrantyLookup === 'not_performed'
  && scope.truth?.ocr === 'not_performed'
  && scope.truth?.paymentExecution === 'not_performed'
  && scope.truth?.documentContentExposure === 'not_performed'
  && scope.truth?.networkEgressAdded === false);
check('boundary evidence is exact green and preserves platform ratchets', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 84
  && boundary.homeInventoryTables === 1 && boundary.inventoryItemTypes === 7
  && boundary.ipcChannels === 2 && boundary.networkChannels === 0
  && boundary.smartMeterLookup === 'not_performed'
  && boundary.warrantyLookup === 'not_performed' && boundary.ocr === 'not_performed'
  && Number.isInteger(boundary.ppk021ExactAllowlistEntries)
  && Number.isInteger(boundary.ppk021UseCaseCompositionSurfaces)
  && boundary.ppk022CapabilitySurfaces === 242);
check('DEC-217 is active and decision cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-217' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-217-home-inventory-utility-belongings.md'));
check('migration 84 remains exact while authorized successor migrations may be current', (migrationVersions.at(-1) ?? 0) >= 84
  && migrations.includes("createMigrationDefinition(84, 'b5_life_home_inventory_ledger'")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration84?.name === 'b5_life_home_inventory_ledger'
  && /^[a-f0-9]{64}$/u.test(migration84?.checksum ?? ''));
check('decision binds append-only policy integer and truth boundaries', includesAll(decision, [
  'DEC-217', 'EXT-030', 'EXT-032', 'Migration 84', 'append-only',
  'life_record/update', 'not_performed'
]));
check('threat model covers confused deputy replay leakage monotonicity and immutable history', includesAll(threatModel, [
  'Cross-family', 'Makbuz replay', 'PAN/CVV/PIN', 'monoton', 'append-only', 'not_performed'
]));
check('audit binds exact IDs evidence and honest no-external truth', ids.every((id) => auditDocument.includes(id))
  && evidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['DEC-217', 'Migration 84', 'manual', 'not_performed']));
check('master register contains active DEC-217 summary', includesAll(masterRegister, [
  '## DEC-217', 'EXT-030 ve EXT-032', 'DEC-217-home-inventory-utility-belongings.md'
]));
check('targeted tests bind application repository policy and exact IPC security', includesAll(applicationTest, [
  '33-F managed home inventory', 'monotonic', 'masks raw serials', 'PAN'
]) && includesAll(repositoryTest, [
  'life_home_inventory_ledger', 'receipt', 'family', 'privacy', 'archive', 'finance', 'UPDATE', 'DELETE'
]) && includesAll(ipcTest, [
  '33-F EXT-030/EXT-032', 'all seven inventory variants', 'token', 'rawDocumentContent'
]));
check('root lifecycle and explicit scripts bind 33-F', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-home-inventory-utility-belongings-boundary.mjs'))
  && ['verify:b5-home-inventory:boundary', 'verify:b5-home-inventory:targeted',
    'verify:b5-home-inventory:contract', 'verify:b5-home-inventory:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-f-home-inventory-utility-belongings-scope.json',
  'config/33-f-home-inventory-utility-belongings-inventory.json',
  'docs/decisions/DEC-217-home-inventory-utility-belongings.md',
  'docs/security/THREAT_MODEL_33_F_HOME_INVENTORY_UTILITY_BELONGINGS.md',
  'docs/audit/33-F_HOME_INVENTORY_UTILITY_BELONGINGS_UST_KAPANIS.md',
  'scripts/verify-home-inventory-utility-belongings-boundary.mjs',
  'scripts/verify-33-f-home-inventory-utility-belongings-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-F',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: migrationVersions.at(-1),
  migration84Checksum: migration84?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`Home inventory utility belongings contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
