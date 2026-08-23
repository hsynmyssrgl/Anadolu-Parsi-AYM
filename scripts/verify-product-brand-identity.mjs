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
const artifactTemplate = desktopPackage.build?.win?.artifactName ?? desktopPackage.build?.artifactName ?? '';
const channel = /-(Bronze|Silver|Gold)-/u.exec(artifactTemplate)?.[1];
const expectedApplicationId = channel ? 'tr.anadoluparsi.aileyasammerkezi.' + channel.toLowerCase() : '';
const expectedProductName = channel ? 'ParsYuva Aile Yaşam Merkezi ' + channel : '';
const expectedExecutableName = channel ? 'ParsYuva-' + channel : '';
const expectedShortcutName = channel ? 'ParsYuva ' + channel : '';

check(meta.includes("CURRENT_BRAND_NAME = 'ParsYuva'"), 'Ana marka ParsYuva değil.');
check(meta.includes("CURRENT_PRODUCT_LONG_NAME = 'ParsYuva Aile Yaşam Merkezi'"), 'Görünür ürün tam ParsYuva Aile Yaşam Merkezi adıyla tanımlı değil.');
check(meta.includes("STABLE_APPLICATION_ID = 'tr.anadoluparsi.aileyasammerkezi'"), 'Kararlı Windows appId açıkça korunmuyor.');
check(meta.includes('STABLE_USER_DATA_DIRECTORY_NAME = LEGACY_PRODUCT_NAME'), 'Eski kullanıcı veri dizini yükseltme uyumluluğuna bağlanmamış.');
check(Boolean(channel), 'Paket sürüm kanalı kurulum dosyası adından çözülemedi.');
check(desktopPackage.build?.appId === expectedApplicationId, 'Paket appId sürüm kanalına göre yalıtılmış değil.');
check(desktopPackage.build?.productName === expectedProductName, 'Paket productName sürüm kanalına göre yalıtılmış değil.');
check(desktopPackage.build?.executableName === expectedExecutableName, 'Kurulu ana program dosyası sürüm kanalına göre yalıtılmış değil.');
check(desktopPackage.build?.nsis?.shortcutName === expectedShortcutName, 'Kısayol adı sürüm kanalına göre yalıtılmış değil.');
check(/^ParsYuva-(?:Bronze|Silver|Gold)-\d{2}\.\d{2}\.\d{4}\.\d+\.\$\{ext\}$/u.test(artifactTemplate), 'Kurulum dosyası yalnız ParsYuva, kanal ve görünür sürüm bilgisini taşımıyor.');
check(main.includes("const currentProductName = APP_META.name;"), 'Main görünen ürün adını APP_META üzerinden almıyor.');
check(main.includes("join(appDataPath, ...releaseUserDataDirectoryName(APP_META.edition).split('/'))"), 'Main kullanıcı verisini sürüm kanalına göre yalıtmıyor.');
check(installer.includes('LangString AymFinishTitle ${AYM_LANG_TURKISH} "ParsYuva Aile Yaşam Merkezi kullanıma hazır"'), 'Kurulum bitiş başlığı tam ürün adını kullanmıyor.');
check(!installer.includes('ParsYuva AYM'), 'Kurulum metninde kaldırılan ürün kısaltması bulunuyor.');
check(installer.includes('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\ParsYuva\\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"'), 'Kurulum hedefi sürüm kanalına göre yalıtılmış değil.');
check(installer.includes('$INSTDIR\\\${PPT_INSTALLER_EXECUTABLE}'), 'Kaldırıcı kanal program dosyasını kullanmıyor.');
check(installer.includes('$APPDATA\\ParsYuva\\\${PPT_INSTALLER_CHANNEL_DIRECTORY}'), 'Kaldırıcı yalnız etkin kanalın kullanıcı verisini hedeflemiyor.');
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
