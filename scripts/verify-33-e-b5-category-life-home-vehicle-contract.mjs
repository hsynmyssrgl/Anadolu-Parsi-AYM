import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement
  && Object.keys(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

const ids = Object.freeze(['B5-04', 'EXT-031', 'EXT-034']);
const evidence = Object.freeze([
  'artifacts/validation/33-E-b5-category-life-home-vehicle-boundary.json',
  'artifacts/validation/33-E-b5-category-life-home-vehicle-contract.json',
  'artifacts/validation/33-E-b5-category-life-home-vehicle-runtime.json'
]);
const [
  registry, ledger, scope, inventory, boundary, migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister,
  applicationTest, repositoryTest, ipcTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-e-b5-category-life-home-vehicle-scope.json'),
  json('config/33-e-b5-category-life-home-vehicle-inventory.json'),
  json(evidence[0]),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-216-b5-category-life-home-vehicle.md'),
  text('docs/security/THREAT_MODEL_33_E_B5_CATEGORY_LIFE_HOME_VEHICLE.md'),
  text('docs/audit/33-E_B5_CATEGORY_LIFE_HOME_VEHICLE_UST_KAPANIS.md'),
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
const migration83 = migrationManifest.migrationVersions?.find((item) => item.version === 83);

check('three requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('three requirements bind the exact 33-E evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('three requirements bind domain database application repository IPC and UI areas', requirements.every((item) =>
  ['packages/domain/src/app-data.ts', 'packages/database/src/family-database-migrations.ts',
    'packages/application/src/life-use-cases.ts', 'packages/repositories/src/life-repository.ts',
    'apps/desktop/src/main/main.ts', 'apps/desktop/src/renderer/ManagedLifePanel.tsx']
    .every((path) => item?.codeAreas?.includes(path))));
check('scope and inventory close the exact DEC-216 package', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-216' && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE' && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 83 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('scope truth remains manual local document-content-free and payment-free', scope.truth?.dataSource === 'manual'
  && scope.truth?.externalRegistryLookup === 'not_performed'
  && scope.truth?.providerContact === 'not_performed'
  && scope.truth?.paymentExecution === 'not_performed'
  && scope.truth?.documentContentExposure === 'not_performed'
  && scope.truth?.networkEgressAdded === false);
check('boundary evidence is exact green and preserves platform ratchets through successors', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 83
  && boundary.managedLedgerTables === 1 && boundary.managedCategories === 7
  && boundary.ipcChannels === 2 && boundary.networkChannels === 0
  && boundary.externalRegistryLookup === 'not_performed'
  && boundary.paymentExecution === 'not_performed'
  && Number.isInteger(boundary.ppk021ExactAllowlistEntries)
  && Number.isInteger(boundary.ppk021UseCaseCompositionSurfaces)
  && Number.isInteger(boundary.ppk022CapabilitySurfaces));
check('DEC-216 is active and decision ledger cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-216' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-216-b5-category-life-home-vehicle.md'));
check('migration 83 remains exact while successor migrations may be current', (migrationVersions.at(-1) ?? 0) >= 83
  && migrations.includes("createMigrationDefinition(83, 'b5_life_home_vehicle_managed_ledger'")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration83?.name === 'b5_life_home_vehicle_managed_ledger'
  && /^[a-f0-9]{64}$/u.test(migration83?.checksum ?? ''));
check('decision binds append-only policy receipt integer and truth boundaries', includesAll(decision, [
  'DEC-216', 'B5-04', 'EXT-031', 'EXT-034', 'Migration 83', 'append-only',
  'minor unit', 'life_record/create', 'life_record/update', 'not_performed'
]));
check('threat model covers confused deputy replay leakage finance and immutable history', includesAll(threatModel, [
  'Cross-family', 'Makbuz replay', 'PAN/path/base64', 'safe integer', 'append-only', 'not_performed'
]));
check('audit binds exact IDs evidence and honest no-external truth', ids.every((id) => auditDocument.includes(id))
  && evidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['DEC-216', 'Migration 83', 'manual', 'not_performed']));
check('master register contains active DEC-216 migration summary', includesAll(masterRegister, [
  '## DEC-216', 'B5-04, EXT-031 ve EXT-034', 'Migration 83',
  'DEC-216-b5-category-life-home-vehicle.md'
]));
check('targeted tests bind application repository policy and exact IPC security', includesAll(applicationTest, [
  '33-E managed LIFE assets', 'RecordManagedLifeItemUseCase', 'PAN', 'reminder'
]) && includesAll(repositoryTest, [
  'life_managed_ledger', 'receipt', 'archive', 'finance', 'UPDATE', 'DELETE'
]) && includesAll(ipcTest, [
  'life:getManagedWorkspace', 'life:recordManagedItem', 'password', 'filePath', 'base64'
]));
check('root lifecycle and explicit scripts bind 33-E', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-b5-category-life-home-vehicle-boundary.mjs'))
  && ['verify:b5-life-assets:boundary', 'verify:b5-life-assets:targeted',
    'verify:b5-life-assets:contract', 'verify:b5-life-assets:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-e-b5-category-life-home-vehicle-scope.json',
  'config/33-e-b5-category-life-home-vehicle-inventory.json',
  'docs/decisions/DEC-216-b5-category-life-home-vehicle.md',
  'docs/security/THREAT_MODEL_33_E_B5_CATEGORY_LIFE_HOME_VEHICLE.md',
  'docs/audit/33-E_B5_CATEGORY_LIFE_HOME_VEHICLE_UST_KAPANIS.md',
  'scripts/verify-b5-category-life-home-vehicle-boundary.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-E',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: migrationVersions.at(-1),
  migration83Checksum: migration83?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`B5 category life home vehicle contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
