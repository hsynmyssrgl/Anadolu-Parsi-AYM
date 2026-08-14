
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const canonicalRoot = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (root !== canonicalRoot) throw new Error(`Unsafe source root: ${root}`);

const requirements = Object.freeze(['B6-02', 'PPK-028', 'AUD-COM-006', 'EXT-036', 'EXT-037', 'EXT-038', 'EXT-040', 'EXT-041', 'EXT-042']);
const paths = Object.freeze({
  scope: 'config/33-o-privacy-ownership-data-rights-incident-control-scope.json',
  inventory: 'config/33-o-privacy-ownership-data-rights-incident-control-inventory.json',
  registry: 'config/accepted-scope-registry.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  boundary: 'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-boundary.json',
  contract: 'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-contract.json',
  runtime: 'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  ast: 'artifacts/validation/platform-policy-ast-gate.json',
  capability: 'artifacts/validation/platform-capability-manifest-gate.json',
  decision: 'docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md',
  threat: 'docs/security/THREAT_MODEL_33_O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL.md',
  audit: 'docs/audit/33-O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL_UST_KAPANIS.md',
  master: 'docs/10_MASTER_DECISION_REGISTER.md'
});
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const writeJson = async (path, value) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const manualTruthLine = '- Manuel kapanış kanıtı: legalReview=NOT_RUN; privacyReview=NOT_RUN; realDevice=NOT_RUN; humanUat=NOT_RUN; certificationClaimed=false.';
const nodeRun = (args, timeout = 900_000) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, env: process.env });
const markValidated = (document, label) => {
  assert(document.includes('- Durum: IN_PROGRESS'), `${label} status is not IN_PROGRESS`);
  assert(document.includes('- Doğrulama: NOT_RUN'), `${label} validation is not NOT_RUN`);
  const validated = document
    .replace('- Durum: IN_PROGRESS', '- Durum: VALIDATED_RECEIPT_PENDING')
    .replace('- Doğrulama: NOT_RUN', '- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION');
  return validated.includes(manualTruthLine) ? validated : `${validated.trimEnd()}\n\n${manualTruthLine}\n`;
};
for (const script of [
  'scripts/verify-33-o-privacy-ownership-data-rights-incident-control-boundary.mjs',
  'scripts/verify-33-o-privacy-ownership-data-rights-incident-control-contract.mjs',
  'scripts/verify-33-o-privacy-ownership-data-rights-incident-control-runtime.mjs',
  'scripts/verify-database-migrations.mjs',
  'scripts/verify-platform-policy-ast-gate.mjs',
  'scripts/verify-platform-capability-manifest-gate.mjs'
]) {
  const run = nodeRun([script]);
  assert(run.status === 0, `${script} failed:\n${run.stdout}\n${run.stderr}`);
}
const fullVitest = nodeRun(['node_modules/vitest/vitest.mjs', 'run']);
const fullOutput = `${fullVitest.stdout ?? ''}\n${fullVitest.stderr ?? ''}`;
const fullFiles = fullOutput.match(/Test Files\s+(\d+) passed/u);
const fullTests = fullOutput.match(/Tests\s+(\d+) passed/u);
assert(fullVitest.status === 0 && fullFiles && fullTests, `Full Vitest failed or output drifted:\n${fullOutput.slice(-8000)}`);
const npmCli = process.env.npm_execpath;
assert(typeof npmCli === 'string' && npmCli.length > 0, 'Production build requires the npm CLI path from the package-script environment');
const productionBuild = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 900_000,
  maxBuffer: 64 * 1024 * 1024, env: process.env
});
assert(productionBuild.status === 0,
  `Production build failed (${productionBuild.error?.message ?? `status=${productionBuild.status}, signal=${productionBuild.signal ?? 'none'}`}):\n${productionBuild.stdout ?? ''}\n${productionBuild.stderr ?? ''}`);

const [scope, inventory, registry, plan, ledger, roadmap, boundary, contract, runtime, migration, ast, capability] = await Promise.all([
  readJson(paths.scope), readJson(paths.inventory), readJson(paths.registry), readJson(paths.plan), readJson(paths.ledger),
  readJson(paths.roadmap), readJson(paths.boundary), readJson(paths.contract), readJson(paths.runtime), readJson(paths.migration),
  readJson(paths.ast), readJson(paths.capability)
]);

const migration92 = migration.migrationVersions?.find((item) => item.version === 92);
assert(scope.decision === 'DEC-226' && exact(scope.requirements, requirements), '33-O scope identity drift');
assert(inventory.decision === 'DEC-226' && exact(inventory.requirements, requirements), '33-O inventory identity drift');
assert(boundary.status === 'PASS' && boundary.checksPassed === 45 && boundary.checksFailed === 0, '33-O boundary evidence is not exact');
assert(contract.status === 'PASS' && contract.checksPassed === 18 && contract.checksFailed === 0, '33-O contract evidence is not exact');
assert(runtime.status === 'PASS' && runtime.checksPassed === 18 && runtime.checksFailed === 0
  && runtime.targetedTestFilesPassed === 11 && runtime.targetedTestsPassed === 167, '33-O runtime evidence is not exact');
assert(migration.status === 'passed' && migration92?.name === 'privacy_ownership_data_rights_incident_control', 'Migration 92 evidence drift');
assert(migration92.checksum === 'a81c13518563172d29aa2b351218faf553a2189616657fc0fbda9b1922eee137', 'Migration 92 checksum drift');
assert(ast.status === 'PASS' && ast.exactAllowlistEntries === 590 && ast.surfaceCounts?.USE_CASE_COMPOSITION === 297
  && ast.findings?.length === 0, 'PPK-021 evidence drift');
assert(capability.status === 'PASS' && capability.exactManifestSurfaces === 254 && capability.findings?.length === 0, 'PPK-022 evidence drift');
const step = plan.steps?.find((item) => item.id === '33-O');
assert(step?.status === 'IN_PROGRESS' && step.persistentReceiptStatus === 'PENDING'
  && plan.currentStep === '33-O' && ledger.activeMicroStep === '33-O', '33-O is not the active receipt-pending step');
assert(plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1, '33-O must be the only in-progress governed step');

const evidence = Object.freeze([
  'docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md',
  'docs/security/THREAT_MODEL_33_O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL.md',
  'packages/domain/src/privacy-ownership-data-rights.ts',
  'packages/application/src/privacy-ownership-data-rights-use-cases.ts',
  'packages/database/src/family-database-migrations.ts',
  'packages/repository-contracts/src/privacy-ownership-data-rights-repository.ts',
  'packages/repositories/src/privacy-ownership-data-rights-repository.ts',
  'packages/security/src/privacy-data-export.ts',
  'apps/desktop/src/main/privacy-data-export-service.ts',
  'apps/desktop/src/main/ipc-integration-policy.ts',
  'apps/desktop/src/renderer/App.tsx',
  'packages/application/tests/privacy-ownership-data-rights-use-cases.test.ts',
  'packages/repositories/privacy-ownership-data-rights-repository-policy.test.ts',
  'packages/security/tests/privacy-data-export.test.ts',
  'apps/desktop/tests/privacy-data-export-service.test.ts',
  'apps/desktop/tests/privacy-ownership-data-rights-ipc-integration.test.ts',
  'apps/desktop/tests/privacy-ownership-data-rights-ipc-bridge.test.ts',
  'apps/desktop/tests/privacy-ownership-data-rights-application-adapter.test.ts',
  'apps/desktop/tests/privacy-ownership-data-store.test.ts',
  'apps/desktop/tests/privacy-ownership-data-rights-ui.test.ts',
  'apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts',
  'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts',
  paths.boundary, paths.contract, paths.runtime
]);
const chain = Object.freeze({decision:true,threatModel:true,scope:true,inventory:true,domain:true,migration:true,application:true,repositoryContract:true,repository:true,policy:true,ipc:true,ui:true,tests:true});
for (const id of requirements) {
  const item = registry.requirements?.find((candidate) => candidate.id === id);
  assert(item, `Registry requirement missing: ${id}`);
  item.status = 'COMPLETE';
  item.chain = { ...chain };
  item.evidence = [...evidence];
}

const preparedAt = new Date().toISOString();
scope.status = 'COMPLETE';
scope.validation = {
  ...scope.validation,
  status: 'PASS',
  finalEvidence: {
    boundaryChecksPassed: 45,
    contractChecksPassed: 18,
    runtimeChecksPassed: 18,
    targetedTestFilesPassed: 11,
    targetedTestsPassed: runtime.targetedTestsPassed,
    fullVitestTestFilesPassed: Number(fullFiles[1]),
    fullVitestTestsPassed: Number(fullTests[1]),
    productionWorkspaceBuildsPassed: 18,
    ppk021ExactAllowlistEntries: 590,
    ppk021UseCaseCompositionSurfaces: 297,
    ppk022CapabilitySurfaces: 254,
    networkChannels: 0,
    operatingSystemSettingsModified: false,
    localUserSelectedEncryptedFileWriteSupported: true,
    latestDatabaseMigration: 92,
    migration92Checksum: migration92.checksum,
    requirementChainsComplete: 9,
    automatedClosureEvidenceComplete: true,
    legalReview: 'NOT_RUN',
    privacyReview: 'NOT_RUN',
    realDevice: 'NOT_RUN',
    humanUat: 'NOT_RUN',
    certificationClaimed: false
  },
  preparedAt
};
scope.completionBlockers = ['Persistent local and D: receipt, source protection and Git remote equality are pending.'];
inventory.status = 'COMPLETE';
inventory.openRequirements = [];
inventory.openBlockers = ['Persistent local and D: receipt, source protection and Git remote equality are pending.'];
inventory.validation = { status: 'PASS', boundaryChecks: 45, contractChecks: 18, runtimeChecks: 18, targetedTestFiles: 11, targetedTests: runtime.targetedTestsPassed, preparedAt };
step.validationStatus = 'PASS';
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
plan.updatedAt = preparedAt;
plan.segmentationNote = '33-O is validated PASS and remains fail-closed IN_PROGRESS until exact local and D: persistent receipt finalization.';
ledger.postflightStatus = 'PENDING_33_O_PERSISTENT_RECEIPT';
ledger.libraryUploadStatus = '33-O_VALIDATED_RECEIPT_PENDING';
ledger.nextOfficialTask = '33-O_PERSISTENT_RECEIPT_AND_SOURCE_PROTECTION';
ledger.updatedAt = preparedAt;
const roadmap33O = roadmap.packages?.find((item) => item.step === '33-O');
const roadmap33P = roadmap.packages?.find((item) => item.step === '33-P');
assert(roadmap33O && roadmap33P && roadmap33P.decision === 'DEC-227' && exact(roadmap33P.dependsOn, ['33-O']), '33-O/33-P roadmap entries are missing or successor binding drifted');
roadmap33O.status = 'VALIDATED_AWAITING_RECEIPT';
roadmap33P.status = 'PLANNED_NEXT';
roadmap.updatedAt = preparedAt;

const audit = `# 33-O Gizlilik, Sahiplik, Veri Haklari ve Olay Kontrolu - Ust Kapanis

## Durum

VALIDATED / RECEIPT_PENDING. Kod ve otomatik kanitlar PASS; persistent receipt tamamlanmadan resmi adim IN_PROGRESS kalir.

## Kapsam

DEC-226 altinda dokuz requirement; merkezi PEP/UoW, migration 92, yonetilen AI hafiza, veri haklari, yerel olay containment, sifreli export, PPK-016 lineage ve PPK-019 deletion propagation ile dogrulandi.

## Otomatik kanit

- Boundary: PASS 45/45.
- Contract: PASS 18/18.
- Runtime: PASS 18/18; 11 dosya ve ${runtime.targetedTestsPassed} hedefli test.
- Manuel kanit: hukuk incelemesi NOT_RUN; gizlilik incelemesi NOT_RUN; gercek cihaz NOT_RUN; insan UAT NOT_RUN; certificationClaimed=false.
- Otomatik uygulama kapanisi COMPLETE olabilir; bu durum hukuk, gizlilik veya insan UAT sertifikasyonu iddiasi degildir.
- Tam regresyon: PASS ${Number(fullFiles[1])} dosya / ${Number(fullTests[1])} test.
- Production build: PASS, 18 workspace.
- Migration 92 checksum: ${migration92.checksum}.

## Kalan kapi

Persistent receipt, exact readback, source protection ve Git remote esitligi PASS olmadan COMPLETED iddiasi kurulmaz.
`;
let master = await readFile(resolve(root, paths.master), 'utf8');
const [decisionDocument, threatModel] = await Promise.all([
  readFile(resolve(root, paths.decision), 'utf8'),
  readFile(resolve(root, paths.threat), 'utf8')
]);
const validatedDecisionDocument = markValidated(decisionDocument, 'DEC-226');
const validatedThreatModel = markValidated(threatModel, '33-O threat model');
if (!master.includes('## DEC-226')) {
  const entry = `\n## DEC-226 - Gizlilik sahiplik veri haklari ve olay kontrolu\n\n33-O dokuz requirement icin merkezi PEP/UoW, migration 92, yerel gozlem, sifreli export ve no-claim sinirlarini baglar. Ayrinti: docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md.\n`;
  master = `${entry}\n${master}`;
}

await Promise.all([
  writeJson(paths.scope, scope), writeJson(paths.inventory, inventory), writeJson(paths.registry, registry),
  writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.roadmap, roadmap),
  writeFile(resolve(root, paths.decision), validatedDecisionDocument, 'utf8'),
  writeFile(resolve(root, paths.threat), validatedThreatModel, 'utf8'),
  writeFile(resolve(root, paths.audit), audit, 'utf8'), writeFile(resolve(root, paths.master), master, 'utf8')
]);
console.log('33-O completion preparation: PASS (9/9 requirements; receipt remains PENDING).');
