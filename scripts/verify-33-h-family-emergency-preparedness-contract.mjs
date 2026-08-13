import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement
  && Object.keys(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);
const ids = Object.freeze(['EXT-011', 'EXT-015']);
const evidence = Object.freeze([
  'artifacts/validation/33-H-family-emergency-preparedness-boundary.json',
  'artifacts/validation/33-H-family-emergency-preparedness-contract.json',
  'artifacts/validation/33-H-family-emergency-preparedness-runtime.json'
]);

const [
  registry, ledger, scope, inventory, boundary, platformGate, capabilityGate,
  migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister,
  applicationTest, repositoryTest, ipcTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-h-family-emergency-preparedness-scope.json'),
  json('config/33-h-family-emergency-preparedness-inventory.json'),
  json(evidence[0]),
  json('artifacts/validation/platform-policy-ast-gate.json'),
  json('artifacts/validation/platform-capability-manifest-gate.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md'),
  text('docs/security/THREAT_MODEL_33_H_FAMILY_EMERGENCY_PREPAREDNESS.md'),
  text('docs/audit/33-H_FAMILY_EMERGENCY_PREPAREDNESS_UST_KAPANIS.md'),
  text('docs/10_MASTER_DECISION_REGISTER.md'),
  text('packages/application/tests/family-emergency-preparedness.test.ts'),
  text('packages/repositories/family-emergency-preparedness-repository-policy.test.ts'),
  text('apps/desktop/tests/b5-family-emergency-preparedness-ipc-integration.test.ts')
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
const migration86 = migrationManifest.migrationVersions?.find((item) => item.version === 86);

check('two requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('two requirements bind the exact 33-H evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('two requirements bind domain database application repository IPC and UI', requirements.every((item) =>
  ['packages/domain/src/app-data.ts', 'packages/database/src/family-database-migrations.ts',
    'packages/application/src/life-use-cases.ts', 'packages/repositories/src/life-repository.ts',
    'apps/desktop/src/main/ipc-integration-policy.ts', 'apps/desktop/src/renderer/ManagedLifePanel.tsx']
    .every((path) => item?.codeAreas?.includes(path))));
check('scope and inventory close exact DEC-219 package', scope.status === 'COMPLETE'
  && scope.decision === 'DEC-219' && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE' && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 86 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('scope truth remains manual local offline and no-service', scope.truth?.dataSource === 'manual'
  && scope.truth?.offlineAvailability === 'local_only'
  && ['barcodeLookup', 'expiryVerification', 'notificationDelivery', 'sensorIntegration']
    .every((field) => scope.truth?.[field] === 'not_performed')
  && scope.truth?.readinessGuarantee === 'not_claimed'
  && scope.truth?.networkEgressAdded === false);
check('boundary evidence is exact green and preserves platform ratchets', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 86
  && boundary.closureDatabaseMigration === 86
  && boundary.familyEmergencyPreparednessTables === 1 && boundary.preparednessItemTypes === 4
  && boundary.ipcChannels === 2 && boundary.networkChannels === 0
  && boundary.offlineAvailability === 'local_only'
  && boundary.readinessGuarantee === 'not_claimed'
  && platformGate.status === 'PASS' && capabilityGate.status === 'PASS'
  && boundary.ppk021ExactAllowlistEntries === platformGate.exactAllowlistEntries
  && boundary.ppk021UseCaseCompositionSurfaces === platformGate.surfaceCounts?.USE_CASE_COMPOSITION
  && boundary.ppk022CapabilitySurfaces === capabilityGate.exactManifestSurfaces
  && boundary.ppk021ExactAllowlistEntries >= 545
  && boundary.ppk021UseCaseCompositionSurfaces >= 277
  && boundary.ppk022CapabilitySurfaces >= 242);
check('DEC-219 is active and decision cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-219' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md'));
check('migration 86 remains exact while authorized successor migrations may be current',
  (migrationVersions.at(-1) ?? 0) >= 86 && migrationVersions.includes(86)
  && migrations.includes("createMigrationDefinition(86, 'b5_family_emergency_preparedness_ledger'")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration86?.name === 'b5_family_emergency_preparedness_ledger'
  && /^[a-f0-9]{64}$/u.test(migration86?.checksum ?? ''));
check('decision binds append-only inventory checks drills and truth boundaries', includesAll(decision, [
  'DEC-219', 'EXT-011', 'EXT-015', 'Migration 86', 'append-only', 'not_performed'
]));
check('threat model covers confused deputy replay leakage and immutable history', includesAll(threatModel, [
  'Cross-family', 'PAN/CVV/PIN', 'append-only', 'not_performed'
]));
check('audit binds exact IDs evidence and honest offline truth', ids.every((id) => auditDocument.includes(id))
  && evidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['DEC-219', 'Migration 86', 'manual', 'not_performed']));
check('master register contains active DEC-219 summary', includesAll(masterRegister, [
  '## DEC-219', 'EXT-011', 'EXT-015',
  'DEC-219-family-emergency-preparedness-kits-and-drills.md'
]));
check('targeted tests bind application repository policy and exact IPC security', includesAll(applicationTest, [
  '33-H', 'preparedness_kit_check', 'emergency_drill', 'latestCheck'
]) && includesAll(repositoryTest, [
  'family_emergency_preparedness_ledger', 'receipt', 'family', 'UPDATE', 'DELETE'
]) && includesAll(ipcTest, [
  '33-H', 'preparedness_kit', 'emergency_drill', 'token', 'base64'
]));
check('root lifecycle and explicit scripts bind 33-H', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-family-emergency-preparedness-boundary.mjs'))
  && ['verify:b5-family-emergency-preparedness:boundary',
    'verify:b5-family-emergency-preparedness:targeted',
    'verify:b5-family-emergency-preparedness:contract',
    'verify:b5-family-emergency-preparedness:runtime',
    'finalize:33-h:external-receipt', 'verify:33-h:completion']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('all contract prerequisites exist', [
  'config/33-h-family-emergency-preparedness-scope.json',
  'config/33-h-family-emergency-preparedness-inventory.json',
  'docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md',
  'docs/security/THREAT_MODEL_33_H_FAMILY_EMERGENCY_PREPAREDNESS.md',
  'docs/audit/33-H_FAMILY_EMERGENCY_PREPAREDNESS_UST_KAPANIS.md',
  'scripts/verify-family-emergency-preparedness-boundary.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-runtime.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-completion.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-H',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: migrationVersions.at(-1),
  closureDatabaseMigration: 86,
  migration86Checksum: migration86?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`Family emergency preparedness contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
