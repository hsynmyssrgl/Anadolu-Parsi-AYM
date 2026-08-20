import { readFile } from 'node:fs/promises';

const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const read = (path) => readFile(path, 'utf8');

const [meta, desktopPackageRaw, main, installer, artifactStore, decision, corporatePlan] = await Promise.all([
  read('packages/domain/src/app-meta.ts'),
  read('apps/desktop/package.json'),
  read('apps/desktop/src/main/main.ts'),
  read('apps/desktop/build/installer.nsh'),
  read('apps/desktop/src/main/protected-side-artifact-store.ts'),
  read('docs/decisions/DEC-254-parsyuva-brand-and-institutionalization-roadmap.md'),
  read('docs/current/13_KURUMSALLASMA_VE_GLOBAL_MARKA_PLANI.md')
]);
const desktopPackage = JSON.parse(desktopPackageRaw);

check(meta.includes("CURRENT_BRAND_NAME = 'ParsYuva'"), 'Ana marka ParsYuva değil.');
check(meta.includes("CURRENT_PRODUCT_LONG_NAME = 'ParsYuva Aile Yaşam Merkezi'"), 'Görünür ürün tam ParsYuva Aile Yaşam Merkezi adıyla tanımlı değil.');
check(meta.includes("STABLE_APPLICATION_ID = 'tr.anadoluparsi.aileyasammerkezi'"), 'Kararlı Windows appId açıkça korunmuyor.');
check(meta.includes('STABLE_USER_DATA_DIRECTORY_NAME = LEGACY_PRODUCT_NAME'), 'Eski kullanıcı veri dizini yükseltme uyumluluğuna bağlanmamış.');
check(desktopPackage.build?.appId === 'tr.anadoluparsi.aileyasammerkezi', 'Paket appId yükseltme uyumluluğunu bozuyor.');
check(desktopPackage.build?.productName === 'ParsYuva Aile Yaşam Merkezi', 'Paket görünen ürün adı tam değil.');
check(desktopPackage.build?.executableName === 'ParsYuva', 'Kurulu ana program dosyası ParsYuva.exe değil.');
check(desktopPackage.build?.nsis?.shortcutName === 'ParsYuva', 'Kısayol adı ParsYuva değil.');
check(/^ParsYuva-(?:Bronze|Silver|Gold)-\d{2}\.\d{2}\.\d{4}\.\d+\.\$\{ext\}$/u.test(desktopPackage.build?.win?.artifactName ?? ''), 'Kurulum dosyası yalnız ParsYuva, kanal ve görünür sürüm bilgisini taşımıyor.');
check(main.includes("const currentProductName = APP_META.name;"), 'Main görünen ürün adını APP_META üzerinden almıyor.');
check(main.includes("join(appDataPath, STABLE_USER_DATA_DIRECTORY_NAME)"), 'Main mevcut kullanıcı verisi için kararlı dizini kullanmıyor.');
check(installer.includes('LangString AymFinishTitle ${AYM_LANG_TURKISH} "ParsYuva Aile Yaşam Merkezi kullanıma hazır"'), 'Kurulum bitiş başlığı tam ürün adını kullanmıyor.');
check(!installer.includes('ParsYuva AYM'), 'Kurulum metninde kaldırılan ürün kısaltması bulunuyor.');
check(installer.includes('$INSTDIR\\ParsYuva.exe'), 'Kaldırıcı ParsYuva.exe adını kullanmıyor.');
check(installer.includes('$APPDATA\\Anadolu Parsı Aile Yaşam Merkezi'), 'Kaldırıcı kararlı eski veri dizinini açıkça korumuyor.');
check(artifactStore.includes('ACCEPTED_PERSISTED_PRODUCT_NAMES'), 'Eski korumalı artifact okuma uyumluluğu yok.');
check(artifactStore.includes('product: CURRENT_PRODUCT_NAME'), 'Yeni korumalı artifact tam ParsYuva Aile Yaşam Merkezi adıyla yazılmıyor.');
check(decision.includes('Şirket kuruluşu: NOT_RUN'), 'DEC-254 şirket kuruluşunu fail-honest göstermiyor.');
check(decision.includes('Marka başvurusu/tescili: NOT_RUN'), 'DEC-254 marka tescilini fail-honest göstermiyor.');
check(corporatePlan.includes('countsAsRequirementPass'), 'Kurumsallaşma planında requirement PASS sınırı yok.');
check(corporatePlan.includes('ParsYuva Dijital Yaşam Teknolojileri Anonim Şirketi'), 'Şirket unvanı adayı belgelenmemiş.');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Product Brand Identity: PASS (${checks} checks / ParsYuva Aile Yaşam Merkezi / legacy data compatible).`);
