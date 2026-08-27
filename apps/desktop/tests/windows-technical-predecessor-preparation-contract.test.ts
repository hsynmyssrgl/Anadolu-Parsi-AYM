import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const producerUrl = new URL('../../../scripts/run-windows-technical-predecessor-preparation.ps1', import.meta.url);
const packageUrl = new URL('../../../package.json', import.meta.url);

describe('Windows technical predecessor preparation contract', () => {
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
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(`${result.stdout}\n${result.stderr}`).toBe('\n');
    expect(result.status).toBe(0);
  });

  it('requires every exact package, bundle, installed runtime and release identity input', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const parameter of [
      'InstallerPath',
      'PackagedExePath',
      'InstalledExePath',
      'InstalledSourceBundle',
      'TargetPackageBundle',
      'EvidenceRoot',
      'ExpectedInstalledReleaseId',
      'ExpectedTargetReleaseId',
      'ExpectedConsumerReleaseId',
    ]) {
      expect(source).toContain(`[Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$${parameter}`);
    }
    expect(source).toContain("$ExpectedInstalledReleaseIdConstant = 'bronze-2026-08-26-r51'");
    expect(source).toContain("$ExpectedTargetReleaseIdConstant = 'bronze-2026-08-27-r52'");
    expect(source).toContain("$ExpectedConsumerReleaseIdConstant = 'bronze-2026-08-27-r53'");
  });

  it('accepts only the canonical Bronze 51 to rejected Bronze 52 preparation for Bronze 53', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const marker of [
      'bronze-26.08.2026.51-windows-package-provenance-bundle\\bundle.json',
      'bronze-27.08.2026.52-windows-package-provenance-bundle\\bundle.json',
      'ParsYuva-Bronze-27.08.2026.52.exe',
      "'Bronze 26.08.2026.51'",
      "'Bronze 27.08.2026.52'",
      "'Bronze 27.08.2026.53'",
      "$releaseLedger.current.parentRelease -ceq $ExpectedTargetRelease",
      "'REJECTED_INSTALLER_VISUAL_UAT_FAIL'",
      "'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK'",
      "rejectedCheckpoint = 'a5334c13'",
    ]) expect(source).toContain(marker);
    expect(source).toContain('$targetEntries.Count -eq 1');
    expect(source).toContain('$consumerEntries.Count -eq 1');
  });

  it('verifies both immutable history bundles through Git, PR-235 and external anchor readback before install', async () => {
    const source = await readFile(producerUrl, 'utf8');
    const installerStart = source.indexOf('$installerProcess = Invoke-SilentInstaller');
    for (const marker of [
      'captureReleaseSourceProvenance',
      'verifyWindowsPackageHistoryBundle',
      'requireEarlierCommit: true',
      'currentSource.worktreeClean -eq $true',
      '$bundleVerification.installed.packagedRuntime.sha256',
      '$bundleVerification.target.installer.sha256',
      '$bundleVerification.target.packagedRuntime.sha256',
      '$bundleVerification.target.previousPackageProvenance.releaseId',
      'Immutable Bronze 51/52 package bundle, Git, PR-235 or external-anchor verification failed.',
    ]) {
      expect(source).toContain(marker);
      expect(source.indexOf(marker)).toBeLessThan(installerStart);
    }
    expect(installerStart).toBeGreaterThan(-1);
  });

  it('fails closed unless the live Bronze 51 and target Bronze 52 bytes are exact', async () => {
    const source = await readFile(producerUrl, 'utf8');
    const installerStart = source.indexOf('$installerProcess = Invoke-SilentInstaller');
    for (const marker of [
      '$installedBefore.fileVersion -ceq $ExpectedInstalledPackageVersion',
      '$installedBefore.sha256 -ceq $bundleVerification.installed.packagedRuntime.sha256',
      '$installerBefore.fileVersion -ceq $ExpectedTargetPackageVersion',
      '$installerBefore.sha256 -ceq $bundleVerification.target.installer.sha256',
      '$packagedBefore.sha256 -ceq $bundleVerification.target.packagedRuntime.sha256',
      "$installerBefore.authenticodeStatus -ceq 'NotSigned'",
      'Installed Bronze 51 runtime changed immediately before silent installation.',
      'Assert-BindingEqual $targetBundleBefore',
    ]) {
      expect(source).toContain(marker);
      expect(source.indexOf(marker)).toBeLessThan(installerStart);
    }
  });

  it('uses only elevated silent installation and never launches the application', async () => {
    const source = await readFile(producerUrl, 'utf8');
    expect(source).toContain('Technical predecessor preparation requires an elevated Windows session.');
    expect(source).toContain("Start-Process -FilePath $InstallerPath -ArgumentList @('/S') -PassThru");
    expect(source).toContain("classification = 'TECHNICAL_PREDECESSOR_SILENT_INSTALL_ONLY'");
    expect(source).toContain("arguments = @('/S')");
    expect(source).toContain('Technical predecessor preparation displayed a data selection dialog.');
    expect(source).toContain('Technical predecessor preparation launched the ParsYuva application process.');
    expect(source).toContain('applicationProcessObserved = $applicationProcessObserved');
    expect(source).toContain('ParsYuva Bronze application was launched or remained running during technical predecessor preparation.');
    expect(source).toContain('applicationLaunchAttempted = $false');
    expect(source).not.toMatch(/Start-Process\s+-FilePath\s+\$InstalledExePath/iu);
  });

  it('hashes all AppData and channel boundaries and compares every protected scope', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const root of [
      "bronze = 'C:\\Program Files\\PPT\\ParsYuva-Bronze'",
      "silver = 'C:\\Program Files\\PPT\\ParsYuva-Silver'",
      "gold = 'C:\\Program Files\\PPT\\ParsYuva-Gold'",
      "legacy = 'C:\\Program Files\\PPT\\ParsYuva'",
      "bronze = Join-Path $ExpectedUserDataRoot 'Bronze'",
      "silver = Join-Path $ExpectedUserDataRoot 'Silver'",
      "gold = Join-Path $ExpectedUserDataRoot 'Gold'",
      'legacy = $ExpectedUserDataRoot',
    ]) expect(source).toContain(root);
    expect(source).toContain('relativeNameHash');
    expect(source).toContain('contentSha256');
    expect(source).toContain("foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.userData[$channel] $after.userData[$channel]");
    expect(source).toContain("foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.program[$channel] $after.program[$channel]");
    expect(source).toContain("foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.uninstallRegistry[$channel] $after.uninstallRegistry[$channel]");
    expect(source).toContain('existingUserFileContentsRecorded = $false');
    expect(source).toContain('existingUserFileNamesRecorded = $false');
    expect(source).toContain('relativeNamesHashed = $true');
    expect(source).not.toMatch(/Remove-Item\s+[^\r\n]*-Recurse|(?:^|[\s;])(?:Move|Copy)-Item/imu);
  });

  it('preserves and removes only the synthetic Bronze marker with final absence readback', async () => {
    const source = await readFile(producerUrl, 'utf8');
    expect(source).toContain('PPT_SYNTHETIC_TECHNICAL_PREDECESSOR_PRESERVATION_MARKER');
    expect(source).toContain('(Get-FileSha256 $markerPath) -ceq $markerIdentity.sha256');
    expect(source).toContain("cleanupStatus = 'DELETED_AND_ABSENCE_READBACK_PASS'");
    expect(source).toContain('Assert-ManifestEqual $originalState.userData[$channel] $postCleanupState.userData[$channel]');
    expect(source).toContain('Synthetic technical predecessor marker cleanup absence readback failed.');
  });

  it('writes only a guarded atomic non-delivery non-acceptance machine receipt', async () => {
    const source = await readFile(producerUrl, 'utf8');
    for (const marker of [
      "id = 'PPT-WINDOWS-TECHNICAL-PREDECESSOR-PREPARATION-V1'",
      "evidenceKind = 'WINDOWS_TECHNICAL_PREDECESSOR_PREPARATION'",
      "installationMode = 'TECHNICAL_PREDECESSOR_PREPARATION_ONLY'",
      'releaseAcceptanceClaimed = $false',
      'deliveryEligible = $false',
      'targetPackageDeliveryPassClaimed = $false',
      'interactiveInstallerUiExercised = $false',
      'doesNotReplaceInstallerExperienceUat = $true',
      'doesNotReplaceInstalledReleaseUat110 = $true',
      'doesNotReplaceInstalledFrontendUat111 = $true',
      'doesNotReplaceFinalDeliveryReceipt = $true',
      'New-EvidenceRunGuard',
      'Assert-EvidenceRunGuard',
      '[IO.FileMode]::CreateNew',
      '$stream.Flush($true)',
      '[IO.File]::Move($temporary, $target)',
      'Atomic receipt readback does not match the written bytes.',
    ]) expect(source).toContain(marker);
    expect(source.indexOf('$receiptBinding = Write-AtomicJson')).toBeGreaterThan(
      source.indexOf('Assert-ManifestEqual $originalState.userData[$channel] $postCleanupState.userData[$channel]'),
    );
  });

  it('exposes one canonical npm entry without embedding any arguments or overrides', async () => {
    const manifest = JSON.parse(await readFile(packageUrl, 'utf8')) as { scripts?: Record<string, string> };
    expect(manifest.scripts?.['prepare:windows:technical-predecessor']).toBe(
      'powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/run-windows-technical-predecessor-preparation.ps1',
    );
  });
});
