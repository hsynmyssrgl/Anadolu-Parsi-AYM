import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const producerUrl = new URL('../../../scripts/run-windows-installed-release-uat.ps1', import.meta.url);

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
      'PreviousInstalledExePath',
      'PackageProvenance',
      'GovernedPreflight',
      'InstallerExperienceUat',
      'PreviousPackageProvenance',
      'EvidenceRoot',
      'ExpectedReleaseId'
    ]) expect(source).toContain(`[Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$${parameter}`);
    expect(source).toContain("$package.releaseId -ceq $ExpectedReleaseId");
    expect(source).toContain("$verifiedPackage.sourceCommit");
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
      source.indexOf("Invoke-InstallerPhase 'VERSION_UPGRADE_N_TO_N_PLUS_1'"),
    );
    expect(source.indexOf('Close-EvidenceRunGuard $script:EvidenceRunGuard')).toBeGreaterThan(
      source.indexOf('Get-FileSha256 $InstalledUiReceiptPath'),
    );
  });

  it('proves N to N plus one upgrade and a distinct same-version maintenance phase', async () => {
    const source = await readFile(producerUrl, 'utf8');
    expect(source).toContain("'VERSION_UPGRADE_N_TO_N_PLUS_1'");
    expect(source).toContain("'SAME_VERSION_MAINTENANCE'");
    expect(source).toContain('$newSequence -eq ($oldSequence + 1)');
    expect(source.match(/Invoke-InstallerPhase/gu)?.length).toBe(3);
    expect(source).toContain('dataSelectionDialogObserved = $false');
    expect(source).toContain('installedEqualsPackaged = $true');
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
      source.indexOf("Invoke-InstallerPhase 'VERSION_UPGRADE_N_TO_N_PLUS_1'")
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
    expect(source).toContain('Bronze UninstallString sibling install root ile bagli degil');
    expect(source).toContain("authenticodeStatus -eq 'NotSigned'");
  });

  it('writes schema-2 UAT110 then invokes the schema-3 installed frontend runner with the preservation/run binding', async () => {
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
    expect(source).toContain("PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V2");
    expect(source).toContain('installationPreservationSha256');
    expect(source).toContain('packageProvenanceSha256');
  });
});
