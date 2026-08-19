import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement
  && Object.keys(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);
const ids = Object.freeze(['EXT-012', 'EXT-014']);
const evidence = Object.freeze([
  'artifacts/validation/33-I-family-emergency-assistance-card-boundary.json',
  'artifacts/validation/33-I-family-emergency-assistance-card-contract.json',
  'artifacts/validation/33-I-family-emergency-assistance-card-runtime.json'
]);

const [
  registry, ledger, scope, inventory, boundary, migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister,
  applicationTest, repositoryTest, ipcTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-i-family-emergency-assistance-card-scope.json'),
  json('config/33-i-family-emergency-assistance-card-inventory.json'),
  json(evidence[0]),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-220-family-emergency-assistance-card.md'),
  text('docs/security/THREAT_MODEL_33_I_FAMILY_EMERGENCY_ASSISTANCE_CARD.md'),
  text('docs/audit/33-I_FAMILY_EMERGENCY_ASSISTANCE_CARD_UST_KAPANIS.md'),
  text('docs/10_MASTER_DECISION_REGISTER.md'),
  text('packages/application/tests/family-emergency-assistance.test.ts'),
  text('packages/repositories/family-emergency-assistance-card-repository-policy.test.ts'),
  text('apps/desktop/tests/b5-family-emergency-assistance-ipc-integration.test.ts')
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
const migration87 = migrationManifest.migrationVersions?.find((item) => item.version === 87);

check('two requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('two requirements bind the exact 33-I evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('two requirements bind domain database application repository IPC and UI', requirements.every((item) =>
  ['packages/domain/src/app-data.ts', 'packages/database/src/family-database-migrations.ts',
    'packages/application/src/life-use-cases.ts', 'packages/repositories/src/life-repository.ts',
    'apps/desktop/src/main/ipc-integration-policy.ts', 'apps/desktop/src/renderer/ManagedLifePanel.tsx']
    .every((path) => item?.codeAreas?.includes(path))));
check('scope and inventory close exact DEC-220 package', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-220' && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE' && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 87 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('scope truth remains manual private local offline and no-service',
  scope.security?.fixedPrivacy === 'private' && scope.truth?.dataSource === 'manual'
  && scope.truth?.offlineAvailability === 'local_only'
  && ['medicalVerification', 'healthRegistryLookup', 'messageDelivery',
    'emergencyServiceContact', 'exportSharing']
    .every((field) => scope.truth?.[field] === 'not_performed')
  && scope.truth?.emergencyServiceGuarantee === 'not_claimed'
  && scope.truth?.networkEgressAdded === false);
check('boundary evidence is exact green under current successor ratchets', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.closureDatabaseMigration === 87
  && boundary.latestDatabaseMigration >= 87
  && boundary.familyEmergencyAssistanceTables === 1 && boundary.assistanceItemTypes === 4
  && boundary.ipcChannels === 2 && boundary.networkChannels === 0
  && boundary.offlineAvailability === 'local_only'
  && boundary.medicalVerification === 'not_performed'
  && boundary.healthRegistryLookup === 'not_performed'
  && boundary.exportSharing === 'not_performed'
  && boundary.emergencyServiceGuarantee === 'not_claimed'
  && Number.isInteger(boundary.ppk021ExactAllowlistEntries)
  && Number.isInteger(boundary.ppk021UseCaseCompositionSurfaces)
  && boundary.ppk021ExactAllowlistEntries >= 779
  && boundary.ppk021UseCaseCompositionSurfaces >= 379
  && boundary.ppk022CapabilitySurfaces >= 345);
check('DEC-220 is active and decision cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-220' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-220-family-emergency-assistance-card.md'));
check('migration 87 closure identity remains exact under additive successors', migrationVersions.includes(87)
  && (migrationVersions.at(-1) ?? 0) >= 87
  && migrations.includes("createMigrationDefinition(87, 'b5_family_emergency_assistance_card_ledger'")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration87?.name === 'b5_family_emergency_assistance_card_ledger'
  && /^[a-f0-9]{64}$/u.test(migration87?.checksum ?? ''));
check('decision binds private append-only person pet and no-service boundaries', includesAll(decision, [
  'DEC-220', 'EXT-012', 'EXT-014', 'Migration 87', 'append-only', 'private', 'not_performed'
]));
check('threat model covers confused deputy replay leakage immutable history and clinical truth', includesAll(threatModel, [
  'confused deputy', 'PAN/CVV/PIN', 'append-only', 'highly_sensitive', 'not_performed'
]));
check('audit binds exact IDs evidence and honest offline truth', ids.every((id) => auditDocument.includes(id))
  && evidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['DEC-220', 'Migration 87', 'COMPLETE / PASS', 'not_performed']));
check('master register contains active DEC-220 summary', includesAll(masterRegister, [
  '## DEC-220', 'EXT-012', 'EXT-014', 'DEC-220-family-emergency-assistance-card.md'
]));
check('targeted tests bind application repository policy and exact IPC security', includesAll(applicationTest, [
  'emergency_profile', 'health_fact', 'emergency_contact', 'assistance_instruction',
  'emergencyAssistanceProfiles'
]) && includesAll(repositoryTest, [
  'family_emergency_assistance_ledger', 'receipt', 'private', 'UPDATE', 'DELETE'
]) && includesAll(ipcTest, [
  'emergency_profile', 'health_fact', 'assistance_instruction', 'token', 'base64'
]));
check('root lifecycle and explicit scripts bind 33-I', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-family-emergency-assistance-card-boundary.mjs'))
  && ['verify:b5-family-emergency-assistance:boundary',
    'verify:b5-family-emergency-assistance:targeted',
    'verify:b5-family-emergency-assistance:contract',
    'verify:b5-family-emergency-assistance:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-i-family-emergency-assistance-card-scope.json',
  'config/33-i-family-emergency-assistance-card-inventory.json',
  'docs/decisions/DEC-220-family-emergency-assistance-card.md',
  'docs/security/THREAT_MODEL_33_I_FAMILY_EMERGENCY_ASSISTANCE_CARD.md',
  'docs/audit/33-I_FAMILY_EMERGENCY_ASSISTANCE_CARD_UST_KAPANIS.md',
  'scripts/verify-family-emergency-assistance-card-boundary.mjs',
  'scripts/verify-33-i-family-emergency-assistance-card-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-I',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  closureDatabaseMigration: 87,
  latestDatabaseMigration: migrationVersions.at(-1),
  migration87Checksum: migration87?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`Family emergency assistance card contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
