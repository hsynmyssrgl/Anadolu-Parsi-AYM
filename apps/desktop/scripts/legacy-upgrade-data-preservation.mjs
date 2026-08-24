export const LEGACY_DATA_PROMPT_VERSIONS = Object.freeze([
  '22.8.2026-37',
  '22.8.2026-38',
  '22.8.2026-39',
  '22.8.2026-40',
  '22.8.2026-41',
  '22.8.2026-42',
  '22.8.2026-43',
  '22.8.2026-44'
]);

const legacyUpgradeExec = '    ExecWait \'"$uninstallerFileNameTemp" /S /KEEP_APP_DATA $0 _?=$installationDir\' $R0';
const legacyUpgradeAnchor = `  OneMoreAttempt:\n${legacyUpgradeExec}`;

export function applyLegacyUpgradeDataPreservation(upstreamInstallUtil) {
  if (upstreamInstallUtil.split(legacyUpgradeAnchor).length !== 2
    || upstreamInstallUtil.includes('PARSYUVA_LEGACY_DATA_PROMPT_BYPASS')) {
    throw new Error('The installed electron-builder legacy-upgrade template drifted from the reviewed 26.15.6 shape.');
  }
  const versionConditions = LEGACY_DATA_PROMPT_VERSIONS.map(
    (version, index) => `    ${index === 0 ? '${if}' : '${orIf}'} $R4 == "${version}"`
  );
  const guardedLegacyUpgrade = [
    '  OneMoreAttempt:',
    '    ; PARSYUVA_LEGACY_DATA_PROMPT_BYPASS',
    '    ; Builds 37..44 shipped a custom data-choice dialog that ignored the',
    '    ; standard /S /KEEP_APP_DATA --updated upgrade contract. For those exact',
    '    ; versions, replace only the fixed official application directory and',
    '    ; never invoke the old destructive-choice uninstaller.',
    '    !insertmacro readReg $R4 "$rootKey" "${UNINSTALL_REGISTRY_KEY}" DisplayVersion',
    ...versionConditions,
    '      ${if} $installationDir != "$PROGRAMFILES64\\PPT\\ParsYuva"',
    '        DetailPrint "Legacy ParsYuva upgrade path is unexpected; upgrade stopped without touching user data."',
    '        ClearErrors',
    '        StrCpy $R0 2',
    '        Return',
    '      ${endIf}',
    '      ${if} ${FileExists} "$installationDir\\Bronze\\*.*"',
    '      ${orIf} ${FileExists} "$installationDir\\Silver\\*.*"',
    '      ${orIf} ${FileExists} "$installationDir\\Gold\\*.*"',
    '        DetailPrint "Legacy ParsYuva root contains a release-channel directory; upgrade stopped without deleting application or user data."',
    '        ClearErrors',
    '        StrCpy $R0 2',
    '        Return',
    '      ${endIf}',
    '      DetailPrint "Replacing legacy ParsYuva application files while preserving all user data."',
    '      SetOutPath $TEMP',
    '      RMDir /r "$installationDir"',
    '      ${if} ${FileExists} "$installationDir\\*.*"',
    '        DetailPrint "Legacy ParsYuva application files could not be removed; upgrade stopped without touching user data."',
    '        ClearErrors',
    '        StrCpy $R0 2',
    '        Return',
    '      ${endIf}',
    '      ClearErrors',
    '      StrCpy $R0 0',
    '      Return',
    '    ${endIf}',
    legacyUpgradeExec
  ].join('\n');
  return upstreamInstallUtil.replace(legacyUpgradeAnchor, guardedLegacyUpgrade);
}
