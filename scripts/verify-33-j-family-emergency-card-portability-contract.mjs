import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement
  && Object.keys(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);
const ids = Object.freeze(['B5-03', 'EXT-016']);
const evidence = Object.freeze([
  'artifacts/validation/33-J-family-emergency-card-portability-boundary.json',
  'artifacts/validation/33-J-family-emergency-card-portability-contract.json',
  'artifacts/validation/33-J-family-emergency-card-portability-runtime.json'
]);

const [
  registry, ledger, scope, inventory, boundary, migrationManifest, migrations,
  rootPackage, decision, threatModel, auditDocument, masterRegister, workPlan, activeLedger,
  applicationTest, repositoryTest, encryptionTest, ipcTest
] = await Promise.all([
  json('config/accepted-scope-registry.json'),
  json('config/user-decision-ledger.json'),
  json('config/33-j-family-emergency-card-portability-scope.json'),
  json('config/33-j-family-emergency-card-portability-inventory.json'),
  json(evidence[0]),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  json('package.json'),
  text('docs/decisions/DEC-221-family-emergency-card-portability.md'),
  text('docs/security/THREAT_MODEL_33_J_FAMILY_EMERGENCY_CARD_PORTABILITY.md'),
  text('docs/audit/33-J_FAMILY_EMERGENCY_CARD_PORTABILITY_UST_KAPANIS.md'),
  text('docs/10_MASTER_DECISION_REGISTER.md'),
  json('config/work-segmentation-plan.json'),
  json('config/active-governance-ledger.json'),
  text('packages/application/tests/family-emergency-card-portability.test.ts'),
  text('packages/repositories/family-emergency-card-portability-repository-policy.test.ts'),
  text('packages/security/tests/emergency-portable-pack.test.ts'),
  text('apps/desktop/tests/b5-family-emergency-card-portability-ipc-integration.test.ts')
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
const migration88 = migrationManifest.migrationVersions?.find((item) => item.version === 88);

check('two requirements are complete with exact 13-link chains', requirements.every((item) =>
  item?.status === 'COMPLETE' && allChainTrue(item)));
check('two requirements bind the exact 33-J evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('two requirements bind domain security database application repository IPC and UI', requirements.every((item) =>
  ['packages/domain/src/app-data.ts', 'packages/security/src/encryption.ts',
    'packages/database/src/family-database-migrations.ts', 'packages/application/src/life-use-cases.ts',
    'packages/repositories/src/life-repository.ts', 'apps/desktop/src/main/ipc-integration-policy.ts',
    'apps/desktop/src/renderer/ManagedLifePanel.tsx']
    .every((path) => item?.codeAreas?.includes(path))));
check('scope and inventory bind exact DEC-221 implementation',
  scope.status === 'COMPLETE' && scope.validation?.status === 'PASS'
  && scope.validation?.finalEvidence?.productionWorkspaceBuildsPassed === 18
  && scope.validation?.finalEvidence?.finalClosureEvidence === true
  && scope.decision === 'DEC-221'
  && scope.requirements?.join(',') === ids.join(',')
  && inventory.status === 'COMPLETE'
  && inventory.requirements?.join(',') === ids.join(',')
  && inventory.latestDatabaseMigration === 88 && inventory.openRequirements?.length === 0
  && inventory.openBlockers?.length === 0 && inventory.networkChannels?.length === 0);
check('scope truth remains private manual local user-authorized and no external delivery',
  scope.model?.policyRoot === 'independent_private_emergency_profile'
  && scope.truth?.dataSource === 'manual' && scope.truth?.offlineAvailability === 'local_only'
  && scope.truth?.localExport === 'user_authorized_only'
  && scope.truth?.externalDelivery === 'not_performed'
  && scope.truth?.cloudUpload === 'not_performed' && scope.truth?.networkEgressAdded === false
  && scope.power?.mode === 'manual_only' && scope.power?.batteryPromptEnum === 'reserved_not_exposed'
  && scope.power?.batteryLevel === 'not_measured'
  && scope.power?.automaticLowBatteryDetection === 'not_performed'
  && scope.power?.lowBatteryClaimed === false);
check('boundary evidence is exact green and preserves current platform ratchets', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.latestDatabaseMigration >= 88
  && boundary.migration88Checksum === '8785551a6ce0facd609e374e7ba65c70d35b552e6f63a7f0b3d790bfbffa2b04'
  && boundary.familyEmergencyCardPortabilityTables === 1 && boundary.portabilityItemTypes === 5
  && boundary.ipcChannels === 3 && boundary.networkChannels === 0
  && boundary.ppk021ExactAllowlistEntries === 763
  && boundary.ppk021UseCaseCompositionSurfaces === 370
  && boundary.ppk022CapabilitySurfaces === 345);
check('DEC-221 is active and decision cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-221' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')
    && item.document === 'docs/decisions/DEC-221-family-emergency-card-portability.md'));
check('migration 88 closure remains exact under additive successors', migrationVersions.includes(88)
  && (migrationVersions.at(-1) ?? 0) >= 88
  && migrations.includes("createMigrationDefinition(88, 'b5_family_emergency_card_portability_ledger'")
  && migrationManifest.status === 'passed' && migrationManifest.checkCount === 9
  && migration88?.name === 'b5_family_emergency_card_portability_ledger'
  && migration88?.checksum === '8785551a6ce0facd609e374e7ba65c70d35b552e6f63a7f0b3d790bfbffa2b04');
check('decision binds exact share completion encryption and power truth', includesAll(decision, [
  'DEC-221', 'B5-03', 'EXT-016', 'Migration 88', 'file.share', 'shareReceiptHash',
  'AES-256-GCM', 'manual', 'not_measured', 'not_performed'
]));
check('threat model covers confused deputy replay strong auth plaintext and false battery claims', includesAll(threatModel, [
  'Confused deputy', 'Cross-selection', 'Strong authentication', 'plaintext',
  'lowBatteryClaimed=false', 'append-only'
]));
check('audit binds exact IDs evidence and honest local-only truth', ids.every((id) => auditDocument.includes(id))
  && evidence.every((path) => auditDocument.includes(path))
  && includesAll(auditDocument, ['DEC-221', 'Migration 88', '554', '281', '246', 'not_performed']));
check('master register contains active DEC-221 summary', includesAll(masterRegister, [
  '## DEC-221', 'B5-03', 'EXT-016', 'DEC-221-family-emergency-card-portability.md'
]));
check('targeted tests bind application repository encryption and desktop security', includesAll(applicationTest, [
  'selectionSha256', 'shareReceiptHash', 'encrypted_pack'
]) && includesAll(repositoryTest, [
  'family_emergency_card_portability_ledger', 'cross-ledger replay', 'UPDATE', 'DELETE'
]) && includesAll(encryptionTest, ['decrypt', 'tamper', 'password'])
  && includesAll(ipcTest, ['life:exportEmergencyCard', 'print', 'pdf', 'encrypted_pack']));
check('root lifecycle and explicit scripts bind current 33-J boundary', ['pretypecheck', 'prebuild'].every((name) =>
  rootPackage.scripts?.[name]?.includes('verify-family-emergency-card-portability-boundary.mjs'))
  && ['verify:b5-family-emergency-card-portability:boundary',
    'verify:b5-family-emergency-card-portability:targeted',
    'verify:b5-family-emergency-card-portability:contract',
    'verify:b5-family-emergency-card-portability:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
const step33J = workPlan.steps?.find((step) => step.id === '33-J');
const step33K = workPlan.steps?.find((step) => step.id === '33-K');
const laterLifecycle = inspectAuthorizedSuccessorLifecycle({
  plan: workPlan, ledger: activeLedger, predecessorId: '33-J'
});
const activeReady = workPlan.currentStep === '33-J' && step33J?.status === 'IN_PROGRESS'
  && step33J.persistentReceiptStatus === 'PENDING' && step33K?.status === 'PENDING'
  && activeLedger.activeMicroStep === '33-J';
const completedReady = workPlan.currentStep === '33-J' && step33J?.status === 'COMPLETED'
  && step33J.validationStatus === 'PASS' && step33J.persistentReceiptStatus === 'PASS'
  && step33J.completionTransitionStatus === 'PASS' && step33K?.status === 'PENDING'
  && activeLedger.activeMicroStep === null
  && activeLedger.libraryUploadStatus === '33-J_COMPLETED_RECEIPT_PASS'
  && activeLedger.externalLibraryAuthority33J?.status === 'PASS';
check('33-J lifecycle is active, receipt-complete, or preserved through an authorized successor',
  activeReady || completedReady
    || (laterLifecycle.planValid && laterLifecycle.ledgerValid && laterLifecycle.nextTaskValid));
check('all contract prerequisites exist', [
  'config/33-j-family-emergency-card-portability-scope.json',
  'config/33-j-family-emergency-card-portability-inventory.json',
  'docs/decisions/DEC-221-family-emergency-card-portability.md',
  'docs/security/THREAT_MODEL_33_J_FAMILY_EMERGENCY_CARD_PORTABILITY.md',
  'docs/audit/33-J_FAMILY_EMERGENCY_CARD_PORTABILITY_UST_KAPANIS.md',
  'scripts/verify-family-emergency-card-portability-boundary.mjs',
  'scripts/verify-33-j-family-emergency-card-portability-runtime.mjs'
].every(existsSync));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-J',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: migrationVersions.at(-1),
  migration88Checksum: migration88?.checksum,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`Family emergency card portability contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
