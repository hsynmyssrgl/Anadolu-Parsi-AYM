import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';

const desktopRoot = resolve(process.cwd());
const packageJson = JSON.parse(await readFile(resolve(desktopRoot, 'package.json'), 'utf8'));
const build = packageJson.build ?? {};
const expectedInstallDirectory = '$PROGRAMFILES64\\PPT\\AYM';
const artifactTemplate = build.win?.artifactName ?? build.artifactName ?? '';
const artifactChannel = /-(Bronze|Silver|Gold)-/u.exec(artifactTemplate)?.[1];
const failures = [];
const required = [
  ['build/icon.ico', 1024],
  ['build/installer-bronze-sidebar.bmp', 10000],
  ['build/installer-silver-sidebar.bmp', 10000],
  ['build/installer-gold-sidebar.bmp', 10000],
  ['build/LICENSE_TR.txt', 100],
  ['build/LICENSE_TR.rtf', 200],
  ['dist/main/main.mjs', 1000],
  ['dist/main/preload.cjs', 1000],
  ['dist/renderer/index.html', 100]
];
for (const [file, minimum] of required) {
  try {
    await access(resolve(desktopRoot, file));
    const info = await stat(resolve(desktopRoot, file));
    if (info.size < minimum) failures.push(`${file}: dosya beklenenden küçük (${info.size} bayt).`);
  } catch { failures.push(`${file}: bulunamadı.`); }
}
if (build.appId !== 'tr.anadoluparsi.aileyasammerkezi') failures.push('build.appId geçersiz.');
if (build.win?.icon !== 'build/icon.ico') failures.push('Windows simgesi tanımlı değil.');
if (build.nsis?.oneClick !== false) failures.push('NSIS yardımcı kurulum modu etkin değil.');
if (build.nsis?.allowToChangeInstallationDirectory !== false) failures.push('Kurulum dizini kullanıcı tarafından değiştirilemez olmalı.');
if (build.nsis?.perMachine !== true) failures.push('Kurulum tüm kullanıcılar için yönetici yetkisiyle yapılmalı.');
if (build.nsis?.include !== 'build/installer.nsh') failures.push('Sabit AYM kurulum dizini NSIS include dosyası bağlı değil.');
if (build.nsis?.license !== 'build/LICENSE_TR.rtf') failures.push('NSIS Unicode lisans dosyası tanımlı değil.');
if (build.nsis?.shortcutName !== 'Anadolu Parsı AYM') failures.push('Masaüstü ve Başlat menüsü kısayolu Anadolu Parsı AYM olmalı.');
if (/[çğıöşüÇĞİÖŞÜ]/u.test(artifactTemplate) || !/^[A-Za-z0-9_.$\{\}-]+$/u.test(artifactTemplate)) {
  failures.push('Kurulum dosyası adı Türkçe anlamlı ASCII karakterlerle sınırlandırılmalı.');
}
if (!artifactTemplate.startsWith('Anadolu-Parsi-Aile-Yasam-Merkezi-') || !artifactTemplate.endsWith('-Kurulum.${ext}')) {
  failures.push('Kurulum dosyası adı ürün, sürüm kanalı ve Kurulum amacını açıkça taşımalı.');
}
try {
  const installerInclude = await readFile(resolve(desktopRoot, 'build/installer.nsh'), 'utf8');
  const installerChannel = /!define PPT_INSTALLER_RELEASE_CHANNEL "(Bronze|Silver|Gold)"/u.exec(installerInclude)?.[1];
  if (!artifactChannel || !installerChannel || artifactChannel !== installerChannel) {
    failures.push(`Sürüm-paleti uyuşmazlığı: paket=${artifactChannel ?? 'yok'}, kurulum=${installerChannel ?? 'yok'}.`);
  }
  if (!installerInclude.includes('!macro customInit')
    || !installerInclude.includes(`StrCpy $INSTDIR "${expectedInstallDirectory}"`)) {
    failures.push(`NSIS varsayılan kurulum dizini ${expectedInstallDirectory} değil.`);
  }
  if (installerInclude.includes('GetDParameter')) {
    failures.push('NSIS kurulum dizini /D varsayılanıyla gölgelenemez; sabit AYM hedefi koşulsuz uygulanmalı.');
  }
  if (!installerInclude.includes('!ifndef BUILD_UNINSTALLER')) {
    failures.push('Animasyonlu kurulum sayfaları uninstaller derlemesinde dışlanmalı; kullanılmayan fonksiyon uyarıları fail-closed kalmalı.');
  }
  const requiredInstallerExperience = [
    '!macro customWelcomePage',
    '!macro customPageAfterChangeDir',
    'Function AymWelcomeAnimate',
    'Function AymReadyAnimate',
    '${NSD_CreateTimer} AymWelcomeAnimate 520',
    '${NSD_CreateTimer} AymReadyAnimate 760',
    '!define PPT_INSTALLER_RELEASE_CHANNEL "Bronze"',
    '!define MUI_FONT "Segoe UI"',
    '!define MUI_FONTSIZE 10',
    '!define PPT_INSTALLER_CHANNEL_COLOR "A5672F"',
    '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-bronze-sidebar.bmp"',
    '!define PPT_INSTALLER_CHANNEL_COLOR "718494"',
    '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-silver-sidebar.bmp"',
    '!define PPT_INSTALLER_CHANNEL_COLOR "A57E17"',
    '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-gold-sidebar.bmp"',
    '!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\\${PPT_INSTALLER_CHANNEL_BITMAP}"',
    'SetCtlColors $AymWelcomePulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"',
    'SetCtlColors $AymReadyPulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"',
    'Anadolu Parsı Aile Yaşam Merkezi',
    'Kuruluma hazır',
    'Sesli Yardım Merkezi',
    'C:\\Program Files\\PPT\\AYM',
    'CreateFont $1 "Segoe UI" 11 400',
    'CreateFont $2 "Segoe UI" 10 600',
    '!define MUI_FINISHPAGE_TITLE "Anadolu Parsı Aile Yaşam Merkezi kullanıma hazır"'
  ];
  for (const marker of requiredInstallerExperience) {
    if (!installerInclude.includes(marker)) failures.push(`NSIS animasyon/metin sözleşmesi eksik: ${marker}`);
  }
  if (/SetCtlColors \$Aym(?:Welcome|Ready)PulseLabel "\$\{PPT_INSTALLER_CHANNEL_COLOR\}" transparent/u.test(installerInclude)) {
    failures.push('Animasyonlu kurulum yazısı şeffaf arka planla üst üste çizilemez.');
  }
  const [installerOnly, uninstallerOnly = ''] = installerInclude.split('!macro customUnInstall');
  if (/https?:|Exec(?:Shell)?|nsExec|inetc|download/iu.test(installerOnly)) {
    failures.push('NSIS karşılama/animasyon kodu ağ veya haricî süreç yetkisi içeremez.');
  }
  const expectedUninstallHelper = 'ExecWait \'"$INSTDIR\\Anadolu Parsı Aile Yaşam Merkezi.exe" --uninstall-backup-assistant\' $0';
  if (!uninstallerOnly.includes(expectedUninstallHelper)) {
    failures.push('Kaldırıcı yalnız doğrulanmış yerel yedek yardımcısını tam sabit komutla çağırmalı.');
  }
  const uninstallExecutions = uninstallerOnly.match(/\bExec(?:Wait|Shell)?\b/gu) ?? [];
  if (uninstallExecutions.length !== 1 || uninstallExecutions[0] !== 'ExecWait'
    || /https?:|nsExec|inetc|download/iu.test(uninstallerOnly)) {
    failures.push('Kaldırıcı yedek yardımcısı dışında ağ veya haricî süreç yetkisi içeremez.');
  }
} catch (error) {
  failures.push(`NSIS kurulum dizini include dosyası okunamadı: ${error.message}`);
}
try {
  const builderRunner = await readFile(resolve(desktopRoot, 'scripts/run-electron-builder.mjs'), 'utf8');
  if (!builderRunner.includes("['--win', 'dir', '--config.forceCodeSigning=false']")
    || !builderRunner.includes("['--win', 'nsis']")) {
    failures.push('İmzasız dizin provası ile imzalı NSIS release yolları kesin ayrılmamış.');
  }
} catch (error) {
  failures.push(`Electron builder çalıştırıcısı okunamadı: ${error.message}`);
}
try {
  const sourceLicense = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.txt'), 'utf8');
  const expectedRtf = renderLicenseRtf(sourceLicense);
  const licenseBytes = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.rtf'));
  if ([...licenseBytes].some((byte) => byte > 0x7f)) {
    failures.push('NSIS lisans RTF dosyası ASCII dışı ham bayt içeriyor.');
  }
  const actualRtf = licenseBytes.toString('ascii').replace(/\r\n/g, '\n').trim();
  if (actualRtf !== expectedRtf) {
    failures.push('NSIS lisans RTF dosyası UTF-8 lisans kaynağıyla eşleşmiyor.');
  }
} catch (error) {
  failures.push(`NSIS lisans kodlama doğrulaması çalışmadı: ${error.message}`);
}
if (failures.length) {
  console.error('Windows installer ön doğrulaması başarısız:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Windows installer ön doğrulaması başarılı: ${packageJson.version}`);
