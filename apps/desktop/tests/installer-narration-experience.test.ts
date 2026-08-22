import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const installerUrl = new URL('../build/installer.nsh', import.meta.url);
const installerNarrationUrl = new URL('../build/installer-narration.ps1', import.meta.url);
const extractorUrl = new URL('../build/extractAppPackage.nsh', import.meta.url);
const appUrl = new URL('../src/renderer/App.tsx', import.meta.url);
const accessibilityUrl = new URL('../src/renderer/accessibility.ts', import.meta.url);
const localizationUrl = new URL('../src/renderer/localization.tsx', import.meta.url);
const helpUrl = new URL('../src/renderer/NarratedHelpCenter.tsx', import.meta.url);
const stylesUrl = new URL('../src/renderer/styles.css', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);

describe('installer progress, narration and Silver help experience', () => {
  it('uses a transitional narrated welcome while reserving progress for real file installation', async () => {
    const [source,narration,extractor,rawPackage]=await Promise.all([readFile(installerUrl,'utf8'),readFile(installerNarrationUrl,'utf8'),readFile(extractorUrl,'utf8'),readFile(packageUrl,'utf8')]);
    const packageJson=JSON.parse(rawPackage) as {build:{executableName?:string;win?:{artifactName?:string};artifactName?:string;nsis?:{shortcutName?:string;multiLanguageInstaller?:boolean;installerLanguages?:string[]}}};
    for (const marker of [
      '!macro customWelcomePage','!macro customPageAfterChangeDir',
      '!define MUI_FONT "Segoe UI"','!define MUI_FONTSIZE 10',
      '!define PPT_INSTALLER_RELEASE_CHANNEL "Bronze"',
      '!define PPT_INSTALLER_CHANNEL_COLOR "A5672F"',
      '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-bronze-sidebar.bmp"',
      '!define PPT_INSTALLER_CHANNEL_COLOR "718494"',
      '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-silver-sidebar.bmp"',
      '!define PPT_INSTALLER_CHANNEL_COLOR "A57E17"',
      '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-gold-sidebar.bmp"',
      '!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\\${PPT_INSTALLER_CHANNEL_BITMAP}"',
      'Function AymWelcomePageCreate','Function AymWelcomePageLeave',
      'Function AymWelcomeTransition','${NSD_CreateTimer} AymWelcomeTransition 2600',
      '${NSD_KillTimer} AymWelcomeTransition','Call AymStartInstallerNarration',
      'File /oname=$PLUGINSDIR\\aym-installer-narration.ps1',
      'Page custom AymWelcomePageCreate AymWelcomePageLeave',
      '${NSD_CreateBitmap} 0 0 108u 100% ""',
      'Ailenizi oluşturalım','Bilgileriniz bu bilgisayarda kalır',
      'Rehberli ve erişilebilir bir karşılama','1 / 3 · Aile alanı',
      'kişisel veri aktarmaz','C:\\Program Files\\PPT\\ParsYuva',
      'CreateFont $1 "Segoe UI" 11 400','CreateFont $2 "Segoe UI" 10 600',
      'ParsYuva Aile Yaşam Merkezi kullanıma hazır','ParsYuva Family Life Center is ready',
      'F1 Sesli Yardım Merkezinden yeniden dinleyebilirsiniz','F1 Narrated Help Center',
      'GetDlgItem $AymInstallProgress $0 1004',
      'GetDlgItem $AymInstallStatusText $0 1006',
      'Function AymInstallPayloadStageBegin',
      'ShowWindow $AymInstallProgress ${SW_HIDE}',
      'Function AymInstallPayloadStageEnd',
      'SendMessage $AymInstallProgress ${PBM_SETPOS} 0 0',
      'ShowWindow $AymInstallProgress ${SW_SHOW}',
      '!define MUI_PAGE_CUSTOMFUNCTION_SHOW AymInstallFilesShow',
      '!define MUI_PAGE_CUSTOMFUNCTION_LEAVE AymInstallFilesLeave',
      '!define AYM_LANG_ENGLISH 1033','!define AYM_LANG_TURKISH 1055',
      'LangString AymInstallingDetail ${AYM_LANG_TURKISH} "Yükleniyor: %s"',
      'LangString AymInstallComplete ${AYM_LANG_TURKISH} "Yükleme tamamlandı: 100%"'
    ]) expect(source).toContain(marker);
    expect(source).not.toContain('!insertmacro MUI_PAGE_WELCOME');
    expect(source).not.toContain('${NSD_CreateProgressBar}');
    expect(source).not.toContain('Var AymWelcomePulseLabel');
    expect(source).not.toContain('Function AymReadyAnimate');
    expect(source).not.toContain('${NSD_CreateTimer} AymReadyAnimate');
    expect(source).not.toContain('${NSD_CreateProgressBar} 0 121u 100% 8u ""');
    expect(source).not.toContain('ParsYuva AYM');
    expect(source).not.toContain('Function AymInstallProgressTick');
    expect(source).not.toContain('${PBM_GETPOS}');
    expect(source).not.toContain('Function AymWelcomeAnimate');
    expect(source.match(/\$\{NSD_CreateTimer\}/gu)).toEqual(['${NSD_CreateTimer}']);
    expect(source.match(/\$\{NSD_KillTimer\}/gu)).toEqual(['${NSD_KillTimer}']);
    expect(narration).toContain('Add-Type -AssemblyName System.Speech');
    expect(narration).toContain('$_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female');
    expect(narration).toContain('$_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Male');
    expect(narration).toContain('$selectedVoice = if ($femaleVoice) { $femaleVoice } elseif ($maleVoice)');
    expect(narration).toContain('$synthesizer.SpeakAsync($text)');
    expect(narration).toContain('Test-Path -LiteralPath $StopFile');
    expect(narration).not.toMatch(/https?:|Invoke-WebRequest|Start-Process/iu);
    expect(extractor.match(/Nsis7z::ExtractWithDetails "\$\{FILE\}" "\$\(AymInstallingDetail\)"/gu)).toHaveLength(2);
    expect(extractor.match(/Call AymInstallPayloadStageBegin/gu)).toHaveLength(3);
    expect(extractor.match(/Call AymInstallPayloadStageEnd/gu)).toHaveLength(3);
    expect(extractor).not.toContain('Nsis7z::Extract "${FILE}"');
    expect(packageJson.build.executableName).toBe('ParsYuva');
    expect(packageJson.build.nsis?.shortcutName).toBe('ParsYuva');
    expect(packageJson.build.nsis).toMatchObject({multiLanguageInstaller:true,installerLanguages:['en_US','tr_TR']});
    const [installerSource, uninstallerSource = ''] = source.split('!macro customUnInstall');
    expect(installerSource).not.toMatch(/https?:|ExecShell|nsExec|inetc|download/iu);
    expect(installerSource.match(/\bExec\b/gu)).toHaveLength(2);
    expect(installerSource.match(/\bExec\s+'"\$SYSDIR\\WindowsPowerShell\\v1\.0\\powershell\.exe"/gu)).toHaveLength(2);
    expect(uninstallerSource).toMatch(
      /\$\{If\} \$\{isUpdated\}\r?\n\s+\$\{OrIf\} \$\{Silent\}[\s\S]*?Goto aym_uninstall_done[\s\S]*?MessageBox MB_YESNOCANCEL/u,
    );
    expect(uninstallerSource.indexOf('${If} ${isUpdated}')).toBeLessThan(
      uninstallerSource.indexOf('$(AymUninstallChoice)'),
    );
    expect(uninstallerSource).toContain(
      'ExecWait \'"$INSTDIR\\ParsYuva.exe" --uninstall-backup-assistant\' $0'
    );
    expect(uninstallerSource).toMatch(/MessageBox MB_YESNOCANCEL\|MB_ICONQUESTION [^\r\n]+ IDYES aym_uninstall_backup IDNO aym_uninstall_delete\r?\n\s+Goto aym_uninstall_cancel/u);
    expect(uninstallerSource).not.toContain('IDCANCEL aym_uninstall_cancel');
    expect(uninstallerSource.match(/\bExec(?:Wait|Shell)?\b/gu)).toEqual(['ExecWait']);
    expect(uninstallerSource).not.toMatch(/https?:|nsExec|inetc|download/iu);
    const artifactTemplate=packageJson.build.win?.artifactName??packageJson.build.artifactName??'';
    expect(artifactTemplate).toMatch(/^ParsYuva-(?:Bronze|Silver|Gold)-\d{2}\.\d{2}\.\d{4}\.\d+\.\$\{ext\}$/u);
    expect(artifactTemplate).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    const artifactChannel=/-(Bronze|Silver|Gold)-/u.exec(artifactTemplate)?.[1];
    const installerChannel=/!define PPT_INSTALLER_RELEASE_CHANNEL "(Bronze|Silver|Gold)"/u.exec(source)?.[1];
    expect(installerChannel).toBe(artifactChannel);
  });

  it('shows a real F1 help dialog without adding a competing application route', async () => {
    const [app, help] = await Promise.all([readFile(appUrl,'utf8'),readFile(helpUrl,'utf8')]);
    expect(app).toContain("event.key === 'F1'");
    expect(app).toContain('<NarratedHelpCenter activeScreenLabel={activeItem.label}');
    expect(app).toContain('aria-controls="narrated-help-dialog"');
    expect(help).toContain('id="narrated-help-dialog"');
    expect(app).not.toMatch(/active === ['"]help['"]/u);
    expect(help).toContain('Silver erişilebilirlik hazırlığı');
    expect(help).toContain('Metin her zaman görünür kalır');
    expect(help).toContain("rate === 'slow' ? 0.72 : 0.88");
  });

  it('keeps first-run narration visible, stoppable, rate-adjustable and motion-reduction aware', async () => {
    const [app, accessibility, localization, styles] = await Promise.all([readFile(appUrl,'utf8'),readFile(accessibilityUrl,'utf8'),readFile(localizationUrl,'utf8'),readFile(stylesUrl,'utf8')]);
    expect(accessibility).toContain('FIRST_RUN_NARRATION_STEPS');
    expect(accessibility).toContain('Kurulum sırasında aile veriniz uzak bir sağlayıcıya gönderilmez.');
    for (const marker of ['Anlatımı durdur','Daha yavaş','Güvenli kuruluma başla','Tanıtımı şimdilik geç']) expect(localization).toContain(marker);
    for (const marker of ['Stop narration','Slower','Start secure setup','Skip introduction for now']) expect(localization).toContain(marker);
    expect(styles).toContain('@keyframes first-run-brand-breathe');
    expect(styles).toContain('data-reduce-motion="true"');
    expect(styles).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
