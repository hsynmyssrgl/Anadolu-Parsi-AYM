import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement
  && Object.keys(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);
const ids = Object.freeze(['B5-07', 'EXT-009', 'EXT-010', 'EXT-013']);
const evidence = Object.freeze([
  'artifacts/validation/33-G-family-emergency-planning-boundary.json',
  'artifacts/validation/33-G-family-emergency-planning-contract.json',
  'artifacts/validation/33-G-family-emergency-planning-runtime.json'
]);

const [
  registry, ledger, scope, inventory, boundary, platformGate, capabilityGate,
  migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister,
  applicationTest, repositoryTest, ipcTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-g-family-emergency-planning-scope.json'),
  json('config/33-g-family-emergency-planning-inventory.json'),
  json(evidence[0]),
  json('artifacts/validation/platform-policy-ast-gate.json'),
  json('artifacts/validation/platform-capability-manifest-gate.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-218-family-emergency-planning.md'),
  text('docs/security/THREAT_MODEL_33_G_FAMILY_EMERGENCY_PLANNING.md'),
  text('docs/audit/33-G_FAMILY_EMERGENCY_PLANNING_UST_KAPANIS.md'),
  text('docs/10_MASTER_DECISION_REGISTER.md'),
  text('packages/application/tests/family-emergency-planning.test.ts'),
  text('packages/repositories/family-emergency-repository-policy.test.ts'),
  text('apps/desktop/tests/b5-family-emergency-ipc-integration.test.ts')
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
const migration85 = migrationManifest.migrationVersions?.find((item) => item.version === 85);

check('four requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('four requirements bind the exact 33-G evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('four requirements bind domain database application repository IPC and UI', requirements.every((item) =>
  ['packages/domain/src/app-data.ts', 'packages/database/src/family-database-migrations.ts',
    'packages/application/src/life-use-cases.ts', 'packages/repositories/src/life-repository.ts',
    'apps/desktop/src/main/ipc-integration-policy.ts', 'apps/desktop/src/renderer/ManagedLifePanel.tsx']
    .every((path) => item?.codeAreas?.includes(path))));
check('scope and inventory close exact DEC-218 package', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-218' && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE' && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 85 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('scope truth remains manual local offline and no-contact', scope.truth?.dataSource === 'manual'
  && scope.truth?.offlineAvailability === 'local_only'
  && ['mapLookup', 'liveLocation', 'messageDelivery', 'emergencyServiceContact']
    .every((field) => scope.truth?.[field] === 'not_performed')
  && scope.truth?.emergencyServiceGuarantee === 'not_claimed'
  && scope.truth?.networkEgressAdded === false);
check('boundary evidence is exact green and preserves platform ratchets', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 85
  && boundary.closureDatabaseMigration === 85
  && boundary.familyEmergencyTables === 1 && boundary.emergencyItemTypes === 6
  && boundary.ipcChannels === 2 && boundary.networkChannels === 0
  && boundary.offlineAvailability === 'local_only'
  && boundary.emergencyServiceGuarantee === 'not_claimed'
  && platformGate.status === 'PASS' && capabilityGate.status === 'PASS'
  && boundary.ppk021ExactAllowlistEntries === platformGate.exactAllowlistEntries
  && boundary.ppk021UseCaseCompositionSurfaces === platformGate.surfaceCounts?.USE_CASE_COMPOSITION
  && boundary.ppk022CapabilitySurfaces === capabilityGate.exactManifestSurfaces
  && boundary.ppk021ExactAllowlistEntries >= 545
  && boundary.ppk021UseCaseCompositionSurfaces >= 277
  && boundary.ppk022CapabilitySurfaces >= 242);
check('DEC-218 is active and decision cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-218' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-218-family-emergency-planning.md'));
check('migration 85 remains exact while authorized successor migrations may be current',
  (migrationVersions.at(-1) ?? 0) >= 85 && migrationVersions.includes(85)
  && migrations.includes("createMigrationDefinition(85, 'b5_family_emergency_planning_ledger'")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration85?.name === 'b5_family_emergency_planning_ledger'
  && /^[a-f0-9]{64}$/u.test(migration85?.checksum ?? ''));
check('decision binds append-only self-report and truth boundaries', includesAll(decision, [
  'DEC-218', 'B5-07', 'EXT-009', 'EXT-010', 'EXT-013', 'Migration 85',
  'append-only', 'reportedByPersonId', 'not_performed'
]));
check('threat model covers confused deputy replay leakage and immutable history', includesAll(threatModel, [
  'Cross-family', 'reportedByPersonId', 'PAN/CVV/PIN', 'append-only', 'not_performed'
]));
check('audit binds exact IDs evidence and honest offline truth', ids.every((id) => auditDocument.includes(id))
  && evidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['DEC-218', 'Migration 85', 'manual', 'not_performed']));
check('master register contains active DEC-218 summary', includesAll(masterRegister, [
  '## DEC-218', 'B5-07', 'EXT-009', 'EXT-010', 'EXT-013',
  'DEC-218-family-emergency-planning.md'
]));
check('targeted tests bind application repository policy and exact IPC security', includesAll(applicationTest, [
  '33-G', 'six exact', 'reportedByPersonId', 'needs_help'
]) && includesAll(repositoryTest, [
  'family_emergency_ledger', 'receipt', 'family', 'reported_by_person_id', 'UPDATE', 'DELETE'
]) && includesAll(ipcTest, [
  '33-G', 'all six', 'phoneE164', 'token', 'base64'
]));
check('root lifecycle and explicit scripts bind 33-G', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-family-emergency-planning-boundary.mjs'))
  && ['verify:b5-family-emergency:boundary', 'verify:b5-family-emergency:targeted',
    'verify:b5-family-emergency:contract', 'verify:b5-family-emergency:runtime',
    'finalize:33-g:external-receipt', 'verify:33-g:completion']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-g-family-emergency-planning-scope.json',
  'config/33-g-family-emergency-planning-inventory.json',
  'docs/decisions/DEC-218-family-emergency-planning.md',
  'docs/security/THREAT_MODEL_33_G_FAMILY_EMERGENCY_PLANNING.md',
  'docs/audit/33-G_FAMILY_EMERGENCY_PLANNING_UST_KAPANIS.md',
  'scripts/verify-family-emergency-planning-boundary.mjs',
  'scripts/verify-33-g-family-emergency-planning-runtime.mjs',
  'scripts/verify-33-g-family-emergency-planning-completion.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-G',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: migrationVersions.at(-1),
  closureDatabaseMigration: 85,
  migration85Checksum: migration85?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`Family emergency planning contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
