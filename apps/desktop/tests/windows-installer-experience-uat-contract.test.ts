import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uatScriptUrl = new URL('../../../scripts/run-windows-installer-experience-uat.ps1', import.meta.url);

describe('real Windows NSIS installer experience UAT contract', () => {
  it('stays UTF-8 BOM encoded for Windows PowerShell 5.1 Turkish text compatibility', async () => {
    const bytes = await readFile(uatScriptUrl);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('keeps the PowerShell helper syntactically valid', () => {
    if (process.platform !== 'win32') return;
    const scriptPath = fileURLToPath(uatScriptUrl).replaceAll("'", "''");
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

  it('requires exact governed paths and creates a fresh UUID run root below the category parent', async () => {
    const source = await readFile(uatScriptUrl, 'utf8');
    expect(source).toContain('[Parameter(Mandatory = $true)]');
    expect(source).toContain('[string]$InstallerPath');
    expect(source).toContain('[string]$EvidenceRoot');
    expect(source).toContain('Test-IsExplicitWindowsAbsolutePath -Path $InstallerPath');
    expect(source).toContain('Test-IsExplicitWindowsAbsolutePath -Path $EvidenceRoot');
    expect(source).not.toContain('[System.IO.Path]::IsPathFullyQualified');
    expect(source).not.toContain('[System.Convert]::ToHexString');
    expect(source).toContain("'apps\\desktop\\release'");
    expect(source).toContain("'artifacts\\validation'");
    expect(source).toContain('Installer does not exist; live UAT was not started');
    expect(source).toContain("Join-Path $validationRoot 'installer-experience'");
    expect(source).toContain("$runId = [guid]::NewGuid().ToString('D')");
    expect(source).toContain('Join-Path $evidenceCategoryParent $runId');
    expect(source).toContain('EvidenceRoot must be the exact installer-experience category parent');
    expect(source).toContain('partial runs are never recovered or overwritten');
    expect(source).toContain('Installer UAT must run from an elevated PowerShell session; no installer was launched.');
    expect(source.indexOf('Installer UAT must run from an elevated PowerShell session')).toBeLessThan(
      source.indexOf('New-Item -ItemType Directory -Path $evidenceFullPath'),
    );
    expect(source).toContain('Wait-CurrentProcessIdentity');
    expect(source.indexOf('Installer does not exist; live UAT was not started')).toBeLessThan(
      source.indexOf('New-Item -ItemType Directory -Path $evidenceFullPath'),
    );
    expect(source.indexOf('Installer does not exist; live UAT was not started')).toBeLessThan(
      source.indexOf('Start-Process -FilePath $installerFullPath'),
    );
    expect(source).toContain('InstallerPath cannot be a reparse point.');
    expect(source).toContain('Assert-NoReparseAncestors');
    expect(source).toContain('Get-StrictRelativePath');
    expect(source).not.toContain('[System.IO.Path]::GetRelativePath');
    expect(source).toContain('Reparse points are forbidden inside the approved path boundary');
  });

  it('binds three timed #32770 screenshots, fake-progress rejection and narration language observation', async () => {
    const source = await readFile(uatScriptUrl, 'utf8');
    for (const marker of [
      'UIAutomationClient',
      "Current.ClassName -ne '#32770'",
      "'Ailenizi oluşturalım'",
      "'Bilgileriniz bu bilgisayarda kalır'",
      "'Rehberli ve erişilebilir bir karşılama'",
      "'01-family-space.png'",
      "'02-local-privacy.png'",
      "'03-narrated-guidance.png'",
      '[System.Windows.Automation.ControlType]::ProgressBar',
      'visibleProgressBarCount',
      'transitionFromPreviousMs',
      '$delta -lt 1400 -or $delta -gt 5000',
      '[ParsYuvaInstallerNativeCapture]::PrintWindow',
      '[ParsYuvaInstallerNativeCapture]::RedrawWindow',
      '[ParsYuvaInstallerNativeCapture]::UpdateWindow',
      '$redrawFlags = [uint32]0x0185',
      '$captureAttempts -lt 3',
      'Installer visual content verification exhausted 3 capture attempts:',
      "captureMode = 'PRINT_WINDOW_TARGET_ONLY'",
      'titleBeforeCapture',
      'titleAfterCapture',
      'PrintWindow returned a blank or single-color installer capture.',
      'PrintWindow title content region is visually blank:',
      'backgroundSampleCount',
      'contentContrastPixelCount',
      'contentOccupiedRows',
      'contentOccupiedColumns',
      'contentDarkPixelCount',
      'contentDarkOccupiedRows',
      'contentDarkOccupiedColumns',
      "visualContentStatus = 'PASS'",
      'visualContentVerified = $visualContentVerified',
      'Welcome-only screenshot unexpectedly contains a visible input field.',
      'Get-DotNetFileSha256 -Path $path',
      'aym-installer-narration\\.ps1',
      '-Language\\s+(tr|en)',
      'GetUserDefaultUILanguage',
      '$narration.language -ne $expectedNarrationLanguage',
    ]) expect(source).toContain(marker);
    const screenshotFunctionStart = source.indexOf('function Save-InstallerScreenshot');
    const screenshotFunctionEnd = source.indexOf('function Find-VisibleButton', screenshotFunctionStart);
    const screenshotFunction = source.slice(screenshotFunctionStart, screenshotFunctionEnd);
    const saveIndex = screenshotFunction.indexOf('$bitmap.Save($path');
    const saveGuardIndex = screenshotFunction.lastIndexOf('Assert-EvidenceRunGuard', saveIndex);
    const saveReparseIndex = screenshotFunction.lastIndexOf('Assert-NoReparseAncestors', saveIndex);
    const cleanupIndex = screenshotFunction.indexOf('Remove-Item -LiteralPath $path');
    const cleanupGuardIndex = screenshotFunction.lastIndexOf('Assert-EvidenceRunGuard', cleanupIndex);
    const cleanupReparseIndex = screenshotFunction.lastIndexOf('Assert-NoReparseAncestors', cleanupIndex);
    expect(screenshotFunctionStart).toBeGreaterThanOrEqual(0);
    expect(screenshotFunctionEnd).toBeGreaterThan(screenshotFunctionStart);
    expect(saveGuardIndex).toBeGreaterThanOrEqual(0);
    expect(saveReparseIndex).toBeGreaterThan(saveGuardIndex);
    expect(saveIndex).toBeGreaterThan(saveReparseIndex);
    expect(cleanupGuardIndex).toBeGreaterThan(saveIndex);
    expect(cleanupReparseIndex).toBeGreaterThan(cleanupGuardIndex);
    expect(cleanupIndex).toBeGreaterThan(cleanupReparseIndex);
    expect(screenshotFunction).toContain('capture cleanup was skipped');
    expect(screenshotFunction).toContain('$backgroundSampleCount -ne 8');
    expect(screenshotFunction).toContain('$contentDarkPixelCount -lt 40');
    expect(screenshotFunction).toContain('$contentDarkOccupiedRows -lt 6');
    expect(screenshotFunction).toContain('$contentDarkOccupiedColumns -lt 12');
    expect(source).not.toContain('CopyFromScreen');
    expect(source).not.toContain("'/S'");
    expect(source).not.toMatch(/https?:|Invoke-WebRequest|Start-BitsTransfer/iu);
  });

  it('cancels before installation, bounds forced cleanup and records an atomic JSON receipt', async () => {
    const source = await readFile(uatScriptUrl, 'utf8');
    for (const marker of [
      "@('Vazgeç', 'İptal', 'Cancel')",
      "@('Evet', 'Yes')",
      '[System.Windows.Automation.InvokePattern]::Pattern',
      'Installed channel payload changed during a welcome-only cancellation UAT.',
      'Forced process cleanup was required; safe cancellation cannot be accepted.',
      'forcedCleanupSucceeded',
      'forcedCleanupSurvivorProcessIds',
      'Get-TreeSnapshot -Root $expectedInstalledRoot',
      '$expectedInstalledRoot = "C:\\Program Files\\PPT\\ParsYuva-$releaseChannel"',
      'Stop-Process -Id $identity.ProcessId -Force',
      "'windows-installer-experience-uat.json'",
      '[IO.FileShare]::Read',
      'New-EvidenceRunGuard',
      'Assert-EvidenceRunGuard',
      'Close-EvidenceRunGuard',
      'Assert-NoReparseAncestors -Candidate $reportPath -Boundary $evidenceFullPath',
      '[System.IO.FileMode]::CreateNew',
      '$reportStream.Flush($true)',
      '[System.IO.File]::Move($temporaryReportPath, $reportPath)',
      'Installer experience receipt atomic readback mismatch.',
      "if ($status -ne 'PASS') { exit 1 }",
    ]) expect(source).toContain(marker);
    expect(source.indexOf('New-EvidenceRunGuard -RunRoot $evidenceFullPath')).toBeLessThan(
      source.indexOf('Start-Process -FilePath $installerFullPath'),
    );
    expect(source.indexOf('Close-EvidenceRunGuard -Guard $evidenceGuard')).toBeGreaterThan(
      source.indexOf('[System.IO.File]::ReadAllBytes($reportPath)'),
    );
    expect(source).toContain('Test-SameProcessIdentity');
    expect(source).toContain('$cancelConfirmationInvoked -and');
    expect(source).not.toMatch(/Remove-Item\s+[^\r\n]*(?:Program Files|EvidenceRoot|validationRoot)/iu);
    expect(source).not.toContain('Remove-Item -Recurse');
  });

  it('records exact installer identity without treating NotSigned as a runtime UAT failure', async () => {
    const source = await readFile(uatScriptUrl, 'utf8');
    expect(source).toContain('Get-AuthenticodeSignature -LiteralPath $installerFullPath');
    expect(source).toContain('Get-DotNetFileSha256 -Path $installerFullPath');
    expect(source).not.toContain('Get-FileHash');
    expect(source).toContain('authenticodeStatus = $installerSignature.Status.ToString()');
    expect(source).not.toMatch(/authenticodeStatus[^\r\n]+PASS/iu);
    expect(source).not.toMatch(/NotSigned[^\r\n]+PASS/iu);
  });
});
