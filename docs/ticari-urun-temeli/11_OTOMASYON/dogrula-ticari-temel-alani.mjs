import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const REPO = resolve(ROOT, '..', '..');
const failures = [];
let checks = 0;

const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', windowsHide: true }).trim();

const expectedSections = [
  '01_YONETIM',
  '02_IS_ANALIZI',
  '03_MIMARI',
  '04_URUN_TASARIMI',
  '05_KALITE_TEST_KANIT',
  '06_DIS_KAYNAK_VE_LISANS',
  '07_TICARI_HAZIRLIK',
  '08_IS_LISTESI',
  '09_TARIHCE',
  '10_SEMALAR',
  '11_OTOMASYON',
];
const requiredFiles = [
  '00_OKU_BENI.md',
  '00_TEMEL_SURUM_MANIFESTOSU.json',
  '01_YONETIM/01_ASILAMAZ_KURALLAR.md',
  '01_YONETIM/02_KARAR_VE_DEGISIKLIK_YONETIMI.md',
  '01_YONETIM/03_SORUMLULUK_VE_ONAY_MATRISI.md',
  '01_YONETIM/04_AKTIF_KURAL_SICILI.json',
  '01_YONETIM/05_DEGISIKLIK_SICILI.json',
  '01_YONETIM/06_RISK_SICILI.md',
  '02_IS_ANALIZI/01_URUN_IS_ANALIZI.md',
  '02_IS_ANALIZI/02_KULLANICI_AKISLARI.md',
  '02_IS_ANALIZI/03_GEREKSINIM_IZLENEBILIRLIK_MATRISI.md',
  '03_MIMARI/01_SISTEM_MIMARISI.md',
  '03_MIMARI/02_VERI_MIMARISI.md',
  '03_MIMARI/03_GUVENLIK_MIMARISI.md',
  '03_MIMARI/04_PLATFORM_VE_DAGITIM_MIMARISI.md',
  '03_MIMARI/05_ORTAM_VE_YAYIN_TOPOLOJISI.md',
  '04_URUN_TASARIMI/01_UX_ERISILEBILIRLIK_VE_MARKA.md',
  '04_URUN_TASARIMI/02_SURUM_RENK_PALETLERI.md',
  '05_KALITE_TEST_KANIT/01_TEST_VE_KABUL_STRATEJISI.md',
  '05_KALITE_TEST_KANIT/02_KANIT_VE_IZLENEBILIRLIK_SISTEMI.md',
  '05_KALITE_TEST_KANIT/03_KANIT_SICILI.json',
  '06_DIS_KAYNAK_VE_LISANS/01_TICARI_LISANS_ENVANTERI.md',
  '06_DIS_KAYNAK_VE_LISANS/02_SAGLAYICI_SECIM_KRITERLERI.md',
  '07_TICARI_HAZIRLIK/01_TICARILESME_YOL_HARITASI.md',
  '07_TICARI_HAZIRLIK/02_LISANS_AKTIVASYON_VE_DENEME.md',
  '07_TICARI_HAZIRLIK/03_OPERASYON_DESTEK_VE_OLAY_YONETIMI.md',
  '08_IS_LISTESI/01_ANA_IS_LISTESI.md',
  '08_IS_LISTESI/02_DIS_KAYNAK_GEREKTIREN_ISLER.md',
  '08_IS_LISTESI/03_ANA_IS_SICILI.json',
  '08_IS_LISTESI/04_IS_YURUTME_SIRASI.md',
  '09_TARIHCE/01_PROJE_TARIHCESI.md',
  '10_SEMALAR/01_KURAL_SEMASI.schema.json',
  '10_SEMALAR/02_KARAR_SEMASI.schema.json',
  '10_SEMALAR/03_IS_PAKETI_SEMASI.schema.json',
  '10_SEMALAR/04_KANIT_SEMASI.schema.json',
  '11_OTOMASYON/dogrula-ticari-temel-alani.mjs',
];

for (const section of expectedSections) {
  check(await exists(resolve(ROOT, section)), `zorunlu klasor eksik: ${section}`);
}
for (const file of requiredFiles) {
  check(await exists(resolve(ROOT, file)), `zorunlu dosya eksik: ${file}`);
}

const allFiles = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    check(/^[A-Za-z0-9._-]+$/.test(entry.name), `ASCII dosya/klasor adi kurali ihlali: ${relative(ROOT, resolve(directory, entry.name))}`);
    if (entry.isDirectory()) await walk(resolve(directory, entry.name));
    else allFiles.push(resolve(directory, entry.name));
  }
};
await walk(ROOT);
check(allFiles.length >= requiredFiles.length, `dosya envanteri beklenenden kucuk: ${allFiles.length}/${requiredFiles.length}`);

const generatedEvidencePath = resolve(ROOT, '05_KALITE_TEST_KANIT', '04_TICARI_TEMEL_DOGRULAMA_KANITI.json');
const fileInventory = [];
for (const path of allFiles) {
  const content = await readText(path);
  check(content.length > 0, `bos dosya: ${relative(ROOT, path)}`);
  check(content.endsWith('\n'), `son satir sonu eksik: ${relative(ROOT, path)}`);
  const forbiddenCodePoints = new Set([0xfffd, 0x00c3, 0x00c4, 0x00c5]);
  check(![...content].some((character) => forbiddenCodePoints.has(character.codePointAt(0))), `mojibake veya gecersiz UTF-8 adayi: ${relative(ROOT, path)}`);
  if (path.endsWith('.json')) {
    try {
      JSON.parse(content);
      check(true, `JSON okunur: ${relative(ROOT, path)}`);
    } catch (error) {
      check(false, `JSON gecersiz ${relative(ROOT, path)}: ${error.message}`);
    }
  }
  if (path !== generatedEvidencePath) {
    fileInventory.push(Object.freeze({
      path: relative(ROOT, path).replaceAll('\\', '/'),
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256(content)
    }));
  }
}
fileInventory.sort((left, right) => left.path.localeCompare(right.path, 'en'));
const sourceFingerprintSha256 = sha256(fileInventory.map((item) => `${item.path}|${item.bytes}|${item.sha256}`).join('\n'));

const manifest = await readJson(resolve(ROOT, '00_TEMEL_SURUM_MANIFESTOSU.json'));
check(manifest.id === 'PARSYUVA-AYM-TICARI-TEMEL-20260819-01', 'manifesto kimligi degisti');
check(manifest.baselineDate === '2026-08-19', 'temel tarihi degisti');
check(manifest.product === 'ParsYuva AYM', 'urun adi ParsYuva AYM olmali');
check(manifest.commercialReleaseEligible === false, 'ticari yayin uygunlugu kanitsiz true olamaz');
check(manifest.evidenceRequiredForCompletion === true, 'tamamlama icin kanit zorunlu olmali');
check(manifest.externalEvidenceDefaultsToNotRun === true, 'dis kanit varsayilani NOT_RUN olmali');
check(JSON.stringify(manifest.rootSections) === JSON.stringify(expectedSections), 'manifesto klasor sirasi degisti');

const ruleBinding = await readJson(resolve(ROOT, '01_YONETIM', '04_AKTIF_KURAL_SICILI.json'));
const canonicalRules = await readJson(resolve(REPO, 'config', 'canonical-rule-registry.json'));
const canonicalCore = { ...canonicalRules };
delete canonicalCore.rulesSha256;
const calculatedRuleHash = sha256(stable(canonicalCore));
check(canonicalRules.exceptionless === true, 'kanonik kurallar istisnasiz olmali');
check(canonicalRules.rulesSha256 === calculatedRuleHash, 'kanonik kural SHA hesaplamasi uyusmuyor');
check(ruleBinding.istisnaIzinli === false, 'ticari kural bagi istisna kabul edemez');
check(ruleBinding.anaKuralSiciliId === canonicalRules.id, 'kural sicili kimligi drift etti');
check(ruleBinding.anaKuralSayisi === canonicalRules.ruleCount, 'kural sayisi drift etti');
check(ruleBinding.aktifKuralSayisi === canonicalRules.activeRuleCount, 'aktif kural sayisi drift etti');
check(ruleBinding.degistirilmisKuralSayisi === canonicalRules.supersededRuleCount, 'superseded kural sayisi drift etti');
check(ruleBinding.anaKuralSha256 === canonicalRules.rulesSha256, 'ticari temel kural SHA bagi stale');
const localRuleIds = new Set();
for (const rule of ruleBinding.kurallar ?? []) {
  check(/^TK-[0-9]{3}$/.test(rule.id), `yerel ticari kural ID gecersiz: ${rule.id}`);
  check(!localRuleIds.has(rule.id), `yerel ticari kural ID tekrarli: ${rule.id}`);
  localRuleIds.add(rule.id);
  check(rule.durum === 'ACTIVE', `${rule.id} aktif olmali`);
  check(rule.yurutme === 'FAIL_CLOSED', `${rule.id} fail-closed olmali`);
  check(rule.kanitZorunlu === true, `${rule.id} kanit zorunlulugu eksik`);
}

for (const schemaFile of [
  '01_KURAL_SEMASI.schema.json',
  '02_KARAR_SEMASI.schema.json',
  '03_IS_PAKETI_SEMASI.schema.json',
  '04_KANIT_SEMASI.schema.json',
]) {
  const schema = await readJson(resolve(ROOT, '10_SEMALAR', schemaFile));
  check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `${schemaFile} draft 2020-12 olmali`);
  check(schema.type === 'object', `${schemaFile} kok tipi object olmali`);
  check(schema.additionalProperties === false, `${schemaFile} bilinmeyen alanlari reddetmeli`);
  check(Array.isArray(schema.required) && schema.required.length >= 6, `${schemaFile} zorunlu alanlari yetersiz`);
}

const decisionLedger = await readJson(resolve(REPO, 'config', 'user-decision-ledger.json'));
const decision259 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-259');
check(decisionLedger.decisionCount === decisionLedger.decisions.length, 'karar defteri sayisi uyusmuyor');
check(decision259?.status === 'ACTIVE', 'DEC-259 aktif karar defterinde yok');
check(decision259?.syncStatus === 'SYNCHRONIZED', 'DEC-259 senkron degil');
const currentDecisionSummary = await readText(resolve(REPO, 'docs', 'current', '09_KULLANICI_KARARLARI_KAYDI.md'));
const currentMaster = await readText(resolve(REPO, 'docs', 'current', '11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md'));
const currentCommercial = await readText(resolve(REPO, 'docs', 'current', '14_TICARI_URUN_TEMEL_SURUMU.md'));
check(currentDecisionSummary.includes('DEC-259'), 'DEC-259 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-259'), 'DEC-259 guncel ana sicilde yok');
check(currentCommercial.includes('verify:commercial-baseline'), 'ticari aktif belge dogrulama komutunu gostermiyor');

const workRegistry = await readJson(resolve(ROOT, '08_IS_LISTESI', '03_ANA_IS_SICILI.json'));
const workMarkdown = await readText(resolve(ROOT, '08_IS_LISTESI', '01_ANA_IS_LISTESI.md'));
const markdownRows = [...workMarkdown.matchAll(/^\| (IS-[0-9]{4}) \| ([^|]+) \| ([^|]+) \| (TAMAMLANDI|DEVAM|ACIK|BLOCKED|NOT_RUN) \| ([^|]+) \|$/gm)];
check(workRegistry.toplamIs === 49, `makine is sayisi 49 olmali: ${workRegistry.toplamIs}`);
check(workRegistry.isler.length === workRegistry.toplamIs, `is sicili sayisi uyusmuyor: ${workRegistry.isler.length}/${workRegistry.toplamIs}`);
check(markdownRows.length === workRegistry.toplamIs, `markdown is sayisi uyusmuyor: ${markdownRows.length}/${workRegistry.toplamIs}`);
check(workRegistry.tamamlandi === workRegistry.isler.filter((item) => item.durum === 'TAMAMLANDI').length, 'tamamlanan is sayisi drift etti');
const workIds = new Set();
for (const item of workRegistry.isler) {
  check(/^IS-[0-9]{4}$/.test(item.id), `is ID gecersiz: ${item.id}`);
  check(!workIds.has(item.id), `is ID tekrarli: ${item.id}`);
  workIds.add(item.id);
  check(workRegistry.izinliDurumlar.includes(item.durum), `${item.id} durum gecersiz: ${item.durum}`);
  check(item.durum === 'TAMAMLANDI' ? item.requirementPass === true && item.kanit.length > 0 : item.requirementPass === false, `${item.id} kanit/durum gercekligi bozuk`);
  if (item.durum === 'TAMAMLANDI') {
    for (const evidencePath of item.kanit) check(await exists(resolve(ROOT, evidencePath)), `${item.id} kanit dosyasi eksik: ${evidencePath}`);
  }
  if (item.durum !== 'TAMAMLANDI') check(String(item.acikNedeni ?? '').length >= 15, `${item.id} acik nedeni yetersiz`);
}
for (const [, id, , , status] of markdownRows) {
  const item = workRegistry.isler.find((candidate) => candidate.id === id);
  check(Boolean(item), `${id} makine is sicilinde yok`);
  check(item?.durum === status, `${id} markdown ve JSON durumu farkli: ${status}/${item?.durum}`);
}
check(workRegistry.requirementPass === false, 'tum ana is listesi kanitsiz PASS olamaz');

const evidenceRegistry = await readJson(resolve(ROOT, '05_KALITE_TEST_KANIT', '03_KANIT_SICILI.json'));
const evidenceIds = new Set();
for (const evidence of evidenceRegistry.kayitlar ?? []) {
  check(/^KANIT-[0-9]{4}$/.test(evidence.id), `kanit ID gecersiz: ${evidence.id}`);
  check(!evidenceIds.has(evidence.id), `kanit ID tekrarli: ${evidence.id}`);
  evidenceIds.add(evidence.id);
  if (evidence.disKaynak) check(evidence.durum !== 'PASS', `${evidence.id} dis kaynak kanitsiz PASS olamaz`);
}

const gitEvidence = await readJson(resolve(ROOT, '05_KALITE_TEST_KANIT', '05_GIT_YEDEK_DOGRULAMA_KANITI.json'));
const normalizedRepo = REPO.replaceAll('\\', '/').toLowerCase();
check(git(['rev-parse', '--show-toplevel']).replaceAll('\\', '/').toLowerCase() === normalizedRepo, 'ticari temel kanonik Git deposunda degil');
check(git(['ls-files', '--error-unmatch', 'docs/ticari-urun-temeli/00_OKU_BENI.md']) === 'docs/ticari-urun-temeli/00_OKU_BENI.md', 'ticari temel girisi Git tarafindan izlenmiyor');
check(gitEvidence.status === 'PASS', 'Git yedek kaniti PASS degil');
check(/^[a-f0-9]{40}$/.test(gitEvidence.commit), 'Git yedek commit kimligi gecersiz');
for (const ref of ['HEAD', 'github/main', 'backup/main']) {
  let ancestor = false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', gitEvidence.commit, ref], { cwd: REPO, windowsHide: true, stdio: 'ignore' });
    ancestor = true;
  } catch {}
  check(ancestor, `Git yedek commit ${ref} tarihinde yok`);
}
check(gitEvidence.github?.commit === gitEvidence.commit && gitEvidence.github?.status === 'PASS', 'GitHub yedek kaniti uyusmuyor');
check(gitEvidence.localBackup?.commit === gitEvidence.commit && gitEvidence.localBackup?.status === 'PASS', 'yerel bare Git yedek kaniti uyusmuyor');

const packageJson = await readJson(resolve(REPO, 'package.json'));
const preflightSource = await readText(resolve(REPO, 'scripts', 'run-governed-preflight.mjs'));
check(packageJson.scripts?.['verify:commercial-baseline'] === 'node docs/ticari-urun-temeli/11_OTOMASYON/dogrula-ticari-temel-alani.mjs', 'npm ticari temel dogrulama komutu eksik veya drift etti');
check(preflightSource.includes('docs/ticari-urun-temeli/11_OTOMASYON/dogrula-ticari-temel-alani.mjs'), 'governed preflight ticari temel kapisini calistirmiyor');

const rootReadme = await readText(resolve(ROOT, '00_OKU_BENI.md'));
check(rootReadme.startsWith('# ParsYuva AYM Ticari Urun Temel Surumu'), 'ana baslik marka kuralina uymuyor');
check(rootReadme.includes('Tarihsel belge aktif gereksinim kaynagi olarak kullanilamaz'), 'tarihsel belge siniri eksik');
const history = await readText(resolve(ROOT, '09_TARIHCE', '01_PROJE_TARIHCESI.md'));
check(history.includes('20.07.2026'), 'proje baslangic tarihi tarihcede yok');
check(history.includes('19.08.2026 ticari temel surumu'), 'ticari temel tarihce kaydi yok');

const report = {
  schemaVersion: 1,
  id: 'PARSYUVA-AYM-TICARI-TEMEL-DOGRULAMA-V1',
  product: manifest.product,
  baselineDate: manifest.baselineDate,
  documentSetVersion: manifest.documentSetVersion,
  canonicalRuleRegistry: canonicalRules.id,
  canonicalRuleCount: canonicalRules.ruleCount,
  canonicalRuleSha256: canonicalRules.rulesSha256,
  decision: 'DEC-259',
  workItemCount: workRegistry.isler.length,
  fileCount: allFiles.length,
  sourceFileCount: fileInventory.length,
  sourceFingerprintSha256,
  checks,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  commercialReleaseEligible: false,
  externalEvidenceDefaultsToNotRun: true,
  failures,
  fileInventory,
  generatedAt: new Date().toISOString(),
};
await writeFile(generatedEvidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Ticari temel alani: PASS (${checks} kontrol / ${allFiles.length} dosya / ${workRegistry.isler.length} is / ${canonicalRules.ruleCount} kural).`);
