[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$InstallerPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$EvidenceRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'apps\desktop\release'))
$validationRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'artifacts\validation'))

function Test-StrictDescendantPath {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Parent
  )
  $prefix = $Parent.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  return $Candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

if (-not [System.IO.Path]::IsPathFullyQualified($InstallerPath)) {
  throw 'InstallerPath must be an explicit absolute path.'
}
if (-not [System.IO.Path]::IsPathFullyQualified($EvidenceRoot)) {
  throw 'EvidenceRoot must be an explicit absolute path.'
}

$installerFullPath = [System.IO.Path]::GetFullPath($InstallerPath)
$evidenceFullPath = [System.IO.Path]::GetFullPath($EvidenceRoot)

# Refuse before creating evidence or starting a process when the exact installer is absent.
if (-not (Test-Path -LiteralPath $installerFullPath -PathType Leaf)) {
  throw "Installer does not exist; live UAT was not started: $installerFullPath"
}
if (-not (Test-StrictDescendantPath -Candidate $installerFullPath -Parent $releaseRoot)) {
  throw "InstallerPath must remain inside the governed desktop release directory: $releaseRoot"
}
if ([System.IO.Path]::GetExtension($installerFullPath) -ne '.exe') {
  throw 'InstallerPath must identify an .exe file.'
}
$installerItem = Get-Item -LiteralPath $installerFullPath
if (($installerItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw 'InstallerPath cannot be a reparse point.'
}
if (-not (Test-StrictDescendantPath -Candidate $evidenceFullPath -Parent $validationRoot)) {
  throw "EvidenceRoot must remain inside the governed validation directory: $validationRoot"
}
if (Test-Path -LiteralPath $evidenceFullPath) {
  throw "EvidenceRoot already exists; evidence is never overwritten: $evidenceFullPath"
}

$channelMatch = [regex]::Match(
  $installerItem.Name,
  '^ParsYuva-(Bronze|Silver|Gold)-\d{2}\.\d{2}\.\d{4}\.\d+\.exe$',
  [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
)
if (-not $channelMatch.Success) {
  throw "Installer filename does not match the governed channel/version format: $($installerItem.Name)"
}
$releaseChannel = $channelMatch.Groups[1].Value
$expectedInstalledRoot = "C:\Program Files\PPT\ParsYuva\$releaseChannel"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class ParsYuvaInstallerNativeLanguage {
  [DllImport("kernel32.dll")]
  public static extern ushort GetUserDefaultUILanguage();
}
'@

$systemUiLanguageId = [int][ParsYuvaInstallerNativeLanguage]::GetUserDefaultUILanguage()
$expectedNarrationLanguage = if ($systemUiLanguageId -eq 1055) { 'tr' } else { 'en' }
$runStartedAt = [System.DateTimeOffset]::UtcNow
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$screenshots = [System.Collections.Generic.List[object]]::new()
$slides = [System.Collections.Generic.List[object]]::new()
$errors = [System.Collections.Generic.List[string]]::new()
$rootProcess = $null
$installerWindow = $null
$forcedCleanup = $false
$cancelRequested = $false
$cancelConfirmationInvoked = $false
$processesExited = $false
$narration = [ordered]@{
  observed = $false
  processId = $null
  language = $null
  scriptMarker = 'aym-installer-narration.ps1'
  observedAtMs = $null
}

function Get-TreeSnapshot {
  param([Parameter(Mandatory = $true)][string]$Root)
  if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    return [ordered]@{ exists = $false; fileCount = 0; totalBytes = 0; treeSha256 = $null }
  }
  $records = [System.Collections.Generic.List[string]]::new()
  [long]$totalBytes = 0
  $files = @(Get-ChildItem -LiteralPath $Root -File -Recurse -Force | Sort-Object FullName)
  foreach ($file in $files) {
    $relativePath = [System.IO.Path]::GetRelativePath($Root, $file.FullName).Replace('\', '/')
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $records.Add("$relativePath|$($file.Length)|$hash")
    $totalBytes += $file.Length
  }
  $canonical = [System.Text.Encoding]::UTF8.GetBytes(($records -join "`n"))
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $treeHash = [System.Convert]::ToHexString($hasher.ComputeHash($canonical)).ToLowerInvariant()
  } finally {
    $hasher.Dispose()
  }
  return [ordered]@{
    exists = $true
    fileCount = $files.Count
    totalBytes = $totalBytes
    treeSha256 = $treeHash
  }
}

function Get-RelatedProcessSnapshot {
  param([Parameter(Mandatory = $true)][int]$RootProcessId)
  $all = @(Get-CimInstance Win32_Process)
  $ids = [System.Collections.Generic.HashSet[int]]::new()
  [void]$ids.Add($RootProcessId)
  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($process in $all) {
      if ($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)) {
        [void]$ids.Add([int]$process.ProcessId)
        $changed = $true
      }
    }
  }
  return @($all | Where-Object { $ids.Contains([int]$_.ProcessId) })
}

function Observe-NarrationProcess {
  if ($narration.observed) { return }
  $candidates = @(
    Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process -Filter "Name = 'pwsh.exe'" -ErrorAction SilentlyContinue
  )
  foreach ($candidate in $candidates) {
    if ($null -ne $candidate.CreationDate -and
      [System.DateTime]$candidate.CreationDate -lt $runStartedAt.UtcDateTime.AddSeconds(-1)) {
      continue
    }
    $commandLine = [string]$candidate.CommandLine
    if ($commandLine -notmatch '(?i)aym-installer-narration\.ps1') { continue }
    if ($commandLine -notmatch '(?i)-Language\s+(tr|en)(?:\s|$)') { continue }
    $narration.observed = $true
    $narration.processId = [int]$candidate.ProcessId
    $narration.language = $Matches[1].ToLowerInvariant()
    $narration.observedAtMs = $stopwatch.ElapsedMilliseconds
    return
  }
}

function Test-IsExpectedInstallerWindow {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Element,
    [Parameter(Mandatory = $true)][int]$RootProcessId
  )
  try {
    if ($Element.Current.ClassName -ne '#32770') { return $false }
    if ($Element.Current.Name -notmatch '(?i)ParsYuva.*(?:Kurulumu|Setup)') { return $false }
    $processId = [int]$Element.Current.ProcessId
    return @(Get-RelatedProcessSnapshot -RootProcessId $RootProcessId | Where-Object {
      [int]$_.ProcessId -eq $processId
    }).Count -eq 1
  } catch {
    return $false
  }
}

function Get-ExpectedInstallerWindows {
  param([Parameter(Mandatory = $true)][int]$RootProcessId)
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $matches = [System.Collections.Generic.List[System.Windows.Automation.AutomationElement]]::new()
  foreach ($window in $windows) {
    if (Test-IsExpectedInstallerWindow -Element $window -RootProcessId $RootProcessId) {
      $matches.Add($window)
    }
  }
  return @($matches)
}

function Wait-InstallerWindow {
  param(
    [Parameter(Mandatory = $true)][int]$RootProcessId,
    [int]$TimeoutSeconds = 45
  )
  $deadline = [System.DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([System.DateTimeOffset]::UtcNow -lt $deadline) {
    Observe-NarrationProcess
    $windows = @(Get-ExpectedInstallerWindows -RootProcessId $RootProcessId)
    if ($windows.Count -eq 1) { return $windows[0] }
    if ($windows.Count -gt 1) { throw 'More than one matching ParsYuva #32770 installer window was found.' }
    Start-Sleep -Milliseconds 150
  }
  throw 'The governed ParsYuva #32770 installer window did not appear within 45 seconds.'
}

function Get-VisibleElementNames {
  param([Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Window)
  $elements = $Window.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $names = [System.Collections.Generic.List[string]]::new()
  foreach ($element in $elements) {
    try {
      if (-not $element.Current.IsOffscreen -and -not [string]::IsNullOrWhiteSpace($element.Current.Name)) {
        $names.Add($element.Current.Name.Trim())
      }
    } catch {
      # Elements may disappear during the 2600 ms transition; the next poll owns the state.
    }
  }
  return @($names)
}

function Wait-VisibleInstallerText {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Window,
    [Parameter(Mandatory = $true)][string]$ExpectedText,
    [int]$TimeoutSeconds = 12
  )
  $deadline = [System.DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([System.DateTimeOffset]::UtcNow -lt $deadline) {
    Observe-NarrationProcess
    $names = @(Get-VisibleElementNames -Window $Window)
    if ($names -contains $ExpectedText) { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Expected installer text was not visible: $ExpectedText"
}

function Get-VisibleProgressBarCount {
  param([Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Window)
  $condition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::ProgressBar
  )
  $elements = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  $count = 0
  foreach ($element in $elements) {
    try { if (-not $element.Current.IsOffscreen) { $count += 1 } } catch { }
  }
  return $count
}

function Save-InstallerScreenshot {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Window,
    [Parameter(Mandatory = $true)][string]$FileName
  )
  $bounds = $Window.Current.BoundingRectangle
  $left = [int][System.Math]::Floor($bounds.Left)
  $top = [int][System.Math]::Floor($bounds.Top)
  $width = [int][System.Math]::Ceiling($bounds.Width)
  $height = [int][System.Math]::Ceiling($bounds.Height)
  if ($width -lt 320 -or $height -lt 240 -or $width -gt 4096 -or $height -gt 4096) {
    throw "Installer window bounds are unsafe for capture: ${width}x${height}."
  }
  $Window.SetFocus()
  Start-Sleep -Milliseconds 120
  $path = Join-Path $evidenceFullPath $FileName
  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($left, $top, 0, 0, [System.Drawing.Size]::new($width, $height))
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
  $file = Get-Item -LiteralPath $path
  $record = [ordered]@{
    path = [System.IO.Path]::GetRelativePath($repositoryRoot, $path).Replace('\', '/')
    sizeBytes = $file.Length
    sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    width = $width
    height = $height
  }
  $screenshots.Add($record)
  return $record
}

function Find-VisibleButton {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Root,
    [Parameter(Mandatory = $true)][string[]]$Names
  )
  $condition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
  )
  $buttons = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  foreach ($button in $buttons) {
    try {
      if (-not $button.Current.IsOffscreen -and $Names -contains $button.Current.Name.Trim()) {
        return $button
      }
    } catch { }
  }
  return $null
}

function Invoke-Button {
  param([Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Button)
  $pattern = $null
  if (-not $Button.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
    throw "Installer button does not expose InvokePattern: $($Button.Current.Name)"
  }
  ([System.Windows.Automation.InvokePattern]$pattern).Invoke()
}

function Request-SafeInstallerCancellation {
  param(
    [Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Window,
    [Parameter(Mandatory = $true)][int]$RootProcessId
  )
  $cancelButton = Find-VisibleButton -Root $Window -Names @('Vazgeç', 'İptal', 'Cancel')
  if ($null -eq $cancelButton) { throw 'The visible installer Cancel button was not found.' }
  Invoke-Button -Button $cancelButton
  $script:cancelRequested = $true
  $deadline = [System.DateTimeOffset]::UtcNow.AddSeconds(12)
  while ([System.DateTimeOffset]::UtcNow -lt $deadline) {
    $related = @(Get-RelatedProcessSnapshot -RootProcessId $RootProcessId)
    if ($related.Count -eq 0) { return }
    foreach ($dialog in @(Get-ExpectedInstallerWindows -RootProcessId $RootProcessId)) {
      $yesButton = Find-VisibleButton -Root $dialog -Names @('Evet', 'Yes')
      if ($null -ne $yesButton) {
        Invoke-Button -Button $yesButton
        $script:cancelConfirmationInvoked = $true
        return
      }
    }
    Start-Sleep -Milliseconds 150
  }
  throw 'Installer cancellation confirmation was not resolved within 12 seconds.'
}

function Wait-RelatedProcessesExit {
  param(
    [Parameter(Mandatory = $true)][int]$RootProcessId,
    [int]$TimeoutSeconds = 20
  )
  $deadline = [System.DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([System.DateTimeOffset]::UtcNow -lt $deadline) {
    Observe-NarrationProcess
    if (@(Get-RelatedProcessSnapshot -RootProcessId $RootProcessId).Count -eq 0) { return $true }
    Start-Sleep -Milliseconds 200
  }
  return $false
}

$installationBefore = Get-TreeSnapshot -Root $expectedInstalledRoot
$installerSignature = Get-AuthenticodeSignature -LiteralPath $installerFullPath
$installerIdentity = [ordered]@{
  path = [System.IO.Path]::GetRelativePath($repositoryRoot, $installerFullPath).Replace('\', '/')
  channel = $releaseChannel
  sizeBytes = $installerItem.Length
  sha256 = (Get-FileHash -LiteralPath $installerFullPath -Algorithm SHA256).Hash.ToLowerInvariant()
  fileVersion = $installerItem.VersionInfo.FileVersion
  productVersion = $installerItem.VersionInfo.ProductVersion
  authenticodeStatus = $installerSignature.Status.ToString()
  signerSubject = if ($null -ne $installerSignature.SignerCertificate) { $installerSignature.SignerCertificate.Subject } else { $null }
}

New-Item -ItemType Directory -Path $evidenceFullPath | Out-Null

try {
  $rootProcess = Start-Process -FilePath $installerFullPath -PassThru
  $installerWindow = Wait-InstallerWindow -RootProcessId $rootProcess.Id

  $slideSpecifications = @(
    [ordered]@{ id = 'family-space'; title = 'Ailenizi oluşturalım'; file = '01-family-space.png' },
    [ordered]@{ id = 'local-privacy'; title = 'Bilgileriniz bu bilgisayarda kalır'; file = '02-local-privacy.png' },
    [ordered]@{ id = 'narrated-guidance'; title = 'Rehberli ve erişilebilir bir karşılama'; file = '03-narrated-guidance.png' }
  )
  foreach ($specification in $slideSpecifications) {
    Wait-VisibleInstallerText -Window $installerWindow -ExpectedText $specification.title
    $observedAt = $stopwatch.ElapsedMilliseconds
    $progressCount = Get-VisibleProgressBarCount -Window $installerWindow
    if ($progressCount -ne 0) {
      throw "Welcome information card displayed a progress bar: $($specification.id) / $progressCount"
    }
    $capture = Save-InstallerScreenshot -Window $installerWindow -FileName $specification.file
    $slides.Add([ordered]@{
      id = $specification.id
      title = $specification.title
      observedAtMs = $observedAt
      visibleProgressBarCount = $progressCount
      screenshot = $capture.path
      screenshotSha256 = $capture.sha256
    })
  }

  for ($index = 1; $index -lt $slides.Count; $index += 1) {
    $delta = [long]$slides[$index].observedAtMs - [long]$slides[$index - 1].observedAtMs
    $slides[$index].transitionFromPreviousMs = $delta
    if ($delta -lt 1400 -or $delta -gt 5000) {
      throw "Installer information transition timing is outside the safe 2600 ms tolerance: $delta ms."
    }
  }

  Observe-NarrationProcess
  if (-not $narration.observed) {
    throw 'The installer narration PowerShell child process was not observed.'
  }
  if ($narration.language -ne $expectedNarrationLanguage) {
    throw "Installer narration language mismatch: expected=$expectedNarrationLanguage actual=$($narration.language)."
  }

  Request-SafeInstallerCancellation -Window $installerWindow -RootProcessId $rootProcess.Id
  $processesExited = Wait-RelatedProcessesExit -RootProcessId $rootProcess.Id
  if (-not $processesExited) {
    throw 'Installer process tree did not exit after safe cancellation.'
  }
} catch {
  $errors.Add($_.Exception.Message)
} finally {
  if ($null -ne $rootProcess) {
    $remaining = @(Get-RelatedProcessSnapshot -RootProcessId $rootProcess.Id)
    if ($narration.observed -and $null -ne $narration.processId) {
      $remaining += @(Get-CimInstance Win32_Process -Filter "ProcessId = $($narration.processId)" -ErrorAction SilentlyContinue)
    }
    $remainingIds = @($remaining | ForEach-Object { [int]$_.ProcessId } | Sort-Object -Unique -Descending)
    if ($remainingIds.Count -gt 0) {
      $forcedCleanup = $true
      foreach ($processId in $remainingIds) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      }
      Start-Sleep -Milliseconds 500
    }
  }
}

$installationAfter = Get-TreeSnapshot -Root $expectedInstalledRoot
$installationUnchanged = (
  $installationBefore.exists -eq $installationAfter.exists -and
  $installationBefore.fileCount -eq $installationAfter.fileCount -and
  $installationBefore.totalBytes -eq $installationAfter.totalBytes -and
  $installationBefore.treeSha256 -eq $installationAfter.treeSha256
)
if (-not $installationUnchanged) {
  $errors.Add('Installed channel payload changed during a welcome-only cancellation UAT.')
}
if ($forcedCleanup) {
  $errors.Add('Forced process cleanup was required; safe cancellation cannot be accepted.')
}

$allSlidesPresent = $slides.Count -eq 3
$noFakeProgress = $allSlidesPresent -and @($slides | Where-Object { $_.visibleProgressBarCount -ne 0 }).Count -eq 0
$status = if (
  $errors.Count -eq 0 -and
  $allSlidesPresent -and
  $noFakeProgress -and
  $screenshots.Count -eq 3 -and
  $narration.observed -and
  $narration.language -eq $expectedNarrationLanguage -and
  $cancelRequested -and
  $processesExited -and
  -not $forcedCleanup -and
  $installationUnchanged
) { 'PASS' } else { 'FAIL' }

$report = [ordered]@{
  schemaVersion = 1
  product = 'ParsYuva Aile Yaşam Merkezi'
  purpose = 'Real NSIS custom welcome transition and narration invocation UAT'
  status = $status
  startedAt = $runStartedAt.ToString('O')
  completedAt = [System.DateTimeOffset]::UtcNow.ToString('O')
  installer = $installerIdentity
  environment = [ordered]@{
    osVersion = [System.Environment]::OSVersion.VersionString
    windowsUiLanguageId = $systemUiLanguageId
    expectedNarrationLanguage = $expectedNarrationLanguage
  }
  window = [ordered]@{
    className = if ($null -ne $installerWindow) { '#32770' } else { $null }
    title = if ($null -ne $installerWindow) { try { $installerWindow.Current.Name } catch { $null } } else { $null }
    slideCount = $slides.Count
    noFakeProgress = $noFakeProgress
    slides = @($slides)
  }
  narration = $narration
  cancellation = [ordered]@{
    requested = $cancelRequested
    confirmationInvoked = $cancelConfirmationInvoked
    processTreeExited = $processesExited
    forcedCleanupRequired = $forcedCleanup
  }
  installedPayloadSafety = [ordered]@{
    path = $expectedInstalledRoot
    before = $installationBefore
    after = $installationAfter
    unchanged = $installationUnchanged
  }
  screenshots = @($screenshots)
  errors = @($errors)
}

$reportPath = Join-Path $evidenceFullPath 'windows-installer-experience-uat.json'
$temporaryReportPath = Join-Path $evidenceFullPath ".windows-installer-experience-uat.$PID.tmp"
$json = $report | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($temporaryReportPath, "$json`n", [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::Move($temporaryReportPath, $reportPath)

Write-Host "Windows installer experience UAT: $status"
Write-Host "Evidence: $reportPath"
if ($status -ne 'PASS') { exit 1 }
