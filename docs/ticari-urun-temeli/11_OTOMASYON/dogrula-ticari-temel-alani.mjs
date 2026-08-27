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
check(manifest.id === 'PARSYUVA-AILE-YASAM-MERKEZI-TICARI-TEMEL-20260824-08', 'manifesto kimligi degisti');
check(manifest.baselineDate === '2026-08-24', 'temel tarihi degisti');
check(manifest.product === 'ParsYuva Aile Yaşam Merkezi', 'urun adi tam ParsYuva Aile Yaşam Merkezi olmali');
check(manifest.commercialReleaseEligible === false, 'ticari yayin uygunlugu kanitsiz true olamaz');
check(manifest.evidenceRequiredForCompletion === true, 'tamamlama icin kanit zorunlu olmali');
check(manifest.externalEvidenceDefaultsToNotRun === true, 'dis kanit varsayilani NOT_RUN olmali');
check(['PASS', 'NOT_RUN'].includes(manifest.governedPreflight), 'manifesto governed preflight durumu gecersiz');
check(typeof manifest.worktreeClean === 'boolean', 'manifesto worktree temizligi boolean olmali');
check(manifest.governedPreflight !== 'PASS' || manifest.worktreeClean === true, 'kirli calisma agaci governed preflight PASS sayilamaz');
check(JSON.stringify(manifest.rootSections) === JSON.stringify(expectedSections), 'manifesto klasor sirasi degisti');

const ruleBinding = await readJson(resolve(ROOT, '01_YONETIM', '04_AKTIF_KURAL_SICILI.json'));
const canonicalRules = await readJson(resolve(REPO, 'config', 'canonical-rule-registry.json'));
const canonicalCore = { ...canonicalRules };
delete canonicalCore.rulesSha256;
const calculatedRuleHash = sha256(stable(canonicalCore));
check(canonicalRules.exceptionless === true, 'kanonik kurallar istisnasiz olmali');
check(canonicalRules.rulesSha256 === calculatedRuleHash, 'kanonik kural SHA hesaplamasi uyusmuyor');
check(manifest.canonicalRuleRegistry === canonicalRules.id, 'manifesto kanonik kural sicili kimligi drift etti');
check(manifest.canonicalRuleCount === canonicalRules.ruleCount, 'manifesto kanonik kural sayisi drift etti');
check(manifest.canonicalRuleSha256 === canonicalRules.rulesSha256, 'manifesto kanonik kural SHA bagi stale');
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
  check(rule.durum === 'ACTIVE' || (['TK-010', 'TK-012'].includes(rule.id) && rule.durum === 'SUPERSEDED'), `${rule.id} durum gecersiz`);
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
const decision260 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-260');
const decision261 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-261');
const decision262 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-262');
const decision263 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-263');
const decision264 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-264');
const decision265 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-265');
const decision266 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-266');
const decision267 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-267');
const decision268 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-268');
const decision269 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-269');
const decision270 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-270');
const decision271 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-271');
const decision272 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-272');
const decision273 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-273');
const decision274 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-274');
const decision275 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-275');
const decision276 = decisionLedger.decisions.find((decision) => decision.id === 'DEC-276');
check(decisionLedger.decisionCount === decisionLedger.decisions.length, 'karar defteri sayisi uyusmuyor');
check(decision259?.status === 'ACTIVE', 'DEC-259 aktif karar defterinde yok');
check(decision259?.syncStatus === 'SYNCHRONIZED', 'DEC-259 senkron degil');
check(decision260?.status === 'ACTIVE', 'DEC-260 aktif karar defterinde yok');
check(decision260?.syncStatus === 'SYNCHRONIZED', 'DEC-260 senkron degil');
check(decision261?.status === 'ACTIVE', 'DEC-261 aktif karar defterinde yok');
check(decision261?.syncStatus === 'SYNCHRONIZED', 'DEC-261 senkron degil');
check(decision262?.status === 'SUPERSEDED' && decision262?.supersededBy === 'DEC-271', 'DEC-262 DEC-271 ile superseded degil');
check(decision262?.syncStatus === 'SYNCHRONIZED', 'DEC-262 senkron degil');
check(decision263?.status === 'ACTIVE', 'DEC-263 aktif karar defterinde yok');
check(decision263?.syncStatus === 'SYNCHRONIZED', 'DEC-263 senkron degil');
check(decision264?.status === 'ACTIVE', 'DEC-264 aktif karar defterinde yok');
check(decision264?.syncStatus === 'SYNCHRONIZED', 'DEC-264 senkron degil');
check(decision265?.status === 'ACTIVE', 'DEC-265 aktif karar defterinde yok');
check(decision265?.syncStatus === 'SYNCHRONIZED', 'DEC-265 senkron degil');
check(decision266?.status === 'SUPERSEDED', 'DEC-266 superseded karar defterinde yok');
check(decision266?.syncStatus === 'SYNCHRONIZED', 'DEC-266 senkron degil');
check(decision267?.status === 'ACTIVE', 'DEC-267 aktif karar defterinde yok');
check(decision267?.syncStatus === 'SYNCHRONIZED', 'DEC-267 senkron degil');
check(decision268?.status === 'ACTIVE', 'DEC-268 aktif karar defterinde yok');
check(decision268?.syncStatus === 'SYNCHRONIZED', 'DEC-268 senkron degil');
check(decision269?.status === 'SUPERSEDED' && decision269?.supersededBy === 'DEC-271', 'DEC-269 DEC-271 ile superseded degil');
check(decision269?.syncStatus === 'SYNCHRONIZED', 'DEC-269 senkron degil');
check(decision270?.status === 'ACTIVE', 'DEC-270 aktif karar defterinde yok');
check(decision270?.syncStatus === 'SYNCHRONIZED', 'DEC-270 senkron degil');
check(decision271?.status === 'ACTIVE', 'DEC-271 aktif karar defterinde yok');
check(decision271?.syncStatus === 'SYNCHRONIZED', 'DEC-271 senkron degil');
check(decision272?.status === 'ACTIVE', 'DEC-272 aktif karar defterinde yok');
check(decision272?.syncStatus === 'SYNCHRONIZED', 'DEC-272 senkron degil');
check(decision273?.status === 'ACTIVE', 'DEC-273 aktif karar defterinde yok');
check(decision273?.syncStatus === 'SYNCHRONIZED', 'DEC-273 senkron degil');
check(decision274?.status === 'ACTIVE', 'DEC-274 aktif karar defterinde yok');
check(decision274?.syncStatus === 'SYNCHRONIZED', 'DEC-274 senkron degil');
check(decision275?.status === 'ACTIVE', 'DEC-275 aktif karar defterinde yok');
check(decision275?.syncStatus === 'SYNCHRONIZED', 'DEC-275 senkron degil');
check(decision276?.status === 'ACTIVE' && decision276?.syncStatus === 'SYNCHRONIZED', 'DEC-276 aktif ve senkron karar defterinde yok');
check(decision276?.document === 'docs/decisions/DEC-276-bronze-51-rejected-predecessor-recovery-bootstrap.md'
  && JSON.stringify(decision276?.requirements) === JSON.stringify(['PR-241']),
'DEC-276 exact dokuman ve PR-241 otorite bagi uyusmuyor');
const currentDecisionSummary = await readText(resolve(REPO, 'docs', 'current', '09_KULLANICI_KARARLARI_KAYDI.md'));
const currentMaster = await readText(resolve(REPO, 'docs', 'current', '11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md'));
const currentCommercial = await readText(resolve(REPO, 'docs', 'current', '14_TICARI_URUN_TEMEL_SURUMU.md'));
check(currentDecisionSummary.includes('DEC-259'), 'DEC-259 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-259'), 'DEC-259 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-260'), 'DEC-260 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-260'), 'DEC-260 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-261'), 'DEC-261 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-261'), 'DEC-261 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-262'), 'DEC-262 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-262'), 'DEC-262 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-263'), 'DEC-263 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-263'), 'DEC-263 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-264'), 'DEC-264 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-264'), 'DEC-264 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-265'), 'DEC-265 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-265'), 'DEC-265 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-266'), 'DEC-266 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-266'), 'DEC-266 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-267'), 'DEC-267 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-267'), 'DEC-267 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-268'), 'DEC-268 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-268'), 'DEC-268 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-269'), 'DEC-269 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-269'), 'DEC-269 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-270'), 'DEC-270 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-270'), 'DEC-270 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-271'), 'DEC-271 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-271'), 'DEC-271 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-272'), 'DEC-272 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-272'), 'DEC-272 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-273'), 'DEC-273 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-273'), 'DEC-273 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-274'), 'DEC-274 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-274'), 'DEC-274 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-275'), 'DEC-275 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-275'), 'DEC-275 guncel ana sicilde yok');
check(currentDecisionSummary.includes('DEC-276'), 'DEC-276 kullanici kararlari kaydinda yok');
check(currentMaster.includes('DEC-276') && currentMaster.includes('PR-241'), 'DEC-276/PR-241 guncel ana sicil bagi eksik');
check(currentCommercial.includes('verify:commercial-baseline'), 'ticari aktif belge dogrulama komutunu gostermiyor');

const commercialChangeLedger = await readJson(resolve(ROOT, '01_YONETIM', '05_DEGISIKLIK_SICILI.json'));
const commercialChange52Entries = commercialChangeLedger.kayitlar.filter((entry) => entry.id === 'TICARI-052');
const commercialChange52 = commercialChange52Entries[0];
check(commercialChangeLedger.sonKayit === 'TICARI-052'
  && commercialChangeLedger.kayitlar.at(-1)?.id === 'TICARI-052'
  && commercialChange52Entries.length === 1,
'TICARI-052 exact tekil son ticari degisiklik kaydi degil');
check(commercialChange52?.durum === 'ACTIVE'
  && commercialChange52?.senkronDurumu === 'SYNCHRONIZED'
  && String(commercialChange52?.kaynak ?? '').includes('DEC-275, DEC-276, PR-235, PR-240, PR-241')
  && String(commercialChange52?.kaynak ?? '').includes('8ea2dfe1')
  && String(commercialChange52?.kaynak ?? '').includes('24e6bd71')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('58/58')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('59/59')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('2 dosya/17 test PASS')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('15e3c9d0 pre-mutation baseline PASS')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('d68fd2a4 test baslamadan duran invocation-only checkpointtir')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('3976994d ile korunmustur')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('fb8683dc ile korunmustur')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('a6020cb4 ile korunmustur')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('61f09ed5 ile korunmustur')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('f4f84896 exact turunda')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('19 dosya/191 test PASS')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('399 dosya/2.483 test PASS')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('8ea2dfe1 ile korunmustur')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('42/43 PASS ve 1 FAIL')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('24e6bd71 ile korunmustur')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('18 bolge/590 dosya/0 bulgu/2 adapter/3 amac')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('f54e3f302649af67ed6d028e66673eea68b0d58c2ba43c912c1ccb7534babe98')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('ag yetkisi degismemistir')
  && Array.isArray(commercialChange52?.etkilenenAlanlar)
  && commercialChange52.etkilenenAlanlar.includes('config/ppk-015-network-egress-current-ratchet.json')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('2 dosya/18 test PASS')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('bos InstallLocation')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('surum ekli DisplayName degeri legacy sayilmis')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('gercek uygulama EXE kimligini yazar')
  && String(commercialChange52?.isListesiEtkisi ?? '').includes('kaldirma komutlari exact dogrulanir'),
'TICARI-052 ACTIVE/SYNCHRONIZED Bronze 52 UAT110, 3976994d ret, uninstall sicili ve 58/58 gorsel QA bagi eksik');

const workRegistry = await readJson(resolve(ROOT, '08_IS_LISTESI', '03_ANA_IS_SICILI.json'));
const workMarkdown = await readText(resolve(ROOT, '08_IS_LISTESI', '01_ANA_IS_LISTESI.md'));
const markdownRows = [...workMarkdown.matchAll(/^\| (IS-[0-9]{4}) \| ([^|]+) \| ([^|]+) \| (TAMAMLANDI|DEVAM|ACIK|BLOCKED|NOT_RUN) \| ([^|]+) \|$/gm)];
check(workRegistry.toplamIs === 61, `makine is sayisi 61 olmali: ${workRegistry.toplamIs}`);
check(localRuleIds.has('TK-015'), 'TK-015 acik tek seferli surum tahsisi kurali eksik');
check(workRegistry.isler.some((item) => item.id === 'IS-0212'), 'IS-0212 surum tahsisi is kaydi eksik');
check(localRuleIds.has('TK-016'), 'TK-016 kanonik Windows kurulu UAT kurali eksik');
check(workRegistry.isler.some((item) => item.id === 'IS-0213'), 'IS-0213 kanonik Windows kurulu UAT is kaydi eksik');
check(localRuleIds.has('TK-017'), 'TK-017 adversarial Windows teslim kanit kurali eksik');
check(workRegistry.isler.some((item) => item.id === 'IS-0214'), 'IS-0214 adversarial Windows teslim kaniti is kaydi eksik');
check(localRuleIds.has('TK-018'), 'TK-018 tum kayit ve test kapanisi kurali eksik');
check(workRegistry.isler.some((item) => item.id === 'IS-0215'), 'IS-0215 tum kayit ve test kapanisi is kaydi eksik');
check(localRuleIds.has('TK-019'), 'TK-019 Bronze 51 rejected predecessor recovery bootstrap kurali eksik');
check(workRegistry.isler.some((item) => item.id === 'IS-0216'), 'IS-0216 Bronze 51 rejected predecessor recovery bootstrap is kaydi eksik');
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
const mutationPolicy = await readJson(resolve(REPO, 'config', 'mutation-release-readiness-policy.json'));
const mutationDependencyRegistryBytes = await readFile(resolve(REPO, 'config', 'change-impact-dependency-registry.json'));
const mutationDependencyRegistry = JSON.parse(mutationDependencyRegistryBytes.toString('utf8'));
const mutationDependencyRegistrySha256 = sha256(mutationDependencyRegistryBytes);
check(mutationPolicy.schemaVersion === 2 && mutationPolicy.id === 'PPT-MUTATION-RELEASE-READINESS-V2'
  && mutationPolicy.requirement === 'PR-235' && mutationPolicy.decision === 'DEC-270'
  && mutationPolicy.strengthenedByRequirement === 'PR-240' && mutationPolicy.strengthenedByDecision === 'DEC-275'
  && mutationPolicy.failClosed === true && mutationPolicy.waiverAllowed === false
  && mutationPolicy.dependencyRegistry?.path === 'config/change-impact-dependency-registry.json'
  && mutationPolicy.dependencyRegistry?.sha256 === mutationDependencyRegistrySha256
  && mutationDependencyRegistry.strengthenedByRequirement === 'PR-240'
  && mutationDependencyRegistry.strengthenedByDecision === 'DEC-275'
  && mutationDependencyRegistry.failClosed === true
  && mutationDependencyRegistry.unmatchedChangedPathEffect === 'BLOCK'
  && Array.isArray(mutationDependencyRegistry.universalDependentRecords)
  && mutationDependencyRegistry.universalDependentRecords.length === 13
  && Array.isArray(mutationDependencyRegistry.universalAffectedVitestFiles)
  && mutationDependencyRegistry.universalAffectedVitestFiles.length === 3
  && mutationDependencyRegistry.pathRules?.some((rule) => rule.id === 'governed-source-safety-net'
    && rule.dependentRecords?.length > 0 && rule.affectedVitestFiles?.length > 0),
'PR-235 mutation-release readiness politikasi eksik veya gevsetilmis');

const rootReadme = await readText(resolve(ROOT, '00_OKU_BENI.md'));
check(rootReadme.startsWith('# ParsYuva Aile Yasam Merkezi Ticari Urun Temel Surumu'), 'ana baslik tam marka kuralina uymuyor');
check(!rootReadme.includes('ParsYuva AYM'), 'aktif ana belgede kaldirilan AYM urun kisaltmasi bulunuyor');
check(rootReadme.includes('Tarihsel belge aktif gereksinim kaynagi olarak kullanilamaz'), 'tarihsel belge siniri eksik');
const history = await readText(resolve(ROOT, '09_TARIHCE', '01_PROJE_TARIHCESI.md'));
check(history.includes('20.07.2026'), 'proje baslangic tarihi tarihcede yok');
check(history.includes('19.08.2026 ticari temel surumu'), 'ticari temel tarihce kaydi yok');

const report = {
  schemaVersion: 1,
  id: 'PARSYUVA-AILE-YASAM-MERKEZI-TICARI-TEMEL-DOGRULAMA-V2',
  product: manifest.product,
  baselineDate: manifest.baselineDate,
  documentSetVersion: manifest.documentSetVersion,
  canonicalRuleRegistry: canonicalRules.id,
  canonicalRuleCount: canonicalRules.ruleCount,
  canonicalRuleSha256: canonicalRules.rulesSha256,
  decision: 'DEC-259',
  commercialChange: 'TICARI-052',
  decisions: ['DEC-259', 'DEC-270', 'DEC-274', 'DEC-275', 'DEC-276'],
  requirements: ['PR-235', 'PR-239', 'PR-240', 'PR-241'],
  mutationWideRecordAndTestClosureVerified: failures.length === 0,
  mutationDependencyRegistrySha256,
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
