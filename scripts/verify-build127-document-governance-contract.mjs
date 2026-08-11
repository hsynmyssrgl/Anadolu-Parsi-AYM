import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const reportPath = resolve(root, 'artifacts/validation/build127-document-governance-contract.json');
const failures = [];
let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const read = (path) => readFile(resolve(root, path), 'utf8');
const exists = async (path) => {
  try { await stat(resolve(root, path)); return true; }
  catch { return false; }
};

const requiredFiles = [
  'docs/10_MASTER_DECISION_REGISTER.md',
  'docs/11_DOCUMENT_AUTHORITY_MATRIX.md',
  'docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md',
  'docs/13_UI_UX_ACCESSIBILITY_STANDARD.md',
  'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md',
  'docs/15_RELEASE_VALIDATION_GOVERNANCE.md',
  'docs/00_SCOPE_FREEZE.md',
  'docs/01_TECHNICAL_STACK.md',
  'docs/02_SECURITY_BASELINE.md',
  'docs/03_TEST_AND_ACCEPTANCE.md',
  'docs/04_RELEASE_PLAN.md',
  'docs/05_DEFINITION_OF_DONE.md',
  'docs/06_OPEN_ITEMS_AFTER_CODING_START.md',
  'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md',
  'docs/09_ACTIVE_DEVELOPMENT_STATUS.md',
  'docs/adr/ADR-008-product-identity-and-scope-separation.md',
  'docs/adr/ADR-009-release-evidence-honesty.md',
  'docs/adr/ADR-010-apple-inspired-ui-typography.md',
  'docs/adr/ADR-011-independent-backup-and-device-reauthorization.md',
  'docs/adr/ADR-012-document-authority-and-decision-ledger.md'
];

for (const path of requiredFiles) check(await exists(path), `required document missing=${path}`);

const decisionRegister = await read('docs/10_MASTER_DECISION_REGISTER.md');
const decisionIds = [...decisionRegister.matchAll(/^### (DEC-\d{3})/gm)].map((match) => match[1]);
check(decisionIds.length === 41, `decision count=${decisionIds.length}; expected=41`);
check(new Set(decisionIds).size === 41, 'decision identifiers must be unique');
for (let index = 1; index <= 41; index += 1) {
  const id = `DEC-${String(index).padStart(3, '0')}`;
  check(decisionIds.includes(id), `decision missing=${id}`);
}
for (const marker of [
  'Anadolu Parsı Aile Yaşam Merkezi',
  'Ayrı yatırım uygulaması',
  'Her yetişkin kendi özel verisinin sahibidir',
  'Bronze RC2 Active Development',
  'Otomatik aşama geçişi yok',
  'Çalıştırılmayan compile, test, type-check, build, smoke',
  '34 px', '28 px', '22 px', '17 px', '44 px',
  'OneDrive', 'iCloud', 'Google Drive',
  'Windows masaüstüdür', 'Apple Watch', 'Apple Vision Pro'
]) check(decisionRegister.includes(marker), `master decision marker missing=${marker}`);

const catalog = await read('docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md');
const modules = [
  'Gösterge Paneli', 'Aile', 'Soy Ağacı', 'Zaman Tüneli', 'Önemli Günler',
  'Arşiv', 'Finans', 'Sağlık', 'Yaşam Merkezi', 'Bildirim ve Otomasyon',
  'Raporlama', 'Konum', 'Yetkiler', 'Yapay Zekâ', 'Dijital Miras', 'Ayarlar'
];
for (const moduleName of modules) check(catalog.includes(moduleName), `module catalog missing=${moduleName}`);
check((catalog.match(/^### \d+\./gm) ?? []).length === 16, 'module catalog must contain 16 numbered modules');

const ui = await read('docs/13_UI_UX_ACCESSIBILITY_STANDARD.md');
for (const marker of ['34 px', '28 px', '22 px', '20 px', '17 px', '15 px', '13 px', '11–12 px', '44 px']) {
  check(ui.includes(marker), `UI typography marker missing=${marker}`);
}
check(ui.includes('SF font dosyaları projeye gömülmez'), 'SF font embedding prohibition missing');

const security = await read('docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md');
for (const marker of [
  'varsayılan reddetme', '15 dakika', '5 başarısız giriş', 'Ed25519',
  'Açık ret önceliklidir', 'nodeIntegration: false', 'webviewTag: false',
  'OneDrive', 'iCloud', 'Google Drive', 'otomatik güvenilir sayılmaz'
]) check(security.includes(marker), `security marker missing=${marker}`);

const release = await read('docs/15_RELEASE_VALIDATION_GOVERNANCE.md');
for (const marker of [
  'Bronze RC2 Active Development', 'Otomatik Bronze Final',
  'Bronze RC2 Final derlemesine geçilsin mi?', '`NOT_RUN`', '`DIAGNOSTIC_PASS`',
  'Normal Windows’ta sandbox’lı development açılışı'
]) check(release.includes(marker), `release governance marker missing=${marker}`);

const authority = await read('docs/11_DOCUMENT_AUTHORITY_MATRIX.md');
check(authority.includes('En üst proje karar kaydı'), 'document authority hierarchy missing');
check(authority.includes('Tarihsel belgeler'), 'historical document classification missing');
check(authority.includes('Çelişki kontrolleri'), 'document conflict controls missing');

const appMeta = await read('packages/domain/src/app-meta.ts');
check(appMeta.includes("name: 'Anadolu Parsı Aile Yaşam Merkezi'"), 'APP_META active product name mismatch');
check(appMeta.includes("version: '27.07.2026.127'"), 'APP_META application version mismatch');
check(appMeta.includes("packageVersion: '27.7.2026-127'"), 'APP_META package version mismatch');
check(appMeta.includes("Build 127"), 'APP_META stage build mismatch');

const packageJson = JSON.parse(await read('package.json'));
check(packageJson.version === '27.7.2026-127', `package version=${packageJson.version}`);
check(packageJson.scripts?.['verify:build127:document-governance'] === 'node scripts/verify-build127-document-governance-contract.mjs', 'package script missing');

const traceability = await read('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md');
for (const marker of ['Build 127 document governance contract', 'Build 126 — 28 assertion', 'Build 125 PASS — 60 test']) {
  check(traceability.includes(marker), `traceability marker missing=${marker}`);
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '27.07.2026.127',
  packageVersion: '27.7.2026-127',
  stage: 'Bronze RC2 Active Development',
  scope: 'Master decision consolidation, document authority, scope, architecture, security, UI/UX, backup and release governance',
  decisions: decisionIds.length,
  requiredDocuments: requiredFiles.length,
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Build 127 document governance contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 127 document governance contract: PASS — ${assertions} assertions / ${decisionIds.length} decisions / ${requiredFiles.length} documents`);
