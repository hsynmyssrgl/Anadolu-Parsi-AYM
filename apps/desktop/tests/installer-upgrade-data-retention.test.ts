import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_DATA_PROMPT_VERSIONS,
  applyLegacyUpgradeDataPreservation,
} from '../scripts/legacy-upgrade-data-preservation.mjs';

const installerUrl = new URL('../build/installer.nsh', import.meta.url);
const upstreamInstallUtilUrl = new URL(
  '../../../tools/windows-packager/node_modules/app-builder-lib/templates/nsis/include/installUtil.nsh',
  import.meta.url,
);

describe('Windows installer upgrade data retention', () => {
  it('skips the destructive-choice flow in updated and silent uninstall maintenance', async () => {
    const source = await readFile(installerUrl, 'utf8');
    const uninstaller = source.split('!macro customUnInstall')[1] ?? '';
    expect(uninstaller).toMatch(
      /\$\{If\} \$\{isUpdated\}\r?\n\s+\$\{OrIf\} \$\{Silent\}[\s\S]*?Goto aym_uninstall_done[\s\S]*?MessageBox MB_YESNOCANCEL/u,
    );
  });

  it('keeps install, executable and deletion scopes isolated to the compiled release channel', async () => {
    const source = await readFile(installerUrl, 'utf8');
    expect(source).toContain('!define PPT_INSTALLER_PROGRAM_DIRECTORY "ParsYuva-${PPT_INSTALLER_RELEASE_CHANNEL}"');
    expect(source).toContain('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\${PPT_INSTALLER_PROGRAM_DIRECTORY}"');
    expect(source).not.toContain('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"');
    expect(source).toContain('ExecWait \'"$INSTDIR\\${PPT_INSTALLER_EXECUTABLE}" --uninstall-backup-assistant\' $0');
    expect(source).toContain('RMDir /r "$APPDATA\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"');
    expect(source).not.toContain('RMDir /r "$APPDATA\\Anadolu Parsı Aile Yaşam Merkezi"');
  });

  it('patches the reviewed builder template for every already-shipped affected version', async () => {
    const upstream = await readFile(upstreamInstallUtilUrl, 'utf8');
    const governed = applyLegacyUpgradeDataPreservation(upstream);
    expect(LEGACY_DATA_PROMPT_VERSIONS).toEqual([
      '22.8.2026-37', '22.8.2026-38', '22.8.2026-39', '22.8.2026-40',
      '22.8.2026-41', '22.8.2026-42', '22.8.2026-43', '22.8.2026-44',
    ]);
    expect(governed).toContain('PARSYUVA_LEGACY_DATA_PROMPT_BYPASS');
    expect(governed).toContain('!insertmacro readReg $R4 "$rootKey" "${UNINSTALL_REGISTRY_KEY}" DisplayVersion');
    expect(governed).toContain('${if} $installationDir != "$PROGRAMFILES64\\PPT\\ParsYuva"');
    for (const channel of ['Bronze', 'Silver', 'Gold']) {
      const protectedChannelDirectory = `$installationDir\\${channel}\\*.*`;
      expect(governed).toContain(protectedChannelDirectory);
      expect(governed.indexOf(protectedChannelDirectory)).toBeLessThan(governed.indexOf('RMDir /r "$installationDir"'));
    }
    expect(governed).toContain('RMDir /r "$installationDir"');
    expect(governed).not.toMatch(/RMDir \/r "\$(?:APPDATA|LOCALAPPDATA)/u);
    expect(governed.indexOf('RMDir /r "$installationDir"')).toBeLessThan(
      governed.indexOf('ExecWait \'"$uninstallerFileNameTemp" /S /KEEP_APP_DATA'),
    );
  });

  it('uses the signed-in user AppData only for interactive removal and restores shell context', async () => {
    const source = await readFile(installerUrl, 'utf8');
    const uninstaller = source.split('!macro customUnInstall')[1] ?? '';
    const preserveJump = uninstaller.indexOf('Goto aym_uninstall_done');
    const currentContext = uninstaller.indexOf('SetShellVarContext current');
    const choice = uninstaller.indexOf('$(AymUninstallChoice)');
    expect(currentContext).toBeGreaterThan(preserveJump);
    expect(currentContext).toBeLessThan(choice);
    expect(uninstaller.match(/SetShellVarContext all/gu)).toHaveLength(2);
    expect(uninstaller).toMatch(/aym_uninstall_cancel:\r?\n\s+\$\{If\} \$installMode == "all"\r?\n\s+SetShellVarContext all[\s\S]*?Abort/u);
    expect(uninstaller).toMatch(/aym_uninstall_done:\r?\n\s+\$\{If\} \$installMode == "all"\r?\n\s+SetShellVarContext all/u);
  });

  it('fails closed when the reviewed upstream insertion point drifts', () => {
    expect(() => applyLegacyUpgradeDataPreservation('unexpected template')).toThrow(
      'legacy-upgrade template drifted',
    );
  });
});
