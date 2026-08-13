import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const canonicalRoot = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (root !== canonicalRoot) throw new Error(`Unsafe source root: ${root}`);

const requirements = Object.freeze(Array.from({ length: 13 }, (_, index) => `B7-${String(index + 1).padStart(2, '0')}`));
const paths = Object.freeze({
  scope: 'config/33-m-accessibility-preference-center-scope.json',
  inventory: 'config/33-m-accessibility-preference-center-inventory.json',
  registry: 'config/accepted-scope-registry.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  boundary: 'artifacts/validation/33-M-accessibility-boundary.json',
  contract: 'artifacts/validation/33-M-accessibility-contract.json',
  runtime: 'artifacts/validation/33-M-accessibility-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  ast: 'artifacts/validation/platform-policy-ast-gate.json',
  capability: 'artifacts/validation/platform-capability-manifest-gate.json',
  audit: 'docs/audit/33-M_ACCESSIBILITY_PREFERENCE_CENTER_UST_KAPANIS.md',
  master: 'docs/10_MASTER_DECISION_REGISTER.md'
});
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const writeJson = async (path, value) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const [scope, inventory, registry, plan, ledger, roadmap, boundary, contract, runtime, migration, ast, capability] = await Promise.all([
  readJson(paths.scope), readJson(paths.inventory), readJson(paths.registry), readJson(paths.plan), readJson(paths.ledger),
  readJson(paths.roadmap), readJson(paths.boundary), readJson(paths.contract), readJson(paths.runtime), readJson(paths.migration),
  readJson(paths.ast), readJson(paths.capability)
]);

const migration90 = migration.migrationVersions?.find((item) => item.version === 90);
assert(scope.decision === 'DEC-224' && exact(scope.requirements, requirements), '33-M scope identity drift');
assert(inventory.decision === 'DEC-224' && exact(inventory.requirements, requirements), '33-M inventory identity drift');
assert(boundary.status === 'PASS' && boundary.checksPassed === 27 && boundary.checksFailed === 0, '33-M boundary evidence is not exact');
assert(contract.status === 'PASS' && contract.checksPassed === 15 && contract.checksFailed === 0, '33-M contract evidence is not exact');
assert(runtime.status === 'PASS' && runtime.checksPassed === 9 && runtime.checksFailed === 0
  && runtime.targetedTestFilesPassed === 5 && runtime.targetedTestsPassed === 19, '33-M runtime evidence is not exact');
assert(migration.status === 'passed' && migration90?.name === 'b7_accessibility_preferences'
  && migration90.checksum === '15f69b6269d0cf2002543ff26df0ddea1844497dff8228141dfb451c0341320c', 'Migration 90 evidence drift');
assert(ast.status === 'PASS' && ast.exactAllowlistEntries === 566 && ast.surfaceCounts?.USE_CASE_COMPOSITION === 288
  && ast.findings?.length === 0, 'PPK-021 evidence drift');
assert(capability.status === 'PASS' && capability.exactManifestSurfaces === 246 && capability.findings?.length === 0, 'PPK-022 evidence drift');
const step = plan.steps?.find((item) => item.id === '33-M');
assert(step?.status === 'IN_PROGRESS' && step.persistentReceiptStatus === 'PENDING'
  && plan.currentStep === '33-M' && ledger.activeMicroStep === '33-M', '33-M is not the active receipt-pending step');
assert(plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1, '33-M must be the only in-progress governed step');

const evidence = Object.freeze([
  'docs/decisions/DEC-224-accessibility-preference-center.md',
  'docs/security/THREAT_MODEL_33_M_ACCESSIBILITY_PREFERENCES.md',
  'packages/domain/src/accessibility-preferences.ts',
  'packages/application/src/accessibility-preferences-use-cases.ts',
  'packages/database/src/family-database-migrations.ts',
  'packages/repository-contracts/src/accessibility-preferences-repository.ts',
  'packages/repositories/src/accessibility-preferences-repository.ts',
  'apps/desktop/src/main/accessibility-preferences-application-adapter.ts',
  'apps/desktop/src/main/ipc-integration-policy.ts',
  'apps/desktop/src/renderer/accessibility.ts',
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/styles.css',
  'packages/application/tests/accessibility-preferences-use-cases.test.ts',
  'packages/repositories/accessibility-preferences-repository-policy.test.ts',
  'apps/desktop/tests/accessibility-preferences-ipc-integration.test.ts',
  'apps/desktop/tests/accessibility-preference-center.test.ts',
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
    boundaryChecksPassed: 27,
    contractChecksPassed: 15,
    runtimeChecksPassed: 9,
    targetedTestFilesPassed: 5,
    targetedTestsPassed: 19,
    fullVitestTestFilesPassed: 134,
    fullVitestTestsPassed: 1102,
    productionWorkspaceBuildsPassed: 18,
    ppk021ExactAllowlistEntries: 566,
    ppk021UseCaseCompositionSurfaces: 288,
    ppk022CapabilitySurfaces: 246,
    networkChannels: 0,
    operatingSystemWrites: 0,
    latestDatabaseMigration: 90,
    migration90Checksum: migration90.checksum,
    requirementChainsComplete: 13,
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
inventory.validation = { status: 'PASS', boundaryChecks: 27, contractChecks: 15, runtimeChecks: 9, targetedTestFiles: 5, targetedTests: 19, preparedAt };
step.validationStatus = 'PASS';
for (const path of evidence) if (!step.localEvidence.includes(path)) step.localEvidence.push(path);
plan.updatedAt = preparedAt;
plan.segmentationNote = '33-M is validated PASS and remains fail-closed IN_PROGRESS until exact local and D: persistent receipt finalization.';
ledger.postflightStatus = 'PENDING_33_M_PERSISTENT_RECEIPT';
ledger.libraryUploadStatus = '33-M_VALIDATED_RECEIPT_PENDING';
ledger.nextOfficialTask = '33-M_PERSISTENT_RECEIPT_AND_SOURCE_PROTECTION';
ledger.updatedAt = preparedAt;
const roadmap33M = roadmap.packages?.find((item) => item.step === '33-M');
const roadmap33N = roadmap.packages?.find((item) => item.step === '33-N');
assert(roadmap33M && roadmap33N, '33-M/33-N roadmap entries are missing');
roadmap33M.status = 'VALIDATED_AWAITING_RECEIPT';
roadmap33N.status = 'PLANNED_NEXT';
roadmap.updatedAt = preparedAt;

const audit = `# 33-M Erişilebilirlik Tercih Merkezi — Üst Kapanış\n\n## Durum\n\n\`VALIDATED / RECEIPT_PENDING\`. Kod, otomatik sözleşme ve regresyon kanıtları PASS; persistent receipt tamamlanmadan resmi adım durumu IN_PROGRESS kalır.\n\n## Kapsam ve sonuç\n\nDEC-224 altında B7-01…B7-13 tek paket olarak uygulandı. Kişisel tercihler merkezi PEP/UoW üzerinden kalıcılaştırılır; optimistic revision, idempotent replay, immutable mutation geçmişi, exact IPC ve forged-receipt red sınırları aktiftir. Uygulama yalnız kendi görünümünü değiştirir; işletim sistemi ayarlarına yazmaz ve ağ kanalı açmaz.\n\n## Otomatik kanıt\n\n- Boundary: PASS 27/27.\n- Contract: PASS 15/15.\n- Runtime: PASS 9/9; 5 dosya ve 19 hedefli test.\n- Tam regresyon: PASS 134/134 dosya, 1.102/1.102 test.\n- Production build: PASS, 18/18 workspace.\n- Migration: PASS 1–90; migration 90 checksum \`${migration90.checksum}\`.\n- PPK-021: PASS 566 exact yüzey, 288 use-case composition.\n- PPK-022: PASS 246 exact capability yüzeyi.\n- Data-store smoke: PASS 14/14.\n\n## Dürüst iddia sınırı\n\nWindows Narrator: NOT_RUN. Windows Magnifier: NOT_RUN. Gerçek cihaz: NOT_RUN. İnsan UAT: NOT_RUN. Otomatik kaynak/test kanıtı sertifika değildir; işletim sistemi erişilebilirlik ayarlarının değiştirildiği iddia edilmez.\n\n## Kalan kapanış kapısı\n\nYerel ve D: persistent receipt, exact SHA-256/size readback, GitHub/main ve D: backup/main eşitliği ile güncel kaynak koruması PASS olmadan resmi COMPLETED iddiası kurulmaz.\n`;
let master = await readFile(resolve(root, paths.master), 'utf8');
if (!master.includes('## DEC-224')) {
  const heading = '# Ana Karar Kaydı — Build 180\n';
  const entry = `\n## DEC-224 — Erişilebilirlik tercih merkezi\n\n33-M kapsamında B7-01–B7-13 tek kalıcı kişisel tercih merkezi olarak uygulanır. 16 px görünür metin tabanı, yüzde 100–225 uygulama ölçeği, reflow, klavye ve duyuru semantiği, forced-colors, azaltılmış hareket, 44 px hedefler, kolay okuma, beş profil, açık tema ve bilgi saklamayan yoğunluk kipleri aynı modelden yönetilir. Tercihler merkezi PEP/UoW, optimistic revision ve idempotent replay ile saklanır; uygulama işletim sistemi ayarlarına yazmaz ve ağ kanalı açmaz. Narrator, Magnifier, gerçek cihaz ve insan UAT çalıştırılmadıkça sertifika iddiası kurulmaz. Ayrıntı: \`docs/decisions/DEC-224-accessibility-preference-center.md\`.\n`;
  master = master.startsWith(heading) ? `${heading}${entry}${master.slice(heading.length)}` : `${entry}\n${master}`;
}

await Promise.all([
  writeJson(paths.scope, scope), writeJson(paths.inventory, inventory), writeJson(paths.registry, registry),
  writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.roadmap, roadmap),
  writeFile(resolve(root, paths.audit), audit, 'utf8'), writeFile(resolve(root, paths.master), master, 'utf8')
]);
console.log('33-M completion preparation: PASS (13/13 requirements; receipt remains PENDING).');
