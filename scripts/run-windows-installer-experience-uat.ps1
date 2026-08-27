[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$InstallerPath,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$EvidenceRoot,

  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PackageProvenance,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$GovernedPreflight,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedReleaseId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'apps\desktop\release'))
$validationRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'artifacts\validation'))
$canonicalEvidenceCategoryParent = [System.IO.Path]::GetFullPath((Join-Path $validationRoot 'installer-experience'))
$packageVerifierPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot 'scripts\verify-windows-package-provenance.mjs'))
$producerPath = [System.IO.Path]::GetFullPath($PSCommandPath)

function Test-StrictDescendantPath {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Parent
  )
  $prefix = $Parent.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  return $Candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-IsExplicitWindowsAbsolutePath {
  param([Parameter(Mandatory = $true)][string]$Path)
  return $Path -match '^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))'
}

function Convert-BytesToLowerHex {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  return ([System.BitConverter]::ToString($Bytes)).Replace('-', '').ToLowerInvariant()
}

function Get-DotNetFileSha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try { return Convert-BytesToLowerHex -Bytes ($hasher.ComputeHash($stream)) }
  finally { $hasher.Dispose(); $stream.Dispose() }
}

function Get-StrictRelativePath {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Parent
  )
  $candidateFullPath = [System.IO.Path]::GetFullPath($Candidate)
  $parentFullPath = [System.IO.Path]::GetFullPath($Parent).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  if ($candidateFullPath.Equals($parentFullPath, [System.StringComparison]::OrdinalIgnoreCase)) { return '.' }
  if (-not (Test-StrictDescendantPath -Candidate $candidateFullPath -Parent $parentFullPath)) {
    throw "Relative path escapes its approved parent: $candidateFullPath"
  }
  return $candidateFullPath.Substring($parentFullPath.Length).TrimStart(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
}

function Assert-NoReparseAncestors {
  param(
    [Parameter(Mandatory = $true)][string]$Candidate,
    [Parameter(Mandatory = $true)][string]$Boundary
  )
  $boundaryFullPath = [System.IO.Path]::GetFullPath($Boundary)
  $candidateFullPath = [System.IO.Path]::GetFullPath($Candidate)
  if ($candidateFullPath -ne $boundaryFullPath -and
    -not (Test-StrictDescendantPath -Candidate $candidateFullPath -Parent $boundaryFullPath)) {
    throw "Path escapes the approved boundary: $candidateFullPath"
  }
  $relativePath = Get-StrictRelativePath -Candidate $candidateFullPath -Parent $boundaryFullPath
  $currentPath = $boundaryFullPath
  $segments = if ($relativePath -eq '.') { @() } else { @($relativePath -split '[\\/]') }
  foreach ($segment in @('.') + $segments) {
    if ($segment -ne '.') { $currentPath = Join-Path $currentPath $segment }
    if (-not (Test-Path -LiteralPath $currentPath)) { break }
    $item = Get-Item -LiteralPath $currentPath -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Reparse points are forbidden inside the approved path boundary: $currentPath"
    }
  }
}

function Assert-EvidenceRunGuard {
  param(
    [Parameter(Mandatory = $true)]$Guard,
    [Parameter(Mandatory = $true)][string]$RunRoot,
    [Parameter(Mandatory = $true)][string]$Boundary
  )
  Assert-NoReparseAncestors -Candidate $RunRoot -Boundary $Boundary
  $item = Get-Item -LiteralPath $Guard.Path -Force
  if ($item.PSIsContainer -or (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'Evidence run guard is not a regular non-reparse file.'
  }
  $Guard.Stream.Flush($true)
  $position = $Guard.Stream.Position
  $Guard.Stream.Position = 0
  $readback = [byte[]]::new($Guard.Bytes.Length)
  $offset = 0
  while ($offset -lt $readback.Length) {
    $count = $Guard.Stream.Read($readback, $offset, $readback.Length - $offset)
    if ($count -eq 0) { break }
    $offset += $count
  }
  $Guard.Stream.Position = $position
  if ($offset -ne $Guard.Bytes.Length -or
      [Convert]::ToBase64String($readback) -cne [Convert]::ToBase64String($Guard.Bytes)) {
    throw 'Evidence run guard readback changed.'
  }
}

function New-EvidenceRunGuard {
  param(
    [Parameter(Mandatory = $true)][string]$RunRoot,
    [Parameter(Mandatory = $true)][string]$Boundary
  )
  Assert-NoReparseAncestors -Candidate $RunRoot -Boundary $Boundary
  $guardPath = Join-Path $RunRoot '.ppt-evidence-run.guard'
  $guardBytes = [Text.UTF8Encoding]::new($false).GetBytes("PPT-EXCLUSIVE-EVIDENCE-RUN-ROOT-GUARD-V1|$PID|$([guid]::NewGuid().ToString('D'))`n")
  $guardStream = [IO.File]::Open($guardPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::Read)
  $guardStream.Write($guardBytes, 0, $guardBytes.Length)
  $guardStream.Flush($true)
  $guard = [pscustomobject]@{ Path = $guardPath; Bytes = $guardBytes; Stream = $guardStream }
  Assert-EvidenceRunGuard -Guard $guard -RunRoot $RunRoot -Boundary $Boundary
  return $guard
}

function Close-EvidenceRunGuard {
  param(
    [Parameter(Mandatory = $true)]$Guard,
    [Parameter(Mandatory = $true)][string]$RunRoot,
    [Parameter(Mandatory = $true)][string]$Boundary
  )
  Assert-EvidenceRunGuard -Guard $Guard -RunRoot $RunRoot -Boundary $Boundary
  $Guard.Stream.Dispose()
  Remove-Item -LiteralPath $Guard.Path -Force
  if (Test-Path -LiteralPath $Guard.Path) { throw 'Evidence run guard cleanup absence readback failed.' }
}

if (-not (Test-IsExplicitWindowsAbsolutePath -Path $InstallerPath)) {
  throw 'InstallerPath must be an explicit absolute path.'
}
if (-not (Test-IsExplicitWindowsAbsolutePath -Path $EvidenceRoot)) {
  throw 'EvidenceRoot must be an explicit absolute path.'
}

$installerFullPath = [System.IO.Path]::GetFullPath($InstallerPath)
$evidenceCategoryParent = [System.IO.Path]::GetFullPath($EvidenceRoot)
$runId = [guid]::NewGuid().ToString('D')
$evidenceFullPath = [System.IO.Path]::GetFullPath((Join-Path $evidenceCategoryParent $runId))
$packageFullPath = [System.IO.Path]::GetFullPath($PackageProvenance)
$preflightFullPath = [System.IO.Path]::GetFullPath($GovernedPreflight)

# Refuse before creating evidence or starting a process when the exact installer is absent.
if (-not (Test-Path -LiteralPath $installerFullPath -PathType Leaf)) {
  throw "Installer does not exist; live UAT was not started: $installerFullPath"
}
if (-not (Test-StrictDescendantPath -Candidate $installerFullPath -Parent $releaseRoot)) {
  throw "InstallerPath must remain inside the governed desktop release directory: $releaseRoot"
}
Assert-NoReparseAncestors -Candidate $installerFullPath -Boundary $releaseRoot
if ([System.IO.Path]::GetExtension($installerFullPath) -ne '.exe') {
  throw 'InstallerPath must identify an .exe file.'
}
$installerItem = Get-Item -LiteralPath $installerFullPath
if (($installerItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw 'InstallerPath cannot be a reparse point.'
}
if (-not $evidenceCategoryParent.Equals($canonicalEvidenceCategoryParent, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "EvidenceRoot must be the exact installer-experience category parent: $canonicalEvidenceCategoryParent"
}
Assert-NoReparseAncestors -Candidate $evidenceCategoryParent -Boundary $validationRoot
Assert-NoReparseAncestors -Candidate $evidenceFullPath -Boundary $validationRoot
if (Test-Path -LiteralPath $evidenceFullPath) {
  throw "Generated UUID evidence run root already exists; partial runs are never recovered or overwritten: $evidenceFullPath"
}
foreach ($bindingPath in @($packageFullPath, $preflightFullPath)) {
  if (-not (Test-StrictDescendantPath -Candidate $bindingPath -Parent $validationRoot)) { throw "Evidence binding must remain under validation: $bindingPath" }
  Assert-NoReparseAncestors -Candidate $bindingPath -Boundary $validationRoot
}
if (-not $packageFullPath.Equals((Join-Path $validationRoot 'windows-package-provenance.json'), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'PackageProvenance must use the canonical fixed validation path.' }
if (-not $preflightFullPath.Equals((Join-Path $validationRoot 'governed-preflight.json'), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'GovernedPreflight must use the canonical fixed validation path.' }
$verifiedPackageJson = & (Get-Command node -ErrorAction Stop).Source $packageVerifierPath --package-provenance $packageFullPath --governed-preflight $preflightFullPath --expected-release-id $ExpectedReleaseId
if ($LASTEXITCODE -ne 0) { throw 'Installer experience package provenance schema2/PR-235 live verification failed.' }
$verifiedPackage = $verifiedPackageJson | ConvertFrom-Json
if ($verifiedPackage.status -ne 'PASS') { throw 'Installer experience package provenance verification did not PASS.' }

$runnerIsAdministrator = ([Security.Principal.WindowsPrincipal]::new(
  [Security.Principal.WindowsIdentity]::GetCurrent()
)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $runnerIsAdministrator) {
  throw 'Installer UAT must run from an elevated PowerShell session; no installer was launched.'
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
$expectedInstalledRoot = "C:\Program Files\PPT\ParsYuva-$releaseChannel"
if ($releaseChannel -ne 'Bronze') { throw 'Installer experience final-delivery UAT currently accepts only the Bronze channel.' }
$expectedApplicationVersion = ([string]$verifiedPackage.release).Substring('Bronze '.Length)
$expectedInstallerPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "ParsYuva-Bronze-$expectedApplicationVersion.exe"))
if (-not $installerFullPath.Equals($expectedInstallerPath, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'InstallerPath is not the canonical exact-release Bronze installer.' }
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class ParsYuvaInstallerNativeLanguage {
  [DllImport("kernel32.dll")]
  public static extern ushort GetUserDefaultUILanguage();
}
public static class ParsYuvaInstallerNativeCapture {
  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool PrintWindow(System.IntPtr hwnd, System.IntPtr hdcBlt, uint flags);
  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool RedrawWindow(System.IntPtr hwnd, System.IntPtr updateRect, System.IntPtr updateRegion, uint flags);
  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool UpdateWindow(System.IntPtr hwnd);
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
$forcedCleanupSucceeded = $null
$forcedCleanupSurvivorProcessIds = @()
$cancelRequested = $false
$cancelConfirmationInvoked = $false
$processesExited = $false
$rootProcessIdentity = $null
$ownedProcessIdentities = @{}
$narration = [ordered]@{
  observed = $false
  processId = $null
  language = $null
  scriptMarker = 'aym-installer-narration.ps1'
  observedAtMs = $null
  parentProcessId = $null
  creationTimeUtc = $null
  executablePath = $null
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
    $relativePath = (Get-StrictRelativePath -Candidate $file.FullName -Parent $Root).Replace('\', '/')
    $hash = Get-DotNetFileSha256 -Path $file.FullName
    $records.Add("$relativePath|$($file.Length)|$hash")
    $totalBytes += $file.Length
  }
  $canonical = [System.Text.Encoding]::UTF8.GetBytes(($records -join "`n"))
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $treeHash = Convert-BytesToLowerHex -Bytes ($hasher.ComputeHash($canonical))
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

function ConvertTo-ProcessIdentity {
  param([Parameter(Mandatory = $true)]$Process)
  $creationTimeUtc = if ($null -ne $Process.CreationDate) {
    ([System.DateTime]$Process.CreationDate).ToUniversalTime()
  } else { $null }
  if ($null -eq $creationTimeUtc) { return $null }
  $executablePath = if ([string]::IsNullOrWhiteSpace([string]$Process.ExecutablePath)) { $null } else {
    [System.IO.Path]::GetFullPath([string]$Process.ExecutablePath)
  }
  return [pscustomobject]@{
    ProcessId = [int]$Process.ProcessId
    ParentProcessId = [int]$Process.ParentProcessId
    Name = [string]$Process.Name
    ExecutablePath = $executablePath
    CommandLine = [string]$Process.CommandLine
    CreationTimeUtc = $creationTimeUtc
    IdentityKey = "$([int]$Process.ProcessId)|$($creationTimeUtc.Ticks)"
  }
}

function Test-SameProcessIdentity {
  param(
    [Parameter(Mandatory = $true)]$Expected,
    [Parameter(Mandatory = $true)]$Actual
  )
  if ($Expected.IdentityKey -ne $Actual.IdentityKey -or
    -not $Expected.Name.Equals($Actual.Name, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
  if ($null -ne $Expected.ExecutablePath -and $null -ne $Actual.ExecutablePath -and
    -not $Expected.ExecutablePath.Equals($Actual.ExecutablePath, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
  return $true
}

function Get-CurrentProcessIdentity {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if ($null -eq $process) { return $null }
  return ConvertTo-ProcessIdentity -Process $process
}

function Wait-CurrentProcessIdentity {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [int]$TimeoutSeconds = 10
  )
  $deadline = [System.DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([System.DateTimeOffset]::UtcNow -lt $deadline) {
    $identity = Get-CurrentProcessIdentity -ProcessId $ProcessId
    if ($null -ne $identity -and $null -ne $identity.ExecutablePath) { return $identity }
    Start-Sleep -Milliseconds 100
  }
  return $null
}

function Get-RelatedProcessSnapshot {
  param([Parameter(Mandatory = $true)][int]$RootProcessId)
  if ($null -eq $script:rootProcessIdentity) { return @() }
  $all = @(Get-CimInstance Win32_Process)
  $byId = @{}
  foreach ($process in $all) { $byId[[int]$process.ProcessId] = $process }
  if (-not $byId.ContainsKey($RootProcessId)) { return @() }
  $currentRoot = ConvertTo-ProcessIdentity -Process $byId[$RootProcessId]
  if ($null -eq $currentRoot -or -not (Test-SameProcessIdentity -Expected $script:rootProcessIdentity -Actual $currentRoot)) {
    return @()
  }
  $accepted = @{}
  $accepted[$RootProcessId] = $currentRoot
  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($process in $all) {
      $processId = [int]$process.ProcessId
      $parentProcessId = [int]$process.ParentProcessId
      if ($accepted.ContainsKey($processId) -or -not $accepted.ContainsKey($parentProcessId)) { continue }
      $identity = ConvertTo-ProcessIdentity -Process $process
      if ($null -eq $identity -or $identity.CreationTimeUtc -lt $accepted[$parentProcessId].CreationTimeUtc) { continue }
      $accepted[$processId] = $identity
      $changed = $true
    }
  }
  foreach ($identity in $accepted.Values) { $script:ownedProcessIdentities[$identity.IdentityKey] = $identity }
  return @($accepted.Values)
}

function Observe-NarrationProcess {
  param([Parameter(Mandatory = $true)][int]$RootProcessId)
  if ($narration.observed) { return }
  $candidates = @(Get-RelatedProcessSnapshot -RootProcessId $RootProcessId | Where-Object {
    $_.Name -in @('powershell.exe', 'pwsh.exe')
  })
  foreach ($candidate in $candidates) {
    $commandLine = [string]$candidate.CommandLine
    if ($commandLine -notmatch '(?i)aym-installer-narration\.ps1') { continue }
    if ($commandLine -notmatch '(?i)-Language\s+(tr|en)(?:\s|$)') { continue }
    $narration.observed = $true
    $narration.processId = [int]$candidate.ProcessId
    $narration.language = $Matches[1].ToLowerInvariant()
    $narration.observedAtMs = $stopwatch.ElapsedMilliseconds
    $narration.parentProcessId = $candidate.ParentProcessId
    $narration.creationTimeUtc = $candidate.CreationTimeUtc.ToString('O')
    $narration.executablePath = $candidate.ExecutablePath
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
    Observe-NarrationProcess -RootProcessId $RootProcessId
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
    Observe-NarrationProcess -RootProcessId $script:rootProcessIdentity.ProcessId
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
    [Parameter(Mandatory = $true)][string]$FileName,
    [Parameter(Mandatory = $true)][string]$ExpectedTitle,
    [Parameter(Mandatory = $true)][string[]]$AllSlideTitles
  )
  $windowProcessId = [int]$Window.Current.ProcessId
  $windowProcessIdentity = @(Get-RelatedProcessSnapshot -RootProcessId $script:rootProcessIdentity.ProcessId | Where-Object {
    $_.ProcessId -eq $windowProcessId
  }) | Select-Object -First 1
  if ($null -eq $windowProcessIdentity) { throw 'Installer screenshot window is outside the governed process tree.' }
  $sensitiveInputCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Edit
  )
  $visibleSensitiveInputs = @($Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $sensitiveInputCondition) | Where-Object {
    try { -not $_.Current.IsOffscreen } catch { $false }
  })
  if ($visibleSensitiveInputs.Count -ne 0) { throw 'Welcome-only screenshot unexpectedly contains a visible input field.' }
  $bounds = $Window.Current.BoundingRectangle
  $left = [int][System.Math]::Floor($bounds.Left)
  $top = [int][System.Math]::Floor($bounds.Top)
  $width = [int][System.Math]::Ceiling($bounds.Width)
  $height = [int][System.Math]::Ceiling($bounds.Height)
  if ($width -lt 320 -or $height -lt 240 -or $width -gt 4096 -or $height -gt 4096) {
    throw "Installer window bounds are unsafe for capture: ${width}x${height}."
  }
  $nativeWindowHandle = [int]$Window.Current.NativeWindowHandle
  if ($nativeWindowHandle -eq 0) { throw 'Installer window has no native handle for target-only capture.' }
  $path = Join-Path $evidenceFullPath $FileName
  $printWindowFlags = [uint32]2
  $redrawFlags = [uint32]0x0185 # RDW_INVALIDATE | RDW_ERASE | RDW_ALLCHILDREN | RDW_UPDATENOW
  $captureAttempts = 0
  $captured = $false
  $lastVisualFailure = 'capture was not attempted'
  $visibleTitlesBefore = @()
  $visibleTitlesAfter = @()
  $contentContrastPixelCount = 0
  $contentOccupiedRows = 0
  $contentOccupiedColumns = 0
  $backgroundSampleCount = 0
  $contentDarkPixelCount = 0
  $contentDarkOccupiedRows = 0
  $contentDarkOccupiedColumns = 0
  $contentRegion = $null
  while (-not $captured -and $captureAttempts -lt 3) {
    $captureAttempts += 1
    $bitmap = $null
    $graphics = $null
    $deviceContext = [System.IntPtr]::Zero
    try {
      Assert-EvidenceRunGuard -Guard $evidenceGuard -RunRoot $evidenceFullPath -Boundary $validationRoot
      Assert-NoReparseAncestors -Candidate $path -Boundary $evidenceFullPath
      if (-not [ParsYuvaInstallerNativeCapture]::RedrawWindow(
          [System.IntPtr]::new($nativeWindowHandle), [System.IntPtr]::Zero, [System.IntPtr]::Zero, $redrawFlags)) {
        throw 'Installer window and child controls could not be redrawn before target-only capture.'
      }
      [void][ParsYuvaInstallerNativeCapture]::UpdateWindow([System.IntPtr]::new($nativeWindowHandle))
      Start-Sleep -Milliseconds 120

      $visibleNamesBefore = @(Get-VisibleElementNames -Window $Window)
      $visibleTitlesBefore = @($AllSlideTitles | Where-Object { $visibleNamesBefore -contains $_ })
      if ($visibleTitlesBefore.Count -ne 1 -or $visibleTitlesBefore[0] -ne $ExpectedTitle) {
        throw "Installer slide identity changed during redraw stabilization: $ExpectedTitle"
      }
      $titleCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty,
        $ExpectedTitle
      )
      $visibleTitleElements = @($Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $titleCondition) | Where-Object {
        try { -not $_.Current.IsOffscreen } catch { $false }
      })
      if ($visibleTitleElements.Count -ne 1) {
        throw "Installer expected title does not resolve to one visible UIA element: $ExpectedTitle"
      }
      $titleBounds = $visibleTitleElements[0].Current.BoundingRectangle
      $regionLeft = [int][System.Math]::Max(0, [System.Math]::Floor($titleBounds.Left - $bounds.Left - 8))
      $regionTop = [int][System.Math]::Max(0, [System.Math]::Floor($titleBounds.Top - $bounds.Top - 6))
      $regionRight = [int][System.Math]::Min($width, [System.Math]::Ceiling($titleBounds.Right - $bounds.Left + 8))
      $regionBottom = [int][System.Math]::Min($height, [System.Math]::Ceiling($titleBounds.Bottom - $bounds.Top + 6))
      if ($regionRight - $regionLeft -lt 24 -or $regionBottom - $regionTop -lt 12) {
        throw "Installer expected title has an unsafe visual content region: $ExpectedTitle"
      }
      $contentRegion = [ordered]@{
        left = $regionLeft
        top = $regionTop
        width = $regionRight - $regionLeft
        height = $regionBottom - $regionTop
      }

      $bitmap = [System.Drawing.Bitmap]::new($width, $height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $deviceContext = $graphics.GetHdc()
      if (-not [ParsYuvaInstallerNativeCapture]::PrintWindow(
          [System.IntPtr]::new($nativeWindowHandle), $deviceContext, $printWindowFlags)) {
        throw 'PrintWindow failed; target-only installer evidence was not captured.'
      }
      $graphics.ReleaseHdc($deviceContext)
      $deviceContext = [System.IntPtr]::Zero

      $sampleColors = [System.Collections.Generic.HashSet[int]]::new()
      $sampleStepX = [System.Math]::Max(1, [int]($width / 12))
      $sampleStepY = [System.Math]::Max(1, [int]($height / 10))
      for ($x = 0; $x -lt $width; $x += $sampleStepX) {
        for ($y = 0; $y -lt $height; $y += $sampleStepY) {
          [void]$sampleColors.Add($bitmap.GetPixel($x, $y).ToArgb())
        }
      }
      if ($sampleColors.Count -lt 4) { throw 'PrintWindow returned a blank or single-color installer capture.' }

      $sampleLeft = $regionLeft
      $sampleCenterX = [int][System.Math]::Floor(($regionLeft + $regionRight - 1) / 2)
      $sampleRight = $regionRight - 1
      $sampleTop = $regionTop
      $sampleCenterY = [int][System.Math]::Floor(($regionTop + $regionBottom - 1) / 2)
      $sampleBottom = $regionBottom - 1
      $backgroundSamplePoints = @(
        [ordered]@{ x = $sampleLeft; y = $sampleTop },
        [ordered]@{ x = $sampleCenterX; y = $sampleTop },
        [ordered]@{ x = $sampleRight; y = $sampleTop },
        [ordered]@{ x = $sampleLeft; y = $sampleCenterY },
        [ordered]@{ x = $sampleRight; y = $sampleCenterY },
        [ordered]@{ x = $sampleLeft; y = $sampleBottom },
        [ordered]@{ x = $sampleCenterX; y = $sampleBottom },
        [ordered]@{ x = $sampleRight; y = $sampleBottom }
      )
      $backgroundReds = [System.Collections.Generic.List[int]]::new()
      $backgroundGreens = [System.Collections.Generic.List[int]]::new()
      $backgroundBlues = [System.Collections.Generic.List[int]]::new()
      foreach ($samplePoint in $backgroundSamplePoints) {
        $sampleColor = $bitmap.GetPixel([int]$samplePoint.x, [int]$samplePoint.y)
        $backgroundReds.Add([int]$sampleColor.R)
        $backgroundGreens.Add([int]$sampleColor.G)
        $backgroundBlues.Add([int]$sampleColor.B)
      }
      $backgroundSampleCount = $backgroundSamplePoints.Count
      $medianIndex = [int][System.Math]::Floor($backgroundSampleCount / 2)
      $sortedReds = @($backgroundReds | Sort-Object)
      $sortedGreens = @($backgroundGreens | Sort-Object)
      $sortedBlues = @($backgroundBlues | Sort-Object)
      $backgroundColor = [System.Drawing.Color]::FromArgb(
        [int]$sortedReds[$medianIndex],
        [int]$sortedGreens[$medianIndex],
        [int]$sortedBlues[$medianIndex]
      )
      $occupiedRows = [System.Collections.Generic.HashSet[int]]::new()
      $occupiedColumns = [System.Collections.Generic.HashSet[int]]::new()
      $darkOccupiedRows = [System.Collections.Generic.HashSet[int]]::new()
      $darkOccupiedColumns = [System.Collections.Generic.HashSet[int]]::new()
      $contentContrastPixelCount = 0
      $contentDarkPixelCount = 0
      for ($x = $regionLeft; $x -lt $regionRight; $x += 1) {
        for ($y = $regionTop; $y -lt $regionBottom; $y += 1) {
          $pixel = $bitmap.GetPixel($x, $y)
          $distance = [System.Math]::Abs([int]$pixel.R - [int]$backgroundColor.R) +
            [System.Math]::Abs([int]$pixel.G - [int]$backgroundColor.G) +
            [System.Math]::Abs([int]$pixel.B - [int]$backgroundColor.B)
          if ($distance -ge 60) {
            $contentContrastPixelCount += 1
            [void]$occupiedRows.Add($y)
            [void]$occupiedColumns.Add($x)
          }
          $luminance = [int][System.Math]::Round(
            (([int]$pixel.R * 299) + ([int]$pixel.G * 587) + ([int]$pixel.B * 114)) / 1000
          )
          if ($luminance -le 160) {
            $contentDarkPixelCount += 1
            [void]$darkOccupiedRows.Add($y)
            [void]$darkOccupiedColumns.Add($x)
          }
        }
      }
      $contentOccupiedRows = $occupiedRows.Count
      $contentOccupiedColumns = $occupiedColumns.Count
      $contentDarkOccupiedRows = $darkOccupiedRows.Count
      $contentDarkOccupiedColumns = $darkOccupiedColumns.Count
      if ($backgroundSampleCount -ne 8 -or
          $contentContrastPixelCount -lt 40 -or $contentOccupiedRows -lt 6 -or $contentOccupiedColumns -lt 12 -or
          $contentDarkPixelCount -lt 40 -or $contentDarkOccupiedRows -lt 6 -or $contentDarkOccupiedColumns -lt 12) {
        throw "PrintWindow title content region is visually blank: $ExpectedTitle / samples=$backgroundSampleCount contrastPixels=$contentContrastPixelCount contrastRows=$contentOccupiedRows contrastColumns=$contentOccupiedColumns darkPixels=$contentDarkPixelCount darkRows=$contentDarkOccupiedRows darkColumns=$contentDarkOccupiedColumns."
      }

      $visibleNamesAfter = @(Get-VisibleElementNames -Window $Window)
      $visibleTitlesAfter = @($AllSlideTitles | Where-Object { $visibleNamesAfter -contains $_ })
      if ($visibleTitlesAfter.Count -ne 1 -or $visibleTitlesAfter[0] -ne $ExpectedTitle) {
        throw "Installer slide identity changed during target-only capture: $ExpectedTitle"
      }
      Assert-EvidenceRunGuard -Guard $evidenceGuard -RunRoot $evidenceFullPath -Boundary $validationRoot
      Assert-NoReparseAncestors -Candidate $path -Boundary $evidenceFullPath
      $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
      $captured = $true
    } catch {
      $captureFailure = $_.Exception.Message
      $lastVisualFailure = $captureFailure
      try {
        Assert-EvidenceRunGuard -Guard $evidenceGuard -RunRoot $evidenceFullPath -Boundary $validationRoot
        Assert-NoReparseAncestors -Candidate $path -Boundary $evidenceFullPath
      } catch {
        throw "Installer evidence guard changed; capture cleanup was skipped. Original capture failure: $captureFailure"
      }
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    } finally {
      if ($deviceContext -ne [System.IntPtr]::Zero -and $null -ne $graphics) { $graphics.ReleaseHdc($deviceContext) }
      if ($null -ne $graphics) { $graphics.Dispose() }
      if ($null -ne $bitmap) { $bitmap.Dispose() }
    }
    if (-not $captured) { Start-Sleep -Milliseconds 120 }
  }
  if (-not $captured) {
    throw "Installer visual content verification exhausted 3 capture attempts: $ExpectedTitle / $lastVisualFailure"
  }
  $file = Get-Item -LiteralPath $path
  $record = [ordered]@{
    path = (Get-StrictRelativePath -Candidate $path -Parent $repositoryRoot).Replace('\', '/')
    sizeBytes = $file.Length
    sha256 = Get-DotNetFileSha256 -Path $path
    width = $width
    height = $height
    expectedTitle = $ExpectedTitle
    titleBeforeCapture = $visibleTitlesBefore[0]
    titleAfterCapture = $visibleTitlesAfter[0]
    captureAttempts = $captureAttempts
    printWindowFlags = $printWindowFlags
    contentRegion = $contentRegion
    backgroundSampleCount = $backgroundSampleCount
    contentContrastPixelCount = $contentContrastPixelCount
    contentOccupiedRows = $contentOccupiedRows
    contentOccupiedColumns = $contentOccupiedColumns
    contentDarkPixelCount = $contentDarkPixelCount
    contentDarkOccupiedRows = $contentDarkOccupiedRows
    contentDarkOccupiedColumns = $contentDarkOccupiedColumns
    visualContentStatus = 'PASS'
    nativeWindowHandle = $nativeWindowHandle
    processIdentityKey = $windowProcessIdentity.IdentityKey
    captureMode = 'PRINT_WINDOW_TARGET_ONLY'
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
    if ($related.Count -eq 0) { throw 'Installer exited before cancellation confirmation was invoked.' }
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
    Observe-NarrationProcess -RootProcessId $RootProcessId
    [void](Get-RelatedProcessSnapshot -RootProcessId $RootProcessId)
    $ownedLiveCount = @($script:ownedProcessIdentities.Values | Where-Object {
      $current = Get-CurrentProcessIdentity -ProcessId $_.ProcessId
      $null -ne $current -and (Test-SameProcessIdentity -Expected $_ -Actual $current)
    }).Count
    if ($ownedLiveCount -eq 0) { return $true }
    Start-Sleep -Milliseconds 200
  }
  return $false
}

$installationBefore = Get-TreeSnapshot -Root $expectedInstalledRoot
$installerSignature = Get-AuthenticodeSignature -LiteralPath $installerFullPath
$installerIdentity = [ordered]@{
  path = (Get-StrictRelativePath -Candidate $installerFullPath -Parent $repositoryRoot).Replace('\', '/')
  channel = $releaseChannel
  sizeBytes = $installerItem.Length
  sha256 = Get-DotNetFileSha256 -Path $installerFullPath
  fileVersion = $installerItem.VersionInfo.FileVersion
  productVersion = $installerItem.VersionInfo.ProductVersion
  authenticodeStatus = $installerSignature.Status.ToString()
  signerSubject = if ($null -ne $installerSignature.SignerCertificate) { $installerSignature.SignerCertificate.Subject } else { $null }
}
$packageReceipt = Get-Content -LiteralPath $packageFullPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($packageReceipt.schemaVersion -ne 2 -or $packageReceipt.id -ne 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2' -or
    $packageReceipt.artifacts.installer.sha256 -ne $installerIdentity.sha256 -or
    [long]$packageReceipt.artifacts.installer.sizeBytes -ne [long]$installerIdentity.sizeBytes) {
  throw 'Installer experience artifact is not bound to the verified package provenance.'
}
if ([DateTimeOffset]::Parse([string]$packageReceipt.generatedAt) -ge $runStartedAt) { throw 'Installer experience UAT is not fresh after package generation.' }
$packageBinding = [ordered]@{ path = $packageFullPath; sizeBytes = (Get-Item -LiteralPath $packageFullPath).Length; sha256 = Get-DotNetFileSha256 -Path $packageFullPath }
$preflightBinding = [ordered]@{ path = $preflightFullPath; sizeBytes = (Get-Item -LiteralPath $preflightFullPath).Length; sha256 = Get-DotNetFileSha256 -Path $preflightFullPath }
$producerBinding = [ordered]@{ path = 'scripts/run-windows-installer-experience-uat.ps1'; sizeBytes = (Get-Item -LiteralPath $producerPath).Length; sha256 = Get-DotNetFileSha256 -Path $producerPath }

if (-not (Test-Path -LiteralPath $evidenceCategoryParent)) {
  New-Item -ItemType Directory -Path $evidenceCategoryParent | Out-Null
}
Assert-NoReparseAncestors -Candidate $evidenceCategoryParent -Boundary $validationRoot
New-Item -ItemType Directory -Path $evidenceFullPath | Out-Null
Assert-NoReparseAncestors -Candidate $evidenceFullPath -Boundary $validationRoot
$evidenceGuard = New-EvidenceRunGuard -RunRoot $evidenceFullPath -Boundary $validationRoot

try {
  $rootProcess = Start-Process -FilePath $installerFullPath -PassThru
  $rootProcessIdentity = Wait-CurrentProcessIdentity -ProcessId $rootProcess.Id
  if ($null -eq $rootProcessIdentity -or $null -eq $rootProcessIdentity.ExecutablePath -or
    -not $rootProcessIdentity.ExecutablePath.Equals($installerFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Installer root process identity could not be bound to the governed executable.'
  }
  $ownedProcessIdentities[$rootProcessIdentity.IdentityKey] = $rootProcessIdentity
  $installerWindow = Wait-InstallerWindow -RootProcessId $rootProcess.Id

  $slideSpecifications = @(
    [ordered]@{ id = 'family-space'; title = 'Ailenizi oluşturalım'; file = '01-family-space.png' },
    [ordered]@{ id = 'local-privacy'; title = 'Bilgileriniz bu bilgisayarda kalır'; file = '02-local-privacy.png' },
    [ordered]@{ id = 'narrated-guidance'; title = 'Rehberli ve erişilebilir bir karşılama'; file = '03-narrated-guidance.png' }
  )
  $allSlideTitles = @($slideSpecifications | ForEach-Object { $_.title })
  foreach ($specification in $slideSpecifications) {
    Wait-VisibleInstallerText -Window $installerWindow -ExpectedText $specification.title
    $observedAt = $stopwatch.ElapsedMilliseconds
    $progressCount = Get-VisibleProgressBarCount -Window $installerWindow
    if ($progressCount -ne 0) {
      throw "Welcome information card displayed a progress bar: $($specification.id) / $progressCount"
    }
    $capture = Save-InstallerScreenshot -Window $installerWindow -FileName $specification.file -ExpectedTitle $specification.title -AllSlideTitles $allSlideTitles
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

  Observe-NarrationProcess -RootProcessId $rootProcess.Id
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
    [void](Get-RelatedProcessSnapshot -RootProcessId $rootProcess.Id)
    $remaining = @($ownedProcessIdentities.Values | Where-Object {
      $current = Get-CurrentProcessIdentity -ProcessId $_.ProcessId
      $null -ne $current -and (Test-SameProcessIdentity -Expected $_ -Actual $current)
    } | Sort-Object ProcessId -Descending)
    if ($remaining.Count -gt 0) {
      $forcedCleanup = $true
      foreach ($identity in $remaining) {
        $current = Get-CurrentProcessIdentity -ProcessId $identity.ProcessId
        if ($null -ne $current -and (Test-SameProcessIdentity -Expected $identity -Actual $current)) {
          try {
            Stop-Process -Id $identity.ProcessId -Force -ErrorAction Stop
          } catch {
            $errors.Add("Forced cleanup could not stop governed process $($identity.ProcessId): $($_.Exception.Message)")
          }
        }
      }
      Start-Sleep -Milliseconds 500
      $forcedCleanupSurvivorProcessIds = @($remaining | Where-Object {
        $current = Get-CurrentProcessIdentity -ProcessId $_.ProcessId
        $null -ne $current -and (Test-SameProcessIdentity -Expected $_ -Actual $current)
      } | ForEach-Object { $_.ProcessId })
      $forcedCleanupSucceeded = $forcedCleanupSurvivorProcessIds.Count -eq 0
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
  if (-not $forcedCleanupSucceeded) {
    $errors.Add("Governed installer processes survived forced cleanup: $($forcedCleanupSurvivorProcessIds -join ', ')")
  }
}

$allSlidesPresent = $slides.Count -eq 3
$noFakeProgress = $allSlidesPresent -and @($slides | Where-Object { $_.visibleProgressBarCount -ne 0 }).Count -eq 0
$visualContentVerified = $screenshots.Count -eq 3 -and @($screenshots | Where-Object {
  $_.visualContentStatus -ne 'PASS' -or
  [int]$_.backgroundSampleCount -ne 8 -or
  [int]$_.contentContrastPixelCount -lt 40 -or
  [int]$_.contentOccupiedRows -lt 6 -or
  [int]$_.contentOccupiedColumns -lt 12 -or
  [int]$_.contentDarkPixelCount -lt 40 -or
  [int]$_.contentDarkOccupiedRows -lt 6 -or
  [int]$_.contentDarkOccupiedColumns -lt 12
}).Count -eq 0
$status = if (
  $errors.Count -eq 0 -and
  $allSlidesPresent -and
  $noFakeProgress -and
  $screenshots.Count -eq 3 -and
  $visualContentVerified -and
  $narration.observed -and
  $narration.language -eq $expectedNarrationLanguage -and
  $cancelRequested -and
  $cancelConfirmationInvoked -and
  $processesExited -and
  -not $forcedCleanup -and
  $installationUnchanged
) { 'PASS' } else { 'FAIL' }

$completedAt = [System.DateTimeOffset]::UtcNow
$report = [ordered]@{
  schemaVersion = 2
  id = 'PPT-WINDOWS-INSTALLER-EXPERIENCE-UAT-V2'
  evidenceKind = 'WINDOWS_INSTALLER_EXPERIENCE_UAT'
  product = 'ParsYuva Aile Yaşam Merkezi'
  purpose = 'Real NSIS custom welcome transition and narration invocation UAT'
  status = $status
  exitCode = if ($status -eq 'PASS') { 0 } else { 1 }
  runId = $runId
  evidenceRoot = $evidenceFullPath
  startedAt = $runStartedAt.ToString('O')
  completedAt = $completedAt.ToString('O')
  generatedAt = $completedAt.ToString('O')
  release = [string]$verifiedPackage.release
  releaseId = $ExpectedReleaseId
  sourceCommit = [string]$verifiedPackage.sourceCommit
  governedSourceFingerprintSha256 = [string]$verifiedPackage.governedSourceFingerprintSha256
  canonicalRuleRegistrySha256 = [string]$verifiedPackage.canonicalRuleRegistrySha256
  packageProvenance = $packageBinding
  governedPreflight = $preflightBinding
  producer = $producerBinding
  installer = $installerIdentity
  environment = [ordered]@{
    osVersion = [System.Environment]::OSVersion.VersionString
    windowsUiLanguageId = $systemUiLanguageId
    expectedNarrationLanguage = $expectedNarrationLanguage
    runnerIsAdministrator = $runnerIsAdministrator
    installerProcess = if ($null -ne $rootProcessIdentity) {
      [ordered]@{
        processId = $rootProcessIdentity.ProcessId
        creationTimeUtc = $rootProcessIdentity.CreationTimeUtc.ToString('O')
        executablePath = $rootProcessIdentity.ExecutablePath
      }
    } else { $null }
  }
  window = [ordered]@{
    className = if ($null -ne $installerWindow) { '#32770' } else { $null }
    title = if ($null -ne $installerWindow) { try { $installerWindow.Current.Name } catch { $null } } else { $null }
    slideCount = $slides.Count
    noFakeProgress = $noFakeProgress
    visualContentVerified = $visualContentVerified
    slides = @($slides)
  }
  narration = $narration
  cancellation = [ordered]@{
    requested = $cancelRequested
    confirmationInvoked = $cancelConfirmationInvoked
    processTreeExited = $processesExited
    forcedCleanupRequired = $forcedCleanup
    forcedCleanupSucceeded = $forcedCleanupSucceeded
    forcedCleanupSurvivorProcessIds = @($forcedCleanupSurvivorProcessIds)
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
$reportBytes = [System.Text.UTF8Encoding]::new($false).GetBytes(($report | ConvertTo-Json -Depth 12) + "`n")
Assert-EvidenceRunGuard -Guard $evidenceGuard -RunRoot $evidenceFullPath -Boundary $validationRoot
Assert-NoReparseAncestors -Candidate $reportPath -Boundary $evidenceFullPath
$reportStream = [System.IO.File]::Open($temporaryReportPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try { $reportStream.Write($reportBytes, 0, $reportBytes.Length); $reportStream.Flush($true) } finally { $reportStream.Dispose() }
[System.IO.File]::Move($temporaryReportPath, $reportPath)
Assert-EvidenceRunGuard -Guard $evidenceGuard -RunRoot $evidenceFullPath -Boundary $validationRoot
Assert-NoReparseAncestors -Candidate $reportPath -Boundary $evidenceFullPath
$reportReadback = [System.IO.File]::ReadAllBytes($reportPath)
if ($reportReadback.Length -ne $reportBytes.Length -or
    [Convert]::ToBase64String($reportReadback) -cne [Convert]::ToBase64String($reportBytes)) {
  throw 'Installer experience receipt atomic readback mismatch.'
}
Close-EvidenceRunGuard -Guard $evidenceGuard -RunRoot $evidenceFullPath -Boundary $validationRoot

Write-Host "Windows installer experience UAT: $status"
Write-Host "Evidence: $reportPath"
if ($status -ne 'PASS') { exit 1 }
