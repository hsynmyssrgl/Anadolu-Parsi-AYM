import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const installerUrl = new URL('../build/installer.nsh', import.meta.url);
const appUrl = new URL('../src/renderer/App.tsx', import.meta.url);
const accessibilityUrl = new URL('../src/renderer/accessibility.ts', import.meta.url);
const helpUrl = new URL('../src/renderer/NarratedHelpCenter.tsx', import.meta.url);
const stylesUrl = new URL('../src/renderer/styles.css', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);

describe('installer animation, narration and Silver help experience', () => {
  it('uses two bounded local installer animation pages and honest Turkish copy', async () => {
    const [source,rawPackage]=await Promise.all([readFile(installerUrl,'utf8'),readFile(packageUrl,'utf8')]);
    const packageJson=JSON.parse(rawPackage) as {build:{win?:{artifactName?:string};artifactName?:string;nsis?:{shortcutName?:string}}};
    for (const marker of [
      '!macro customWelcomePage','!macro customPageAfterChangeDir','Function AymWelcomeAnimate','Function AymReadyAnimate',
      '${NSD_CreateTimer} AymWelcomeAnimate 520','${NSD_CreateTimer} AymReadyAnimate 760',
      '!define MUI_FONT "Segoe UI"','!define MUI_FONTSIZE 10',
      '!define PPT_INSTALLER_RELEASE_CHANNEL "Bronze"',
      '!define PPT_INSTALLER_CHANNEL_COLOR "A5672F"',
      '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-bronze-sidebar.bmp"',
      '!define PPT_INSTALLER_CHANNEL_COLOR "718494"',
      '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-silver-sidebar.bmp"',
      '!define PPT_INSTALLER_CHANNEL_COLOR "A57E17"',
      '!define PPT_INSTALLER_CHANNEL_BITMAP "installer-gold-sidebar.bmp"',
      '!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\\${PPT_INSTALLER_CHANNEL_BITMAP}"',
      'SetCtlColors $AymWelcomePulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"',
      'SetCtlColors $AymReadyPulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"',
      'kurulum sırasında uzak bir sağlayıcıya kişisel veri göndermez','C:\\Program Files\\PPT\\AYM',
      'CreateFont $1 "Segoe UI" 11 400','CreateFont $2 "Segoe UI" 10 600',
      'Anadolu Parsı Aile Yaşam Merkezi kullanıma hazır','F1 Sesli Yardım Merkezinden yeniden dinleyebilirsiniz'
    ]) expect(source).toContain(marker);
    expect(packageJson.build.nsis?.shortcutName).toBe('Anadolu Parsı AYM');
    expect(source).not.toMatch(/SetCtlColors \$Aym(?:Welcome|Ready)PulseLabel "\$\{PPT_INSTALLER_CHANNEL_COLOR\}" transparent/u);
    const [installerSource, uninstallerSource = ''] = source.split('!macro customUnInstall');
    expect(installerSource).not.toMatch(/https?:|Exec(?:Shell)?|nsExec|inetc|download/iu);
    expect(uninstallerSource).toContain(
      'ExecWait \'"$INSTDIR\\Anadolu Parsı Aile Yaşam Merkezi.exe" --uninstall-backup-assistant\' $0'
    );
    expect(uninstallerSource.match(/\bExec(?:Wait|Shell)?\b/gu)).toEqual(['ExecWait']);
    expect(uninstallerSource).not.toMatch(/https?:|nsExec|inetc|download/iu);
    const artifactTemplate=packageJson.build.win?.artifactName??packageJson.build.artifactName??'';
    expect(artifactTemplate).toMatch(/^Anadolu-Parsi-Aile-Yasam-Merkezi-(?:Bronze|Silver|Gold)-[A-Za-z0-9_.${}-]+-Kurulum\.\$\{ext\}$/u);
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
    const [app, accessibility, styles] = await Promise.all([readFile(appUrl,'utf8'),readFile(accessibilityUrl,'utf8'),readFile(stylesUrl,'utf8')]);
    expect(accessibility).toContain('FIRST_RUN_NARRATION_STEPS');
    expect(accessibility).toContain('Kurulum sırasında aile veriniz uzak bir sağlayıcıya gönderilmez.');
    for (const marker of ['Anlatımı durdur','Daha yavaş','Güvenli kuruluma başla','Tanıtımı şimdilik geç']) expect(app).toContain(marker);
    expect(styles).toContain('@keyframes first-run-brand-breathe');
    expect(styles).toContain('data-reduce-motion="true"');
    expect(styles).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
