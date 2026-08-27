import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const producerUrl = new URL('../../../scripts/run-windows-installed-release-uat.ps1', import.meta.url);
const installerUrl = new URL('../build/installer.nsh', import.meta.url);
const builderUrl = new URL('../scripts/run-electron-builder.mjs', import.meta.url);

describe('Windows installed release UAT contract', () => {
  it('keeps the PowerShell producer syntactically valid', () => {
    if (process.platform !== 'win32') return;
    const scriptPath = fileURLToPath(producerUrl).replaceAll("'", "''");
    const command = [
      '$tokens=$null',
      '$errors=$null',
      `[System.Management.Automation.Language.Parser]::ParseFile('${scriptPath}',[ref]$tokens,[ref]$errors)|Out-Null`,
      'if($errors.Count -gt 0){$errors|ForEach-Object{[Console]::Error.WriteLine($_.Message)};exit 1}',
    ].join(';');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8', windowsHide: true,
    });
    expect(`${result.stdout}\n${result.stderr}`).toBe('\n');
    expect(result.status).toBe(0);
  });

  it('requires all exact package, runtime, evidence and release identity inputs', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const parameter of [
      'InstallerPath',
      'PackagedExePath',
      'InstalledExePath',
      'PackageProvenance',
      'GovernedPreflight',
      'InstallerExperienceUat',
      'EvidenceRoot',
      'ExpectedReleaseId'
    ]) expect(source).toContain(`[Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$${parameter}`);
    for (const parameter of ['PreviousInstalledExePath', 'PreviousPackageProvenance']) {
      expect(source).toContain(`[Parameter()][AllowEmptyString()][string]$${parameter} = ''`);
    }
    expect(source).toContain("$package.releaseId -ceq $ExpectedReleaseId");
    expect(source).toContain("$verifiedPackage.sourceCommit");
  });

  it('fails closed before installer start when PE, package, calendar or visible release versions diverge', async () => {
    const source = await readFile(producerUrl, 'utf8');
    const firstInstallerStart = source.indexOf('$primaryProcess = Invoke-InstallerPhase $primaryClassification');
    const exactMarkers = [
      "$packageVersionMatch = [regex]::Match([string]$package.packageVersion, '^(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})-(\\d+)$')",
      '[void][DateTime]::new($packageYear, $packageMonth, $packageDay)',
      '[string]$package.packageVersion -ceq $expectedPackageVersion',
      '[string]$packagedIdentity.fileVersion -ceq [string]$package.packageVersion',
      '[string]$installerIdentity.fileVersion -ceq [string]$package.packageVersion',
      '[string]$package.version -ceq $expectedVisibleVersion',
      '[string]$package.release -ceq $expectedVisibleRelease',
      'Packaged EXE FileVersion package.packageVersion ile exact bagli degil.',
      'Installer FileVersion package.packageVersion ile exact bagli degil.',
      'Package packageVersion gecerli bir release takvim tarihi tasimiyor.',
      'Package release Bronze DD.MM.YYYY.sequence kimligiyle exact bagli degil.',
    ];
    expect(firstInstallerStart).toBeGreaterThan(-1);
    for (const marker of exactMarkers) {
      expect(source).toContain(marker);
      expect(source.indexOf(marker)).toBeLessThan(firstInstallerStart);
    }
    expect(source).not.toContain('[string]$packagedIdentity.fileVersion -eq [string]$package.packageVersion');
    expect(source).not.toContain('[string]$installerIdentity.fileVersion -eq [string]$package.packageVersion');
  });

  it('uses the exact category parent plus a generated UUID run root, holds its guard and atomically reads receipts back', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const marker of [
      'Test-ContainedPath',
      'Assert-NoReparseChain',
      'EvidenceRoot exact windows-installed-release-uat category parent olmali.',
      "$runId = [guid]::NewGuid().ToString('D')",
      'Join-Path $EvidenceCategoryParent $runId',
      'partial run recover/overwrite edilmez',
      '[IO.FileShare]::Read',
      'New-EvidenceRunGuard',
      'Assert-EvidenceRunGuard',
      'Close-EvidenceRunGuard',
      '[IO.FileMode]::CreateNew',
      '$stream.Flush($true)',
      '[IO.File]::Move($temporary, $target)',
      'Atomik makbuz readback uyusmuyor'
    ]) expect(source).toContain(marker);
    expect(source.indexOf('$script:EvidenceRunGuard = New-EvidenceRunGuard')).toBeLessThan(
      source.indexOf('$primaryProcess = Invoke-InstallerPhase $primaryClassification'),
    );
    expect(source.indexOf('Close-EvidenceRunGuard $script:EvidenceRunGuard')).toBeGreaterThan(
      source.indexOf('Get-FileSha256 $InstalledUiReceiptPath'),
    );
  });

  it('proves mutually exclusive sequence-50 bootstrap, rejected-50 sequence-51 recovery, or 52+ N to N plus one upgrade, followed by maintenance', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const marker of [
      '$isGovernedBootstrap = $newSequence -eq 50',
      '$isRecoveryBootstrap = $newSequence -eq 51',
      "'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50'",
      "'RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51'",
      "'RECOVERY_BOOTSTRAP_FRESH_INSTALL'",
      "'VERSION_UPGRADE_N_TO_N_PLUS_1'",
      "installationMode = $installationMode",
      'freshInstall = $freshInstallReceipt',
      'upgrade = $upgradeReceipt',
      'targetInstallRootAbsentBefore',
      'targetExecutableAbsentBefore',
      'bronzeUninstallRegistryAbsentBefore',
      'packagePreviousProvenanceAbsent'
    ]) expect(source).toContain(marker);
    expect(source).toContain("'SAME_VERSION_MAINTENANCE'");
    expect(source).toContain('$newSequence -eq ($oldSequence + 1)');
    expect(source.match(/Invoke-InstallerPhase/gu)?.length).toBe(3);
    expect(source).toContain('dataSelectionDialogObserved = $false');
    expect(source).toContain('installedEqualsPackaged = $true');
    expect(source).toContain('Bronze 50 governed bootstrap onceki paket/runtime girdisi kabul etmez.');
    expect(source).toContain('Bronze 51 recovery bootstrap trusted installed predecessor runtime kabul etmez.');
    expect(source).toContain('Bronze 52+ exact installed N runtime girdisi zorunludur.');
    expect(source).toContain('RECOVERY_BOOTSTRAP_AFTER_REJECTED_50');
    expect(source).toContain('REJECTED_INVALID_PACKAGE');
    expect(source).toContain('REJECTED_PARENT_HISTORY_ANCHOR_ONLY');
    expect(source).toContain('Package parentRelease canli installed N release kimligiyle uyusmuyor.');
    expect(source).toContain('Installed N runtime installer baslamadan onceki canli geri-okumada degisti.');
    expect(source).toContain('fresh-install yoklugu installer baslamadan hemen once yeniden dogrulanamadi.');
    expect(source.indexOf('Bronze fresh-install bootstrap oncesinde kanonik install root tamamen yok olmalidir.')).toBeLessThan(
      source.indexOf('$primaryProcess = Invoke-InstallerPhase $primaryClassification'),
    );
  });

  it('accepts only the canonical parent history bundle and delegates all trust checks to the JS verifier before install', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const marker of [
      '-windows-package-provenance-bundle\\bundle.json',
      'verifyPreviousWindowsPackageProvenance',
      'captureReleaseSourceProvenance',
      '--input-type=module',
      'Previous package canonical history bundle/PR-235/Git readback FAIL oldu.',
      '$verifiedPreviousPackage.packagedRuntime.sha256'
    ]) expect(source).toContain(marker);
    expect(source).not.toContain('-windows-package-provenance.json"');
    expect(source).not.toContain("Read-JsonFile $PreviousPackageProvenance 'PreviousPackageProvenance'");
    expect(source.indexOf('verifyPreviousWindowsPackageProvenance')).toBeLessThan(
      source.indexOf('$primaryProcess = Invoke-InstallerPhase $primaryClassification')
    );
  });

  it('captures metadata-only channel and legacy boundaries without recording user names or contents', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const root of [
      "bronze = 'C:\\Program Files\\PPT\\ParsYuva-Bronze'",
      "silver = 'C:\\Program Files\\PPT\\ParsYuva-Silver'",
      "gold = 'C:\\Program Files\\PPT\\ParsYuva-Gold'",
      "legacy = 'C:\\Program Files\\PPT\\ParsYuva'"
    ]) expect(source).toContain(root);
    expect(source).toContain('relativeNameHash');
    expect(source).toContain('existingUserFileContentsHashedForEquality = $true');
    expect(source).toContain('existingUserFileContentsRecorded = $false');
    expect(source).toContain('existingUserFileNamesRecorded = $false');
    expect(source).toContain('otherChannelWriteCount = 0');
    expect(source).not.toMatch(/Remove-Item\s+[^\r\n]*-Recurse|(?:^|[\s;])(?:Move|Copy)-Item/imu);
  });

  it('creates only the synthetic Bronze marker and binds the exact sibling install and registry identity', async () => {
    const source = await readFile(producerUrl, 'utf8');
    expect(source).toContain('PPT_SYNTHETIC_INSTALLATION_PRESERVATION_MARKER');
    expect(source).toContain("C:\\Program Files\\PPT\\ParsYuva-Bronze");
    expect(source).toContain('Bronze uninstall registry kaydi exact tekil degil');
    expect(source).toContain('Bronze UninstallString sibling install root ile exact bagli degil');
    expect(source).toContain('Bronze QuietUninstallString sibling install root ile exact bagli degil');
    expect(source).toContain("$expectedProductName = 'ParsYuva Aile Ya' + [char]0x015F + 'am Merkezi Bronze'");
    expect(source).toContain('$expectedDisplayName = "$expectedProductName $ExpectedVersion"');
    expect(source).toContain('$channelDisplayNamePattern = \'^ParsYuva Aile Ya\' + [char]0x015F');
    expect(source).toContain('$expectedDisplayIcon = "$CanonicalInstalledExe,0"');
    expect(source).not.toContain("$displayName -match '^ParsYuva.*Bronze$'");
    expect(source).toContain("authenticodeStatus -eq 'NotSigned'");
  });

  it('skips unrelated Windows uninstall entries whose optional properties are absent under strict mode', async () => {
    const source = await readFile(producerUrl, 'utf8');
    expect(source).toContain('function Get-OptionalPropertyString');
    expect(source).toContain('Get-Member -InputObject $Value -Name $Name -MemberType Properties');
    expect(source).toContain('Select-Object -ExpandProperty $Name -ErrorAction Stop');
    expect(source).toContain("$displayName = Get-OptionalPropertyString $value 'DisplayName'");
    expect(source).toContain("Get-OptionalPropertyString $value 'QuietUninstallString'");
    expect(source).toContain('$ordered = @($records.ToArray() | Sort-Object)');
    expect(source).not.toContain('[string]$value.DisplayName');
    expect(source).not.toContain('[string]$value.InstallLocation');
  });

  it('writes the public uninstall registry identity to the canonical channel root and application executable', async () => {
    const [installer, builder] = await Promise.all([readFile(installerUrl, 'utf8'), readFile(builderUrl, 'utf8')]);
    expect(installer).toContain('!macro customInstall');
    expect(installer).toContain('WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"');
    expect(installer).toContain('WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" "$INSTDIR\\${PPT_INSTALLER_EXECUTABLE},0"');
    expect(builder).toContain("const upstreamInstallSectionPath = resolve(upstreamTemplateRoot, 'installSection.nsh')");
    expect(builder).toContain("const upstreamInstallerIncludePath = resolve(upstreamTemplateRoot, 'include/installer.nsh')");
    expect(builder).toContain('customInstallIndex <= registryAddIndex');
    expect(builder).toContain('NSIS uninstall registry hook order drifted');
  });

  it('executes missing-property, ordered-entry and live snapshot behavior under Windows PowerShell strict mode', () => {
    if (process.platform !== 'win32') return;
    const scriptPath = fileURLToPath(producerUrl).replaceAll("'", "''");
    const command = [
      '$ErrorActionPreference="Stop"',
      'Set-StrictMode -Version Latest',
      'Import-Module "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1" -Force -ErrorAction Stop',
      `$path='${scriptPath}'`,
      '$tokens=$null',
      '$parseErrors=$null',
      '$ast=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$parseErrors)',
      'if($parseErrors.Count -gt 0){throw ($parseErrors|Out-String)}',
      '$functionText=($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$true)|ForEach-Object{$_.Extent.Text}) -join "`n"',
      '$RepoRoot=[IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $path) ".."))',
      '$ExpectedUserDataRoot=[IO.Path]::GetFullPath((Join-Path $env:APPDATA "ParsYuva"))',
      '$CanonicalInstallRoot=[IO.Path]::GetFullPath("C:\\Program Files\\PPT\\ParsYuva-Bronze")',
      '$CanonicalInstalledExe=Join-Path $CanonicalInstallRoot "ParsYuva-Bronze.exe"',
      '$RunRoot=Join-Path $env:TEMP "ParsYuva-UAT110-CONTRACT-NONEXISTENT"',
      'Invoke-Expression $functionText',
      '$missing=[pscustomobject]@{InstallLocation="ignored"}',
      'if((Get-OptionalPropertyString $missing "DisplayName") -cne ""){throw "Missing property was not normalized to empty."}',
      '$complete=[pscustomobject]@{DisplayName="ParsYuva Aile Yaşam Merkezi Bronze 26.8.2026-52";DisplayVersion="26.8.2026-52";InstallLocation=$CanonicalInstallRoot;DisplayIcon="$CanonicalInstalledExe,0";UninstallString="uninstall";QuietUninstallString="uninstall /S"}',
      'if((Get-OptionalPropertyString $complete "DisplayName") -cne $complete.DisplayName){throw "Present property readback changed."}',
      '$ordered=[ordered]@{DisplayName=$complete.DisplayName;DisplayVersion=$complete.DisplayVersion;InstallLocation=$complete.InstallLocation;DisplayIcon=$complete.DisplayIcon;UninstallString=$complete.UninstallString;QuietUninstallString=$complete.QuietUninstallString}',
      'if($ordered.DisplayVersion -cne "26.8.2026-52" -or $ordered.DisplayIcon -cne "$CanonicalInstalledExe,0"){throw "Ordered registry identity dot access failed."}',
      '$snapshot=Get-StateSnapshot "STRICT_MODE_CONTRACT"',
      'if($snapshot.uninstallRegistry.bronze.entryCount -lt 1){throw "Versioned live Bronze uninstall entry was not classified as Bronze."}',
    ].join(';');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8', windowsHide: true,
    });
    expect(`${result.stdout}\n${result.stderr}`).toBe('\n');
    expect(result.status).toBe(0);
  });

  it('writes schema-3 UAT110 then invokes the schema-3 installed frontend runner with the preservation/run binding', async () => {
    const source = await readFile(producerUrl, 'utf8');
    expect(source).toContain("windows-installed-release-uat110.json");
    expect(source).toContain("installed-frontend-user-uat111.json");
    expect(source).toContain('scripts\\run-installed-frontend-user-uat.mjs');
    for (const argument of [
      '--installed-exe',
      '--package-provenance',
      '--governed-preflight',
      '--evidence-root',
      '--expected-release-id',
      '--installation-preservation',
      '--parent-run-id',
      '--output'
    ]) expect(source).toContain(argument);
    expect(source).toContain("$installedUi.schemaVersion -eq 3");
    expect(source).toContain("PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3");
    expect(source).toContain('schemaVersion = 3');
    expect(source).toContain('installationPreservationSha256');
    expect(source).toContain('packageProvenanceSha256');
  });
});
