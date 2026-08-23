import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uatScriptUrl = new URL('../../../scripts/run-windows-installer-experience-uat.ps1', import.meta.url);

describe('real Windows NSIS installer experience UAT contract', () => {
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

  it('requires exact governed paths and refuses missing or pre-existing targets before launch', async () => {
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
    expect(source).toContain('EvidenceRoot already exists; evidence is never overwritten');
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
      "captureMode = 'PRINT_WINDOW_TARGET_ONLY'",
      'titleBeforeCapture',
      'titleAfterCapture',
      'PrintWindow returned a blank or single-color installer capture.',
      'Welcome-only screenshot unexpectedly contains a visible input field.',
      'Get-DotNetFileSha256 -Path $path',
      'aym-installer-narration\\.ps1',
      '-Language\\s+(tr|en)',
      'GetUserDefaultUILanguage',
      '$narration.language -ne $expectedNarrationLanguage',
    ]) expect(source).toContain(marker);
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
      'Get-TreeSnapshot -Root $expectedInstalledRoot',
      'Stop-Process -Id $identity.ProcessId -Force',
      "'windows-installer-experience-uat.json'",
      '[System.IO.File]::Move($temporaryReportPath, $reportPath)',
      "if ($status -ne 'PASS') { exit 1 }",
    ]) expect(source).toContain(marker);
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
