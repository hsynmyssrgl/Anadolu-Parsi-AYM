import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';

const desktopRoot = resolve(process.cwd());
const packageJson = JSON.parse(await readFile(resolve(desktopRoot, 'package.json'), 'utf8'));
const build = packageJson.build ?? {};
const artifactTemplate = build.win?.artifactName ?? build.artifactName ?? '';
const artifactChannel = /-(Bronze|Silver|Gold)-/u.exec(artifactTemplate)?.[1];
const expectedInstallDirectory = '$PROGRAMFILES64\\PPT\\${PPT_INSTALLER_PROGRAM_DIRECTORY}';
const expectedApplicationId = artifactChannel
  ? `tr.anadoluparsi.aileyasammerkezi.${artifactChannel.toLowerCase()}`
  : '';
const expectedExecutableName = artifactChannel ? `ParsYuva-${artifactChannel}` : '';
const expectedProductName = artifactChannel ? `ParsYuva Aile Yaşam Merkezi ${artifactChannel}` : '';
const expectedShortcutName = artifactChannel ? `ParsYuva ${artifactChannel}` : '';
const failures = [];
const required = [
  ['build/icon.ico', 1024],
  ['build/installer-bronze-sidebar.bmp', 10000],
  ['build/installer-silver-sidebar.bmp', 10000],
  ['build/installer-gold-sidebar.bmp', 10000],
  ['build/installer-narration.ps1', 1000],
  ['build/extractAppPackage.nsh', 3000],
  ['docs/LISANS_TR_KAYNAK.txt', 100],
  ['build/LICENSE_TR.rtf', 200],
  ['build/LICENSE_en.rtf', 200],
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
if (build.appId !== expectedApplicationId) failures.push('build.appId sürüm kanalına göre yalıtılmış değil.');
if (build.productName !== expectedProductName) failures.push('build.productName sürüm kanalına göre yalıtılmış değil.');
if (build.win?.icon !== 'build/icon.ico') failures.push('Windows simgesi tanımlı değil.');
if (build.nsis?.oneClick !== false) failures.push('NSIS yardımcı kurulum modu etkin değil.');
if (build.nsis?.allowToChangeInstallationDirectory !== false) failures.push('Kurulum dizini kullanıcı tarafından değiştirilemez olmalı.');
if (build.nsis?.perMachine !== true) failures.push('Kurulum tüm kullanıcılar için yönetici yetkisiyle yapılmalı.');
if (build.nsis?.include !== 'build/installer.nsh') failures.push('Sabit ParsYuva kurulum dizini NSIS include dosyası bağlı değil.');
if (build.nsis?.license !== undefined) failures.push('NSIS tek-dilli sabit lisans yolu tanımlanmamalı.');
if (build.nsis?.multiLanguageInstaller !== true
  || JSON.stringify(build.nsis?.installerLanguages) !== JSON.stringify(['en_US','tr_TR'])) {
  failures.push('NSIS sistem dili seçimi İngilizce varsayılan ve Türkçe destekli değil.');
}
if (build.executableName !== expectedExecutableName) failures.push('Kurulu ana program dosyası sürüm kanalına göre yalıtılmış değil.');
if (build.nsis?.shortcutName !== expectedShortcutName) failures.push('Kısayol sürüm kanalına göre yalıtılmış değil.');
if (/[çğıöşüÇĞİÖŞÜ]/u.test(artifactTemplate) || !/^[A-Za-z0-9_.$\{\}-]+$/u.test(artifactTemplate)) {
  failures.push('Kurulum dosyası adı Türkçe anlamlı ASCII karakterlerle sınırlandırılmalı.');
}
if (!/^ParsYuva-(?:Bronze|Silver|Gold)-\d{2}\.\d{2}\.\d{4}\.\d+\.\$\{ext\}$/u.test(artifactTemplate)) {
  failures.push('Kurulum dosyası adı yalnız ParsYuva, sürüm kanalı ve görünür sürüm numarasını taşımalı.');
}
try {
  const [installerInclude, installerNarration] = await Promise.all([
    readFile(resolve(desktopRoot, 'build/installer.nsh'), 'utf8'),
    readFile(resolve(desktopRoot, 'build/installer-narration.ps1'), 'utf8')
  ]);
  const installerChannel = /!define PPT_INSTALLER_RELEASE_CHANNEL "(Bronze|Silver|Gold)"/u.exec(installerInclude)?.[1];
  if (!artifactChannel || !installerChannel || artifactChannel !== installerChannel) {
    failures.push(`Sürüm-paleti uyuşmazlığı: paket=${artifactChannel ?? 'yok'}, kurulum=${installerChannel ?? 'yok'}.`);
  }
  if (!installerInclude.includes('!macro customInit')
    || !installerInclude.includes(`StrCpy $INSTDIR "${expectedInstallDirectory}"`)) {
    failures.push(`NSIS varsayılan kurulum dizini ${expectedInstallDirectory} değil.`);
  }
  if (installerInclude.includes('GetDParameter')) {
    failures.push('NSIS kurulum dizini /D varsayılanıyla gölgelenemez; sabit ParsYuva hedefi koşulsuz uygulanmalı.');
  }
  if (!installerInclude.includes('!ifndef BUILD_UNINSTALLER')) {
    failures.push('Animasyonlu kurulum sayfaları uninstaller derlemesinde dışlanmalı; kullanılmayan fonksiyon uyarıları fail-closed kalmalı.');
  }
  const requiredInstallerExperience = [
    '!macro customWelcomePage',
    '!macro customPageAfterChangeDir',
    `!define PPT_INSTALLER_RELEASE_CHANNEL "${artifactChannel}"`,
    '!define PPT_INSTALLER_CHANNEL_DIRECTORY "${PPT_INSTALLER_RELEASE_CHANNEL}"',
    '!define PPT_INSTALLER_PROGRAM_DIRECTORY "ParsYuva-${PPT_INSTALLER_RELEASE_CHANNEL}"',
    '!define PPT_INSTALLER_EXECUTABLE "ParsYuva-${PPT_INSTALLER_RELEASE_CHANNEL}.exe"',
    '!define MUI_FONT "Segoe UI"',
    '!define MUI_FONTSIZE 10',
    '!define PPT_INSTALLER_CHANNEL_COLOR "A5672F"',
    '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-bronze-sidebar.bmp"',
    '!define PPT_INSTALLER_CHANNEL_COLOR "718494"',
    '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-silver-sidebar.bmp"',
    '!define PPT_INSTALLER_CHANNEL_COLOR "A57E17"',
    '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-gold-sidebar.bmp"',
    '!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\\${PPT_INSTALLER_CHANNEL_BITMAP}"',
    '!define MUI_WELCOMEPAGE_TITLE_3LINES',
    '!define MUI_WELCOMEPAGE_TITLE "$(AymWelcomeTitle)"',
    '!define MUI_WELCOMEPAGE_TEXT "$(AymProductName)',
    'Page custom AymWelcomePageCreate AymWelcomePageLeave',
    'nsDialogs::Create 1018',
    '${NSD_CreateBitmap} 0 0 108u 100% ""',
    'Function AymWelcomeTransition',
    '${NSD_CreateTimer} AymWelcomeTransition 2600',
    '${NSD_KillTimer} AymWelcomeTransition',
    'Call AymStartInstallerNarration',
    'File /oname=$PLUGINSDIR\\aym-installer-narration.ps1',
    'Ailenizi oluşturalım',
    'Bilgileriniz bu bilgisayarda kalır',
    'Rehberli ve erişilebilir bir karşılama',
    '1 / 3 · Aile alanı',
    'ParsYuva Aile Yaşam Merkezi',
    'Kuruluma hazır',
    'Sesli Yardım Merkezi',
    'C:\\Program Files\\PPT\\${PPT_INSTALLER_PROGRAM_DIRECTORY}',
    'CreateFont $1 "Segoe UI" 11 400',
    'CreateFont $2 "Segoe UI" 10 600',
    '!define AYM_LANG_ENGLISH 1033',
    '!define AYM_LANG_TURKISH 1055',
    'LangString AymFinishTitle ${AYM_LANG_ENGLISH} "ParsYuva Family Life Center is ready"',
    'LangString AymFinishTitle ${AYM_LANG_TURKISH} "ParsYuva Aile Yaşam Merkezi kullanıma hazır"',
    "System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'",
    'Function un.AymApplySystemUiLanguage',
    'Call un.AymApplySystemUiLanguage',
    'StrCpy $LANGUAGE ${AYM_LANG_TURKISH}',
    'StrCpy $LANGUAGE ${AYM_LANG_ENGLISH}',
    '!define MUI_FINISHPAGE_TITLE "$(AymFinishTitle)"',
    'GetDlgItem $AymInstallProgress $0 1004',
    'GetDlgItem $AymInstallStatusText $0 1006',
    'Function AymInstallPayloadStageBegin',
    'ShowWindow $AymInstallProgress ${SW_HIDE}',
    'Function AymInstallPayloadStageEnd',
    'SendMessage $AymInstallProgress ${PBM_SETPOS} 0 0',
    'ShowWindow $AymInstallProgress ${SW_SHOW}',
    '!define MUI_PAGE_CUSTOMFUNCTION_SHOW AymInstallFilesShow',
    '!define MUI_PAGE_CUSTOMFUNCTION_LEAVE AymInstallFilesLeave',
    'LangString AymInstallPreparing ${AYM_LANG_TURKISH} "Doğrulanmış kurulum paketi hazırlanıyor..."',
    'LangString AymInstallingDetail ${AYM_LANG_TURKISH} "Yükleniyor: %s"',
    'LangString AymInstallComplete ${AYM_LANG_TURKISH} "Yükleme tamamlandı: 100%"'
  ];
  for (const marker of requiredInstallerExperience) {
    if (!installerInclude.includes(marker)) failures.push(`NSIS deneyim/metin sözleşmesi eksik: ${marker}`);
  }
  if (!installerInclude.includes('RMDir /r "$APPDATA\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"')
    || installerInclude.includes('RMDir /r "$APPDATA\\Anadolu Parsı Aile Yaşam Merkezi"')) {
    failures.push('Kaldırıcı yalnız etkin sürüm kanalının kullanıcı verisini silebilmeli.');
  }
  if (installerInclude.includes('Function AymWelcomeAnimate')
    || installerInclude.includes('Function AymReadyAnimate')
    || installerInclude.includes('${NSD_CreateTimer} AymReadyAnimate')
    || installerInclude.includes('${NSD_CreateProgressBar}')) {
    failures.push('Kurulum öncesi sayfalar sahte hareketli ilerleme göstergesi kullanmamalı; tek ilerleme yerel NSIS dosya kurulum sayfası olmalı.');
  }
  if (installerInclude.includes('!insertmacro MUI_PAGE_WELCOME')
    || installerInclude.includes('Var AymWelcomePulseLabel')) {
    failures.push('Genel MUI veya eski metin-only karşılama yüzeyi özel tam sayfa ParsYuva panelinin yerine geçmemeli.');
  }
  if (installerInclude.includes('${PBM_GETPOS}')
    || installerInclude.includes('AymInstallProgressTick')) {
    failures.push('Kurulum yüzdesi ana NSIS iş parçacığındaki zamanlayıcıyla tahmin edilemez; gerçek Nsis7z ilerlemesi kullanılmalı.');
  }
  const createTimers = installerInclude.match(/\$\{NSD_CreateTimer\}[^\r\n]*/gu) ?? [];
  const killTimers = installerInclude.match(/\$\{NSD_KillTimer\}[^\r\n]*/gu) ?? [];
  if (createTimers.length !== 1 || createTimers[0]?.trim() !== '${NSD_CreateTimer} AymWelcomeTransition 2600'
    || killTimers.length !== 1 || killTimers[0]?.trim() !== '${NSD_KillTimer} AymWelcomeTransition') {
    failures.push('Kurulumda yalnız üç bilgi kartını değiştiren sabit karşılama zamanlayıcısına izin verilir.');
  }
  if (installerInclude.includes('ParsYuva AYM')) {
    failures.push('Kurulum yüzeyinde kaldırılan AYM kısaltması kullanılamaz.');
  }
  const [installerOnly, uninstallerOnly = ''] = installerInclude.split('!macro customUnInstall');
  if (/https?:|ExecShell|nsExec|inetc|download/iu.test(installerOnly)) {
    failures.push('NSIS karşılama kodu ağ veya kabuk çalıştırma yetkisi içeremez.');
  }
  const installerExecutions = installerOnly.match(/\bExec\b/gu) ?? [];
  const fixedNarrationExecutions = installerOnly.match(/\bExec\s+'"\$SYSDIR\\WindowsPowerShell\\v1\.0\\powershell\.exe"[^\r\n]+-File "\$PLUGINSDIR\\aym-installer-narration\.ps1"[^\r\n]+-StopFile "\$PLUGINSDIR\\aym-installer-narration\.stop"'/gu) ?? [];
  if (installerExecutions.length !== 2 || fixedNarrationExecutions.length !== 2) {
    failures.push('Kurulum yalnız sabit yerel PowerShell anlatım betiğini Türkçe veya İngilizce için çağırabilir.');
  }
  const narrationMarkers = [
    'Add-Type -AssemblyName System.Speech',
    '$_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female',
    '$_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Male',
    '$selectedVoice = if ($femaleVoice) { $femaleVoice } elseif ($maleVoice)',
    '$synthesizer.SpeakAsync($text)',
    'Test-Path -LiteralPath $StopFile'
  ];
  for (const marker of narrationMarkers) {
    if (!installerNarration.includes(marker)) failures.push(`Kurulum seslendirme sözleşmesi eksik: ${marker}`);
  }
  if (/https?:|Invoke-WebRequest|Start-Process/iu.test(installerNarration)) {
    failures.push('Kurulum seslendirmesi ağ veya haricî süreç kullanamaz.');
  }
  const expectedUninstallHelper = 'ExecWait \'"$INSTDIR\\${PPT_INSTALLER_EXECUTABLE}" --uninstall-backup-assistant\' $0';
  const upgradeGuardIndex = uninstallerOnly.indexOf('${If} ${isUpdated}');
  const silentGuardIndex = uninstallerOnly.indexOf('${OrIf} ${Silent}');
  const dataChoiceIndex = uninstallerOnly.indexOf('$(AymUninstallChoice)');
  const preserveJumpIndex = uninstallerOnly.indexOf('Goto aym_uninstall_done');
  const currentContextIndex = uninstallerOnly.indexOf('SetShellVarContext current');
  const allContextIndexes = [...uninstallerOnly.matchAll(/SetShellVarContext all/gu)].map((match) => match.index ?? -1);
  if (upgradeGuardIndex < 0 || silentGuardIndex < upgradeGuardIndex
    || preserveJumpIndex < silentGuardIndex || dataChoiceIndex < preserveJumpIndex) {
    failures.push('Yükseltme ve sessiz bakım eski uygulama dosyalarını kaldırırken kullanıcı verisi seçim akışını atlamalı.');
  }
  if (currentContextIndex < preserveJumpIndex || currentContextIndex > dataChoiceIndex
    || allContextIndexes.length !== 2 || allContextIndexes.some((index) => index < dataChoiceIndex)) {
    failures.push('Etkileşimli kaldırma kullanıcı AppData bağlamına geçmeli ve iptal/tamamlama çıkışlarında tüm-kullanıcılar bağlamını geri yüklemeli.');
  }
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
  const extractorOverride = await readFile(resolve(desktopRoot, 'build/extractAppPackage.nsh'), 'utf8');
  const requiredExtractorMarkers = [
    '!macro extractEmbeddedAppPackage',
    '!macro extractUsing7za FILE',
    'Call AymInstallPayloadStageBegin',
    'Call AymInstallPayloadStageEnd',
    'Nsis7z::ExtractWithDetails "${FILE}" "$(AymInstallingDetail)"'
  ];
  for (const marker of requiredExtractorMarkers) {
    if (!extractorOverride.includes(marker)) failures.push(`Gerçek NSIS ilerleme çıkarıcısı eksik: ${marker}`);
  }
  if ((extractorOverride.match(/Nsis7z::ExtractWithDetails/gu) ?? []).length !== 2
    || extractorOverride.includes('Nsis7z::Extract "${FILE}"')) {
    failures.push('Normal ve kurtarma çıkarma yollarının ikisi de gerçek yüzde/byte ayrıntısını aynı NSIS kontrolüne vermeli.');
  }
  if ((extractorOverride.match(/File \/oname=\$PLUGINSDIR\\app-/gu) ?? []).length !== 3) {
    failures.push('Yerel çıkarıcı x64, ia32 ve arm64 arşiv hazırlama sözleşmesini korumalı.');
  }
} catch (error) {
  failures.push(`Gerçek NSIS ilerleme çıkarıcısı okunamadı: ${error.message}`);
}
try {
  const [builderRunner, legacyUpgradeGuard] = await Promise.all([
    readFile(resolve(desktopRoot, 'scripts/run-electron-builder.mjs'), 'utf8'),
    readFile(resolve(desktopRoot, 'scripts/legacy-upgrade-data-preservation.mjs'), 'utf8'),
  ]);
  if (!builderRunner.includes("['--win', 'dir', '--config.forceCodeSigning=false']")
    || !builderRunner.includes("['--win', 'nsis']")
    || !builderRunner.includes("process.argv.includes('--local-unsigned')")
    || !builderRunner.includes('const localUnsignedArtifactTemplate = releaseArtifactTemplate')
    || !builderRunner.includes("'parsyuva-nsis-template-'")
    || !builderRunner.includes("nsisUtil.nsisTemplatesDir = governedRoot")
    || !builderRunner.includes("copyFile(governedExtractorPath, resolve(temporaryNsisRoot, 'include/extractAppPackage.nsh'))")
    || !builderRunner.includes('applyLegacyUpgradeDataPreservation(upstreamInstallUtil)')
    || !builderRunner.includes("writeFile(resolve(temporaryNsisRoot, 'include/installUtil.nsh'), governedInstallUtil, 'utf8')")
    || !builderRunner.includes("renderLicenseRtf(licenseSource)")
    || !legacyUpgradeGuard.includes('PARSYUVA_LEGACY_DATA_PROMPT_BYPASS')
    || !legacyUpgradeGuard.includes("'22.8.2026-37'")
    || !legacyUpgradeGuard.includes("'22.8.2026-44'")
    || !legacyUpgradeGuard.includes('DisplayVersion')
    || !legacyUpgradeGuard.includes('$installationDir != \"$PROGRAMFILES64\\\\PPT\\\\ParsYuva\"')
    || !legacyUpgradeGuard.includes('$installationDir\\\\Bronze\\\\*.*')
    || !legacyUpgradeGuard.includes('$installationDir\\\\Silver\\\\*.*')
    || !legacyUpgradeGuard.includes('$installationDir\\\\Gold\\\\*.*')
    || !legacyUpgradeGuard.includes('RMDir /r \"$installationDir\"')) {
    failures.push('İmzasız dizin provası ile imzalı NSIS release yolları kesin ayrılmamış.');
  }
} catch (error) {
  failures.push(`Electron builder çalıştırıcısı okunamadı: ${error.message}`);
}
try {
  const sourceLicense = await readFile(resolve(desktopRoot, 'docs/LISANS_TR_KAYNAK.txt'), 'utf8');
  const expectedRtf = renderLicenseRtf(sourceLicense).trim();
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
