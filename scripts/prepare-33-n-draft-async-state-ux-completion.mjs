import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const canonicalRoot = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (root !== canonicalRoot) throw new Error(`Unsafe source root: ${root}`);

const requirements = Object.freeze(['B3-02', 'B7-14', 'B7-15']);
const paths = Object.freeze({
  scope: 'config/33-n-draft-async-state-ux-scope.json',
  inventory: 'config/33-n-draft-async-state-ux-inventory.json',
  registry: 'config/accepted-scope-registry.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  boundary: 'artifacts/validation/33-N-draft-async-state-ux-boundary.json',
  contract: 'artifacts/validation/33-N-draft-async-state-ux-contract.json',
  runtime: 'artifacts/validation/33-N-draft-async-state-ux-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  ast: 'artifacts/validation/platform-policy-ast-gate.json',
  capability: 'artifacts/validation/platform-capability-manifest-gate.json',
  decision: 'docs/decisions/DEC-225-draft-async-state-ux.md',
  threat: 'docs/security/THREAT_MODEL_33_N_DRAFT_ASYNC_STATE_UX.md',
  audit: 'docs/audit/33-N_DRAFT_ASYNC_STATE_UX_UST_KAPANIS.md',
  master: 'docs/10_MASTER_DECISION_REGISTER.md'
});
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const writeJson = async (path, value) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const nodeRun = (args, timeout = 900_000) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, env: process.env });
const markValidated = (document, label) => {
  assert(document.includes('- Durum: IN_PROGRESS'), `${label} status is not IN_PROGRESS`);
  assert(document.includes('- Doğrulama: NOT_RUN'), `${label} validation is not NOT_RUN`);
  return document
    .replace('- Durum: IN_PROGRESS', '- Durum: VALIDATED_RECEIPT_PENDING')
    .replace('- Doğrulama: NOT_RUN', '- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION');
};
for (const script of [
  'scripts/verify-33-n-draft-async-state-ux-boundary.mjs',
  'scripts/verify-33-n-draft-async-state-ux-contract.mjs',
  'scripts/verify-33-n-draft-async-state-ux-runtime.mjs',
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

const migration91 = migration.migrationVersions?.find((item) => item.version === 91);
assert(scope.decision === 'DEC-225' && exact(scope.requirements, requirements), '33-N scope identity drift');
assert(inventory.decision === 'DEC-225' && exact(inventory.requirements, requirements), '33-N inventory identity drift');
assert(boundary.status === 'PASS' && boundary.checksPassed === 28 && boundary.checksFailed === 0, '33-N boundary evidence is not exact');
assert(contract.status === 'PASS' && contract.checksPassed === 17 && contract.checksFailed === 0, '33-N contract evidence is not exact');
assert(runtime.status === 'PASS' && runtime.checksPassed === 11 && runtime.checksFailed === 0
  && runtime.targetedTestFilesPassed === 7 && runtime.targetedTestsPassed === 40, '33-N runtime evidence is not exact');
assert(migration.status === 'passed' && migration91?.name === 'b3_governed_form_drafts'
  && migration91.checksum === '7107cbdbe66f05ac6e208bfac39bc4bcc884c679e63af4e49c4a15bacda1b611', 'Migration 91 evidence drift');
assert(ast.status === 'PASS' && ast.exactAllowlistEntries === 571 && ast.surfaceCounts?.USE_CASE_COMPOSITION === 291
  && ast.findings?.length === 0, 'PPK-021 evidence drift');
assert(capability.status === 'PASS' && capability.exactManifestSurfaces === 246 && capability.findings?.length === 0, 'PPK-022 evidence drift');
const step = plan.steps?.find((item) => item.id === '33-N');
assert(step?.status === 'IN_PROGRESS' && step.persistentReceiptStatus === 'PENDING'
  && plan.currentStep === '33-N' && ledger.activeMicroStep === '33-N', '33-N is not the active receipt-pending step');
assert(plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1, '33-N must be the only in-progress governed step');

const evidence = Object.freeze([
  'docs/decisions/DEC-225-draft-async-state-ux.md',
  'docs/security/THREAT_MODEL_33_N_DRAFT_ASYNC_STATE_UX.md',
  'packages/domain/src/form-drafts.ts',
  'packages/application/src/form-draft-use-cases.ts',
  'packages/database/src/family-database-migrations.ts',
  'packages/repository-contracts/src/form-draft-repository.ts',
  'packages/repositories/src/form-draft-repository.ts',
  'apps/desktop/src/main/form-draft-application-adapter.ts',
  'apps/desktop/src/main/ipc-integration-policy.ts',
  'apps/desktop/src/renderer/form-ux.tsx',
  'apps/desktop/src/renderer/async-state-guard.ts',
  'apps/desktop/src/renderer/route-async-state.ts',
  'apps/desktop/src/renderer/App.tsx',
  'packages/application/tests/form-draft-use-cases.test.ts',
  'packages/repositories/form-draft-repository-policy.test.ts',
  'apps/desktop/tests/form-draft-ipc-integration.test.ts',
  'apps/desktop/tests/form-ux.test.ts',
  'apps/desktop/tests/async-state-guard.test.ts',
  'apps/desktop/tests/b7-15-route-async-state-governance.test.ts',
  'config/33-n-b7-15-route-async-state-inventory.json',
  'scripts/verify-33-n-b7-15-route-async-state-governance.mjs',
  paths.boundary, paths.contract, paths.runtime
]);
const chain = Object.freeze({
  decision: true, domain: true, schema: true, migration: true, useCase: true, repository: true,
  policy: true, apiOrIpc: true, ui: true, menu: true, targetedTest: true, documentation: true, evidence: true
});
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
    boundaryChecksPassed: 28,
    contractChecksPassed: 17,
    runtimeChecksPassed: 11,
    targetedTestFilesPassed: 7,
    targetedTestsPassed: 40,
    fullVitestTestFilesPassed: Number(fullFiles[1]),
    fullVitestTestsPassed: Number(fullTests[1]),
    productionWorkspaceBuildsPassed: 18,
    ppk021ExactAllowlistEntries: 571,
    ppk021UseCaseCompositionSurfaces: 291,
    ppk022CapabilitySurfaces: 246,
    networkChannels: 0,
    operatingSystemWrites: 0,
    latestDatabaseMigration: 91,
    migration91Checksum: migration91.checksum,
    requirementChainsComplete: 3,
    automatedClosureEvidenceComplete: true,
    manualWindowsNarrator: 'NOT_RUN',
    manualWindowsMagnifier: 'NOT_RUN',
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
inventory.validation = { status: 'PASS', boundaryChecks: 28, contractChecks: 17, runtimeChecks: 11, targetedTestFiles: 7, targetedTests: 40, preparedAt };
step.validationStatus = 'PASS';
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
plan.updatedAt = preparedAt;
plan.segmentationNote = '33-N is validated PASS and remains fail-closed IN_PROGRESS until exact local and D: persistent receipt finalization.';
ledger.postflightStatus = 'PENDING_33_N_PERSISTENT_RECEIPT';
ledger.libraryUploadStatus = '33-N_VALIDATED_RECEIPT_PENDING';
ledger.nextOfficialTask = '33-N_PERSISTENT_RECEIPT_AND_SOURCE_PROTECTION';
ledger.updatedAt = preparedAt;
const roadmap33N = roadmap.packages?.find((item) => item.step === '33-N');
const roadmap33O = roadmap.packages?.find((item) => item.step === '33-O');
assert(roadmap33N && roadmap33O, '33-N/33-O roadmap entries are missing');
roadmap33N.status = 'VALIDATED_AWAITING_RECEIPT';
roadmap33O.status = 'PLANNED_NEXT';
roadmap.updatedAt = preparedAt;

const audit = `# 33-N Taslak ve Asenkron Durum UX - Ust Kapanis

## Durum

VALIDATED / RECEIPT_PENDING. Kod ve otomatik kanitlar PASS; persistent receipt tamamlanmadan resmi adim IN_PROGRESS kalir.

## Kapsam

DEC-225 altinda B3-02, B7-14 ve B7-15; merkezi form_draft PEP/UoW, migration 91 immutable history, optimistic revision, idempotent replay, immediate undo, exact IPC, canli dogrulama ve empty/loading/offline/error/retry yuzeyleriyle dogrulandi.

## Otomatik kanit

- Boundary: PASS 28/28.
- Contract: PASS 17/17.
- Runtime: PASS 11/11; 7 dosya ve 40 hedefli test.
- Manuel kanit: Windows Narrator NOT_RUN; Windows Magnifier NOT_RUN; gercek cihaz NOT_RUN; insan UAT NOT_RUN; certificationClaimed=false.
- Otomatik uygulama kapanisi COMPLETE olabilir; bu durum manuel erisilebilirlik sertifikasyonu iddiasi degildir.
- Tam regresyon: PASS ${Number(fullFiles[1])} dosya / ${Number(fullTests[1])} test.
- Production build: PASS, 18 workspace.
- Migration 91 checksum: ${migration91.checksum}.

## Kalan kapi

Persistent receipt, exact readback, source protection ve Git remote esitligi PASS olmadan COMPLETED iddiasi kurulmaz.
`;
let master = await readFile(resolve(root, paths.master), 'utf8');
const [decisionDocument, threatModel] = await Promise.all([
  readFile(resolve(root, paths.decision), 'utf8'),
  readFile(resolve(root, paths.threat), 'utf8')
]);
const validatedDecisionDocument = markValidated(decisionDocument, 'DEC-225');
const validatedThreatModel = markValidated(threatModel, '33-N threat model');
if (!master.includes('## DEC-225')) {
  const entry = `\n## DEC-225 - Taslak ve asenkron durum UX\n\n33-N; B3-02, B7-14 ve B7-15 icin merkezi form_draft PEP/UoW, immutable revision history, immediate undo, accessible validation ve fail-closed async state sozlesmesini baglar. Ayrinti: docs/decisions/DEC-225-draft-async-state-ux.md.\n`;
  master = `${entry}\n${master}`;
}

await Promise.all([
  writeJson(paths.scope, scope), writeJson(paths.inventory, inventory), writeJson(paths.registry, registry),
  writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.roadmap, roadmap),
  writeFile(resolve(root, paths.decision), validatedDecisionDocument, 'utf8'),
  writeFile(resolve(root, paths.threat), validatedThreatModel, 'utf8'),
  writeFile(resolve(root, paths.audit), audit, 'utf8'), writeFile(resolve(root, paths.master), master, 'utf8')
]);
console.log('33-N completion preparation: PASS (3/3 requirements; receipt remains PENDING).');
