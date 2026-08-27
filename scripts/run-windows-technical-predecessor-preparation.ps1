[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerPath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PackagedExePath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstalledExePath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstalledSourceBundle,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$TargetPackageBundle,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$EvidenceRoot,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedInstalledReleaseId,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedTargetReleaseId,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedConsumerReleaseId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ValidationBase = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\windows-technical-predecessor-preparation'))
$EvidenceCategoryParent = [IO.Path]::GetFullPath($EvidenceRoot)
$RunId = [guid]::NewGuid().ToString('D')
$RunRoot = [IO.Path]::GetFullPath((Join-Path $EvidenceCategoryParent $RunId))
$ReceiptPath = [IO.Path]::GetFullPath((Join-Path $RunRoot 'windows-technical-predecessor-preparation.json'))
$ProducerPath = [IO.Path]::GetFullPath($PSCommandPath)
$CanonicalInstallRoot = [IO.Path]::GetFullPath('C:\Program Files\PPT\ParsYuva-Bronze')
$CanonicalInstalledExe = [IO.Path]::GetFullPath((Join-Path $CanonicalInstallRoot 'ParsYuva-Bronze.exe'))
$ExpectedUserDataRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'ParsYuva'))
$ExpectedInstalledRelease = 'Bronze 26.08.2026.51'
$ExpectedTargetRelease = 'Bronze 27.08.2026.52'
$ExpectedConsumerRelease = 'Bronze 27.08.2026.53'
$ExpectedInstalledPackageVersion = '26.8.2026-51'
$ExpectedTargetPackageVersion = '27.8.2026-52'
$ExpectedInstalledReleaseIdConstant = 'bronze-2026-08-26-r51'
$ExpectedTargetReleaseIdConstant = 'bronze-2026-08-27-r52'
$ExpectedConsumerReleaseIdConstant = 'bronze-2026-08-27-r53'
$ExpectedTargetInstaller = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\desktop\release\ParsYuva-Bronze-27.08.2026.52.exe'))
$ExpectedTargetPackagedExe = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\desktop\release\win-unpacked\ParsYuva-Bronze.exe'))
$ExpectedInstalledBundle = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\release-history\bronze-26.08.2026.51-windows-package-provenance-bundle\bundle.json'))
$ExpectedTargetBundle = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\release-history\bronze-27.08.2026.52-windows-package-provenance-bundle\bundle.json'))

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Get-Sha256Text([string]$Value) {
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
  }
}

function Get-FileSha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-ContainedPath([string]$Candidate, [string]$Parent) {
  $fullCandidate = [IO.Path]::GetFullPath($Candidate).TrimEnd('\')
  $fullParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\')
  return $fullCandidate.StartsWith("$fullParent\", [StringComparison]::OrdinalIgnoreCase)
}

function Get-RelativePath([string]$BasePath, [string]$TargetPath) {
  $base = [Uri]::new(([IO.Path]::GetFullPath($BasePath).TrimEnd('\') + '\'))
  $target = [Uri]::new([IO.Path]::GetFullPath($TargetPath))
  return [Uri]::UnescapeDataString($base.MakeRelativeUri($target).ToString()).Replace('/', '\')
}

function Assert-NoReparseChain([string]$Path, [bool]$LeafMayBeMissing = $false) {
  $full = [IO.Path]::GetFullPath($Path)
  if ((-not (Test-Path -LiteralPath $full)) -and (-not $LeafMayBeMissing)) {
    throw "Required path is missing: $full"
  }
  $cursor = if (Test-Path -LiteralPath $full) { $full } else { Split-Path -Parent $full }
  while ($cursor -and (Test-Path -LiteralPath $cursor)) {
    $item = Get-Item -LiteralPath $cursor -Force
    Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "Reparse/symlink path is forbidden: $cursor"
    $parent = Split-Path -Parent $cursor
    if ($parent -eq $cursor) { break }
    $cursor = $parent
  }
}

function Resolve-RegularFile([string]$Path, [string]$Label) {
  $full = [IO.Path]::GetFullPath($Path)
  Assert-NoReparseChain $full
  $item = Get-Item -LiteralPath $full -Force
  Assert-True (-not $item.PSIsContainer) "$Label is not a regular file."
  Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "$Label cannot be a reparse point."
  return $full
}

function Get-FileIdentity([string]$Path, [string]$Label) {
  $full = Resolve-RegularFile $Path $Label
  $item = Get-Item -LiteralPath $full -Force
  $signature = Get-AuthenticodeSignature -LiteralPath $full
  return [ordered]@{
    path = $full
    sizeBytes = [long]$item.Length
    sha256 = Get-FileSha256 $full
    fileVersion = [string]$item.VersionInfo.FileVersion
    productVersion = [string]$item.VersionInfo.ProductVersion
    authenticodeStatus = [string]$signature.Status
  }
}

function Get-FileBinding([string]$Path, [string]$Label) {
  $full = Resolve-RegularFile $Path $Label
  $item = Get-Item -LiteralPath $full -Force
  return [ordered]@{ path = $full; sizeBytes = [long]$item.Length; sha256 = Get-FileSha256 $full }
}

function Assert-BindingEqual($Expected, $Actual, [string]$Label) {
  Assert-True ([long]$Expected.sizeBytes -eq [long]$Actual.sizeBytes -and [string]$Expected.sha256 -ceq [string]$Actual.sha256) "$Label size/SHA-256 binding changed."
}

function Get-TreeMetadataManifest([string]$Path, [string]$Scope) {
  $full = [IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $full)) {
    return [ordered]@{ scope = $Scope; exists = $false; fileCount = 0; directoryCount = 0; totalBytes = 0; metadataSha256 = Get-Sha256Text "$Scope|ABSENT" }
  }
  Assert-NoReparseChain $full
  $rootItem = Get-Item -LiteralPath $full -Force
  Assert-True $rootItem.PSIsContainer "$Scope root is not a directory."
  $records = [Collections.Generic.List[string]]::new()
  $fileCount = 0
  $directoryCount = 1
  $totalBytes = [long]0
  $records.Add("D|.|$([int64]$rootItem.Attributes)")
  foreach ($item in Get-ChildItem -LiteralPath $full -Force -Recurse) {
    Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "$Scope contains a reparse/symlink entry."
    $relativeNameHash = Get-Sha256Text ((Get-RelativePath $full $item.FullName).Replace('\', '/').ToLowerInvariant())
    if ($item.PSIsContainer) {
      $directoryCount += 1
      $records.Add("D|$relativeNameHash|$([int64]$item.Attributes)")
    } else {
      $fileCount += 1
      $totalBytes += [long]$item.Length
      $contentSha256 = Get-FileSha256 $item.FullName
      $records.Add("F|$relativeNameHash|$([long]$item.Length)|$contentSha256|$($item.LastWriteTimeUtc.Ticks)|$([int64]$item.Attributes)")
    }
  }
  $ordered = $records.ToArray() | Sort-Object
  return [ordered]@{
    scope = $Scope
    exists = $true
    fileCount = $fileCount
    directoryCount = $directoryCount
    totalBytes = $totalBytes
    contentEqualityMeasured = $true
    metadataSha256 = Get-Sha256Text ($ordered -join "`n")
  }
}

function Get-OptionalPropertyString($Value, [string]$Name) {
  if ($null -eq $Value) { return '' }
  $property = Get-Member -InputObject $Value -Name $Name -MemberType Properties
  if ($null -eq $property) { return '' }
  $propertyValue = $Value | Select-Object -ExpandProperty $Name -ErrorAction Stop
  if ($null -eq $propertyValue) { return '' }
  return [string]$propertyValue
}

function Get-UninstallRegistryManifest([string]$Scope) {
  $records = [Collections.Generic.List[string]]::new()
  foreach ($registryRoot in @(
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )) {
    if (-not (Test-Path -LiteralPath $registryRoot)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $registryRoot -ErrorAction Stop) {
      $value = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
      $displayName = Get-OptionalPropertyString $value 'DisplayName'
      if ($displayName -notmatch '^ParsYuva(?:\s|$)') { continue }
      $channelDisplayNamePattern = '^ParsYuva Aile Ya' + [char]0x015F + 'am Merkezi (Bronze|Silver|Gold) ([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}-[0-9]+)$'
      $channelMatch = [regex]::Match($displayName, $channelDisplayNamePattern)
      $channel = if ($channelMatch.Success) { $channelMatch.Groups[1].Value.ToLowerInvariant() } else { 'legacy' }
      if ($channel -ne $Scope) { continue }
      $records.Add((@(
        $displayName,
        (Get-OptionalPropertyString $value 'DisplayVersion'),
        (Get-OptionalPropertyString $value 'InstallLocation'),
        (Get-OptionalPropertyString $value 'DisplayIcon'),
        (Get-OptionalPropertyString $value 'UninstallString'),
        (Get-OptionalPropertyString $value 'QuietUninstallString')
      ) -join '|'))
    }
  }
  $ordered = @($records.ToArray() | Sort-Object)
  return [ordered]@{ scope = "registry-$Scope"; entryCount = $ordered.Count; metadataSha256 = Get-Sha256Text ($ordered -join "`n") }
}

function Get-BronzeRegistryIdentity([string]$ExpectedVersion) {
  $matches = [Collections.Generic.List[object]]::new()
  $expectedProductName = 'ParsYuva Aile Ya' + [char]0x015F + 'am Merkezi Bronze'
  $expectedDisplayName = "$expectedProductName $ExpectedVersion"
  foreach ($registryRoot in @(
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )) {
    if (-not (Test-Path -LiteralPath $registryRoot)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $registryRoot -ErrorAction Stop) {
      $value = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
      $displayName = Get-OptionalPropertyString $value 'DisplayName'
      $installLocation = Get-OptionalPropertyString $value 'InstallLocation'
      if ($displayName -ceq $expectedDisplayName -and
          -not [string]::IsNullOrWhiteSpace($installLocation) -and
          [IO.Path]::GetFullPath($installLocation).TrimEnd('\').Equals($CanonicalInstallRoot.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
        $matches.Add([ordered]@{
          DisplayName = $displayName
          DisplayVersion = Get-OptionalPropertyString $value 'DisplayVersion'
          InstallLocation = $installLocation
          DisplayIcon = Get-OptionalPropertyString $value 'DisplayIcon'
          UninstallString = Get-OptionalPropertyString $value 'UninstallString'
          QuietUninstallString = Get-OptionalPropertyString $value 'QuietUninstallString'
        })
      }
    }
  }
  Assert-True ($matches.Count -eq 1) 'Bronze uninstall registry entry is not exact and unique.'
  $entry = $matches[0]
  $expectedDisplayIcon = "$CanonicalInstalledExe,0"
  $expectedUninstaller = Join-Path $CanonicalInstallRoot 'Uninstall ParsYuva-Bronze.exe'
  $expectedUninstallString = '"' + $expectedUninstaller + '" /allusers'
  $expectedQuietUninstallString = "$expectedUninstallString /S"
  Assert-True ([string]$entry.DisplayVersion -ceq $ExpectedVersion) 'Bronze uninstall DisplayVersion does not match the target package.'
  Assert-True ([string]$entry.DisplayIcon -ceq $expectedDisplayIcon) 'Bronze DisplayIcon is not bound to the canonical application EXE.'
  Assert-True ([string]$entry.UninstallString -ceq $expectedUninstallString) 'Bronze UninstallString is not bound to the sibling install root.'
  Assert-True ([string]$entry.QuietUninstallString -ceq $expectedQuietUninstallString) 'Bronze QuietUninstallString is not bound to the sibling install root.'
  return [ordered]@{
    exactSingleEntry = $true
    displayName = [string]$entry.DisplayName
    displayVersion = [string]$entry.DisplayVersion
    installRoot = [string]$entry.InstallLocation
    displayIcon = [string]$entry.DisplayIcon
    uninstallString = [string]$entry.UninstallString
    quietUninstallString = [string]$entry.QuietUninstallString
    executable = $CanonicalInstalledExe
  }
}

function Get-StateSnapshot([string]$Phase) {
  $programRoots = [ordered]@{
    bronze = 'C:\Program Files\PPT\ParsYuva-Bronze'
    silver = 'C:\Program Files\PPT\ParsYuva-Silver'
    gold = 'C:\Program Files\PPT\ParsYuva-Gold'
    legacy = 'C:\Program Files\PPT\ParsYuva'
  }
  $dataRoots = [ordered]@{
    bronze = Join-Path $ExpectedUserDataRoot 'Bronze'
    silver = Join-Path $ExpectedUserDataRoot 'Silver'
    gold = Join-Path $ExpectedUserDataRoot 'Gold'
    legacy = $ExpectedUserDataRoot
  }
  $program = [ordered]@{}
  $userData = [ordered]@{}
  foreach ($name in $programRoots.Keys) { $program[$name] = Get-TreeMetadataManifest $programRoots[$name] "program-$name" }
  foreach ($name in $dataRoots.Keys) { $userData[$name] = Get-TreeMetadataManifest $dataRoots[$name] "userdata-$name" }
  $registry = [ordered]@{}
  foreach ($name in @('bronze', 'silver', 'gold', 'legacy')) { $registry[$name] = Get-UninstallRegistryManifest $name }
  return [ordered]@{ phase = $Phase; program = $program; userData = $userData; uninstallRegistry = $registry }
}

function Assert-ManifestEqual($Before, $After, [string]$Label) {
  $left = $Before | ConvertTo-Json -Depth 20 -Compress
  $right = $After | ConvertTo-Json -Depth 20 -Compress
  Assert-True ($left -ceq $right) "$Label metadata manifest changed."
}

function Get-ProductProcesses {
  return @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $candidatePath = Get-OptionalPropertyString $_ 'ExecutablePath'
    -not [string]::IsNullOrWhiteSpace($candidatePath) -and
      [IO.Path]::GetFullPath($candidatePath).StartsWith($CanonicalInstallRoot + '\', [StringComparison]::OrdinalIgnoreCase)
  } | Select-Object ProcessId, Name, ExecutablePath)
}

function Invoke-SilentInstaller {
  $startedAt = [DateTimeOffset]::UtcNow
  $process = Start-Process -FilePath $InstallerPath -ArgumentList @('/S') -PassThru
  $windowTitles = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $applicationProcessObserved = $false
  while (-not $process.HasExited) {
    $processIds = [Collections.Generic.HashSet[int]]::new()
    [void]$processIds.Add($process.Id)
    foreach ($child in Get-CimInstance Win32_Process -Filter "ParentProcessId=$($process.Id)" -ErrorAction SilentlyContinue) {
      [void]$processIds.Add([int]$child.ProcessId)
    }
    foreach ($candidate in Get-Process -ErrorAction SilentlyContinue | Where-Object { $processIds.Contains($_.Id) }) {
      if (-not [string]::IsNullOrWhiteSpace($candidate.MainWindowTitle)) { [void]$windowTitles.Add($candidate.MainWindowTitle) }
    }
    foreach ($candidate in Get-CimInstance Win32_Process -ErrorAction Stop) {
      $candidatePath = Get-OptionalPropertyString $candidate 'ExecutablePath'
      if (-not [string]::IsNullOrWhiteSpace($candidatePath) -and
          [IO.Path]::GetFullPath($candidatePath).Equals($CanonicalInstalledExe, [StringComparison]::OrdinalIgnoreCase)) {
        $applicationProcessObserved = $true
      }
    }
    Start-Sleep -Milliseconds 100
    $process.Refresh()
  }
  Assert-True ($process.ExitCode -eq 0) "Technical predecessor silent installer exit code is not zero: $($process.ExitCode)"
  $selectionDialog = @($windowTitles | Where-Object { $_ -match '(?i)kisisel veri|kişisel veri|personal data|yedek|backup|silme|delete data' }).Count -gt 0
  Assert-True (-not $selectionDialog) 'Technical predecessor preparation displayed a data selection dialog.'
  Assert-True (-not $applicationProcessObserved) 'Technical predecessor preparation launched the ParsYuva application process.'
  return [ordered]@{
    classification = 'TECHNICAL_PREDECESSOR_SILENT_INSTALL_ONLY'
    arguments = @('/S')
    exitCode = $process.ExitCode
    dataSelectionDialogObserved = $selectionDialog
    applicationProcessObserved = $applicationProcessObserved
    visibleWindowTitleCount = $windowTitles.Count
    startedAt = $startedAt.ToString('O')
    completedAt = [DateTimeOffset]::UtcNow.ToString('O')
  }
}

function New-EvidenceRunGuard {
  $guardPath = Join-Path $RunRoot '.ppt-evidence-run.guard'
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes("PPT_TECHNICAL_PREDECESSOR_GUARD|$RunId`n")
  $stream = [IO.File]::Open($guardPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::Read)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush($true)
  return [ordered]@{ path = $guardPath; stream = $stream; sizeBytes = $bytes.Length; sha256 = Get-FileSha256 $guardPath }
}

function Assert-EvidenceRunGuard($Guard) {
  Assert-True ($null -ne $Guard -and $null -ne $Guard.stream) 'Evidence run guard is unavailable.'
  Assert-NoReparseChain $Guard.path
  $item = Get-Item -LiteralPath $Guard.path -Force
  Assert-True ([long]$item.Length -eq [long]$Guard.sizeBytes -and (Get-FileSha256 $Guard.path) -ceq [string]$Guard.sha256) 'Evidence run guard changed during preparation.'
}

function Close-EvidenceRunGuard($Guard) {
  Assert-EvidenceRunGuard $Guard
  $Guard.stream.Dispose()
  $Guard.stream = $null
}

function Write-AtomicJson([string]$Path, $Value) {
  $target = [IO.Path]::GetFullPath($Path)
  Assert-True (Test-ContainedPath $target $RunRoot) 'Receipt cannot be written outside its UUID run root.'
  Assert-EvidenceRunGuard $script:EvidenceRunGuard
  Assert-NoReparseChain $target $true
  $temporary = "$target.$PID.$([guid]::NewGuid().ToString('N')).tmp"
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 100) + "`n")
  $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }
  [IO.File]::Move($temporary, $target)
  Assert-EvidenceRunGuard $script:EvidenceRunGuard
  $readback = [IO.File]::ReadAllBytes($target)
  Assert-True ($bytes.Length -eq $readback.Length -and
    (Get-Sha256Text ([Convert]::ToBase64String($bytes))) -ceq (Get-Sha256Text ([Convert]::ToBase64String($readback)))) 'Atomic receipt readback does not match the written bytes.'
  return [ordered]@{ path = $target; sizeBytes = $readback.Length; sha256 = Get-FileSha256 $target }
}

$RunStartedAt = [DateTimeOffset]::UtcNow
Assert-True ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'Technical predecessor preparation requires an elevated Windows session.'
Assert-True ($ExpectedInstalledReleaseId -ceq $ExpectedInstalledReleaseIdConstant) 'ExpectedInstalledReleaseId is not exact Bronze 51.'
Assert-True ($ExpectedTargetReleaseId -ceq $ExpectedTargetReleaseIdConstant) 'ExpectedTargetReleaseId is not exact rejected Bronze 52.'
Assert-True ($ExpectedConsumerReleaseId -ceq $ExpectedConsumerReleaseIdConstant) 'ExpectedConsumerReleaseId is not exact Bronze 53.'
Assert-True ([IO.Path]::GetFullPath($InstalledExePath).Equals($CanonicalInstalledExe, [StringComparison]::OrdinalIgnoreCase)) 'InstalledExePath is not the canonical Bronze sibling runtime.'
Assert-True ([IO.Path]::GetFullPath($InstallerPath).Equals($ExpectedTargetInstaller, [StringComparison]::OrdinalIgnoreCase)) 'InstallerPath is not the exact Bronze 52 installer artifact.'
Assert-True ([IO.Path]::GetFullPath($PackagedExePath).Equals($ExpectedTargetPackagedExe, [StringComparison]::OrdinalIgnoreCase)) 'PackagedExePath is not the exact Bronze 52 packaged runtime.'
Assert-True ([IO.Path]::GetFullPath($InstalledSourceBundle).Equals($ExpectedInstalledBundle, [StringComparison]::OrdinalIgnoreCase)) 'InstalledSourceBundle is not the exact immutable Bronze 51 bundle.'
Assert-True ([IO.Path]::GetFullPath($TargetPackageBundle).Equals($ExpectedTargetBundle, [StringComparison]::OrdinalIgnoreCase)) 'TargetPackageBundle is not the exact immutable Bronze 52 bundle.'
Assert-True ($EvidenceCategoryParent.Equals($ValidationBase, [StringComparison]::OrdinalIgnoreCase)) 'EvidenceRoot must be the exact technical predecessor preparation category parent.'
Assert-True (-not (Test-Path -LiteralPath $RunRoot)) 'Generated UUID run root already exists; partial runs are never recovered or overwritten.'

$InstallerPath = Resolve-RegularFile $InstallerPath 'InstallerPath'
$PackagedExePath = Resolve-RegularFile $PackagedExePath 'PackagedExePath'
$InstalledExePath = Resolve-RegularFile $InstalledExePath 'InstalledExePath'
$InstalledSourceBundle = Resolve-RegularFile $InstalledSourceBundle 'InstalledSourceBundle'
$TargetPackageBundle = Resolve-RegularFile $TargetPackageBundle 'TargetPackageBundle'
Assert-NoReparseChain $EvidenceCategoryParent $true
Assert-NoReparseChain $ExpectedUserDataRoot $true
Assert-True (@(Get-ProductProcesses).Count -eq 0) 'ParsYuva Bronze application is running before technical predecessor preparation.'

$releaseLedgerPath = Resolve-RegularFile (Join-Path $RepoRoot 'config\release-ledger.json') 'release ledger'
$releaseLedgerBinding = Get-FileBinding $releaseLedgerPath 'release ledger'
$producerBefore = Get-FileBinding $ProducerPath 'technical predecessor producer before preparation'
$releaseLedger = Get-Content -LiteralPath $releaseLedgerPath -Raw -Encoding UTF8 | ConvertFrom-Json
$targetEntries = @($releaseLedger.entries | Where-Object { $_.releaseId -ceq $ExpectedTargetReleaseId })
$consumerEntries = @($releaseLedger.entries | Where-Object { $_.releaseId -ceq $ExpectedConsumerReleaseId })
Assert-True ($targetEntries.Count -eq 1 -and $targetEntries[0].version -ceq '27.08.2026.52' -and
  $targetEntries[0].status -ceq 'REJECTED_INSTALLER_VISUAL_UAT_FAIL' -and
  $targetEntries[0].rejection.effectiveStatus -ceq 'REJECTED_INSTALLER_VISUAL_UAT_FAIL' -and
  $targetEntries[0].rejection.countsAsDeliveryPass -eq $false -and
  $targetEntries[0].rejection.immutablePackageHistoryRewritten -eq $false -and
  $targetEntries[0].rejection.technicalPredecessorUse -ceq 'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK') 'Bronze 52 rejection/technical predecessor lifecycle authority is missing or stale.'
Assert-True ($consumerEntries.Count -eq 1 -and $releaseLedger.current.releaseId -ceq $ExpectedConsumerReleaseId -and
  $releaseLedger.current.visibleRelease -ceq $ExpectedConsumerRelease -and
  [int]$releaseLedger.current.monthlySequence -eq 53 -and
  $releaseLedger.current.status -ceq 'IN_PROGRESS' -and
  $releaseLedger.current.parentRelease -ceq $ExpectedTargetRelease) 'Bronze 53 consumer lifecycle authority is missing or stale.'

$nodePath = (Get-Command node -ErrorAction Stop).Source
$bundleVerifierSource = @'
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [root, installedBundlePath, targetBundlePath] = process.argv.slice(1);
const provenanceModule = await import(pathToFileURL(resolve(root, 'scripts/lib/release-source-provenance.mjs')).href);
const packageModule = await import(pathToFileURL(resolve(root, 'scripts/lib/windows-package-provenance.mjs')).href);
const current = await provenanceModule.captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
const verify = async (bundlePath, expectedRelease, expectedReleaseId) => {
  const result = await packageModule.verifyWindowsPackageHistoryBundle({
    root,
    bundlePath,
    expectedRelease,
    expectedReleaseId,
    currentProvenance: current.provenance,
    runGit: current.runGit,
    requireEarlierCommit: true
  });
  return {
    bundle: { path: result.bundleBinding.fullPath, sizeBytes: result.bundleBinding.sizeBytes, sha256: result.bundleBinding.sha256 },
    archivedPackageProvenance: { path: result.packageBinding.fullPath, sizeBytes: result.packageBinding.sizeBytes, sha256: result.packageBinding.sha256 },
    release: result.receipt.release,
    releaseId: result.receipt.releaseId,
    packageVersion: result.receipt.packageVersion,
    sourceCommit: result.receipt.sourceProvenance.headCommit,
    producer: result.receipt.producer,
    installer: result.receipt.artifacts?.installer ?? null,
    packagedRuntime: result.receipt.artifacts?.packagedRuntime ?? null,
    previousPackageProvenance: result.receipt.previousPackageProvenance ?? null,
    externalAnchor: { path: result.externalAnchor.binding.path, sizeBytes: result.externalAnchor.binding.sizeBytes, sha256: result.externalAnchor.binding.sha256 }
  };
};
const installed = await verify(installedBundlePath, 'Bronze 26.08.2026.51', 'bronze-2026-08-26-r51');
const target = await verify(targetBundlePath, 'Bronze 27.08.2026.52', 'bronze-2026-08-27-r52');
process.stdout.write(JSON.stringify({ status: 'PASS', currentSource: current.provenance, installed, target }));
'@
$bundleVerificationJson = & $nodePath --input-type=module -e $bundleVerifierSource -- $RepoRoot $InstalledSourceBundle $TargetPackageBundle
Assert-True ($LASTEXITCODE -eq 0) 'Immutable Bronze 51/52 package bundle, Git, PR-235 or external-anchor verification failed.'
$bundleVerification = $bundleVerificationJson | ConvertFrom-Json
Assert-True ($bundleVerification.status -ceq 'PASS' -and $bundleVerification.currentSource.channel -ceq 'Bronze' -and $bundleVerification.currentSource.worktreeClean -eq $true) 'Current Bronze source provenance is not exact and clean.'
Assert-True ($bundleVerification.installed.release -ceq $ExpectedInstalledRelease -and $bundleVerification.installed.releaseId -ceq $ExpectedInstalledReleaseId -and $bundleVerification.installed.packageVersion -ceq $ExpectedInstalledPackageVersion) 'Immutable Bronze 51 bundle identity is stale.'
Assert-True ($bundleVerification.target.release -ceq $ExpectedTargetRelease -and $bundleVerification.target.releaseId -ceq $ExpectedTargetReleaseId -and $bundleVerification.target.packageVersion -ceq $ExpectedTargetPackageVersion) 'Immutable Bronze 52 bundle identity is stale.'
Assert-True ($bundleVerification.target.previousPackageProvenance.releaseId -ceq $ExpectedInstalledReleaseId) 'Bronze 52 package provenance is not linked to exact Bronze 51.'

$installedBefore = Get-FileIdentity $InstalledExePath 'installed Bronze 51 runtime'
$installerBefore = Get-FileIdentity $InstallerPath 'Bronze 52 installer'
$packagedBefore = Get-FileIdentity $PackagedExePath 'Bronze 52 packaged runtime'
$installedBundleBefore = Get-FileBinding $InstalledSourceBundle 'immutable Bronze 51 bundle'
$targetBundleBefore = Get-FileBinding $TargetPackageBundle 'immutable Bronze 52 bundle'
Assert-True ($installedBefore.fileVersion -ceq $ExpectedInstalledPackageVersion -and
  $installedBefore.sha256 -ceq $bundleVerification.installed.packagedRuntime.sha256 -and
  [long]$installedBefore.sizeBytes -eq [long]$bundleVerification.installed.packagedRuntime.sizeBytes) 'Live Bronze 51 runtime does not match its immutable package bundle.'
Assert-True ($installerBefore.fileVersion -ceq $ExpectedTargetPackageVersion -and
  $installerBefore.sha256 -ceq $bundleVerification.target.installer.sha256 -and
  [long]$installerBefore.sizeBytes -eq [long]$bundleVerification.target.installer.sizeBytes) 'Bronze 52 installer does not match its immutable package bundle.'
Assert-True ($packagedBefore.fileVersion -ceq $ExpectedTargetPackageVersion -and
  $packagedBefore.sha256 -ceq $bundleVerification.target.packagedRuntime.sha256 -and
  [long]$packagedBefore.sizeBytes -eq [long]$bundleVerification.target.packagedRuntime.sizeBytes) 'Bronze 52 packaged runtime does not match its immutable package bundle.'
Assert-True ($installerBefore.authenticodeStatus -ceq 'NotSigned' -and $packagedBefore.authenticodeStatus -ceq 'NotSigned') 'Technical predecessor preparation accepts only the exact local-test NotSigned package.'

if (-not (Test-Path -LiteralPath $EvidenceCategoryParent)) { [IO.Directory]::CreateDirectory($EvidenceCategoryParent) | Out-Null }
Assert-NoReparseChain $EvidenceCategoryParent
[IO.Directory]::CreateDirectory($RunRoot) | Out-Null
Assert-NoReparseChain $RunRoot
$script:EvidenceRunGuard = New-EvidenceRunGuard

$originalState = Get-StateSnapshot 'ORIGINAL_BEFORE_SYNTHETIC_MARKER'
$bronzeDataRoot = [IO.Path]::GetFullPath((Join-Path $ExpectedUserDataRoot 'Bronze'))
$bronzeDataRootExisted = Test-Path -LiteralPath $bronzeDataRoot
$userDataRootExisted = Test-Path -LiteralPath $ExpectedUserDataRoot
Assert-NoReparseChain $bronzeDataRoot $true
[IO.Directory]::CreateDirectory($bronzeDataRoot) | Out-Null
$markerPath = Join-Path $bronzeDataRoot ".ppt-technical-predecessor-$([guid]::NewGuid().ToString('N')).json"
$markerValue = [ordered]@{
  schemaVersion = 1
  kind = 'PPT_SYNTHETIC_TECHNICAL_PREDECESSOR_PRESERVATION_MARKER'
  expectedTargetReleaseId = $ExpectedTargetReleaseId
  expectedConsumerReleaseId = $ExpectedConsumerReleaseId
  nonce = [guid]::NewGuid().ToString('N')
}
$markerBytes = [Text.UTF8Encoding]::new($false).GetBytes(($markerValue | ConvertTo-Json -Compress) + "`n")
$markerStream = [IO.File]::Open($markerPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
  $markerStream.Write($markerBytes, 0, $markerBytes.Length)
  $markerStream.Flush($true)
} finally {
  $markerStream.Dispose()
}
$markerIdentity = [ordered]@{ sizeBytes = $markerBytes.Length; sha256 = Get-FileSha256 $markerPath; kind = $markerValue.kind }

$preparationFailure = $null
$cleanupFailure = $null
try {
  $before = Get-StateSnapshot 'BEFORE_TECHNICAL_PREDECESSOR_SILENT_INSTALL'
  $installedImmediatelyBefore = Get-FileIdentity $InstalledExePath 'installed Bronze 51 runtime immediately before installer'
  Assert-True (($installedImmediatelyBefore | ConvertTo-Json -Compress) -ceq ($installedBefore | ConvertTo-Json -Compress)) 'Installed Bronze 51 runtime changed immediately before silent installation.'
  Assert-BindingEqual $installerBefore (Get-FileIdentity $InstallerPath 'Bronze 52 installer immediate readback') 'Bronze 52 installer'
  Assert-BindingEqual $packagedBefore (Get-FileIdentity $PackagedExePath 'Bronze 52 packaged runtime immediate readback') 'Bronze 52 packaged runtime'
  Assert-BindingEqual $installedBundleBefore (Get-FileBinding $InstalledSourceBundle 'immutable Bronze 51 bundle immediate readback') 'Immutable Bronze 51 bundle'
  Assert-BindingEqual $targetBundleBefore (Get-FileBinding $TargetPackageBundle 'immutable Bronze 52 bundle immediate readback') 'Immutable Bronze 52 bundle'
  Assert-EvidenceRunGuard $script:EvidenceRunGuard
  $installerProcess = Invoke-SilentInstaller
  $installedAfter = Get-FileIdentity $InstalledExePath 'installed Bronze 52 runtime'
  Assert-True ($installedAfter.fileVersion -ceq $ExpectedTargetPackageVersion -and
    $installedAfter.sha256 -ceq $packagedBefore.sha256 -and
    [long]$installedAfter.sizeBytes -eq [long]$packagedBefore.sizeBytes) 'Installed Bronze 52 runtime is not exact packaged runtime after silent installation.'
  Assert-True (@(Get-ProductProcesses).Count -eq 0) 'ParsYuva Bronze application was launched or remained running during technical predecessor preparation.'
  $after = Get-StateSnapshot 'AFTER_TECHNICAL_PREDECESSOR_SILENT_INSTALL'
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.userData[$channel] $after.userData[$channel] "Technical predecessor userdata-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.program[$channel] $after.program[$channel] "Technical predecessor program-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.uninstallRegistry[$channel] $after.uninstallRegistry[$channel] "Technical predecessor registry-$channel" }
  Assert-True ((Get-FileSha256 $markerPath) -ceq $markerIdentity.sha256) 'Synthetic technical predecessor marker was not preserved.'
  $bronzeRegistryAfter = Get-BronzeRegistryIdentity $ExpectedTargetPackageVersion
  Assert-BindingEqual $installerBefore (Get-FileIdentity $InstallerPath 'Bronze 52 installer final readback') 'Bronze 52 installer'
  Assert-BindingEqual $packagedBefore (Get-FileIdentity $PackagedExePath 'Bronze 52 packaged runtime final readback') 'Bronze 52 packaged runtime'
  Assert-BindingEqual $installedBundleBefore (Get-FileBinding $InstalledSourceBundle 'immutable Bronze 51 bundle final readback') 'Immutable Bronze 51 bundle'
  Assert-BindingEqual $targetBundleBefore (Get-FileBinding $TargetPackageBundle 'immutable Bronze 52 bundle final readback') 'Immutable Bronze 52 bundle'
} catch {
  $preparationFailure = $_
} finally {
  try {
    Assert-EvidenceRunGuard $script:EvidenceRunGuard
    if (Test-Path -LiteralPath $markerPath -PathType Leaf) { Remove-Item -LiteralPath $markerPath -Force }
    if (-not $bronzeDataRootExisted -and (Test-Path -LiteralPath $bronzeDataRoot) -and @(Get-ChildItem -LiteralPath $bronzeDataRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $bronzeDataRoot -Force }
    if (-not $userDataRootExisted -and (Test-Path -LiteralPath $ExpectedUserDataRoot) -and @(Get-ChildItem -LiteralPath $ExpectedUserDataRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $ExpectedUserDataRoot -Force }
  } catch {
    $cleanupFailure = $_
  }
}
if ($null -ne $preparationFailure) { throw $preparationFailure }
if ($null -ne $cleanupFailure) { throw $cleanupFailure }

$postCleanupState = Get-StateSnapshot 'AFTER_SYNTHETIC_MARKER_CLEANUP'
foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $originalState.userData[$channel] $postCleanupState.userData[$channel] "Technical predecessor marker cleanup userdata-$channel" }
foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $originalState.program[$channel] $postCleanupState.program[$channel] "Technical predecessor final program-$channel" }
foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $originalState.uninstallRegistry[$channel] $postCleanupState.uninstallRegistry[$channel] "Technical predecessor final registry-$channel" }
Assert-True (-not (Test-Path -LiteralPath $markerPath)) 'Synthetic technical predecessor marker cleanup absence readback failed.'
Assert-True (@(Get-ProductProcesses).Count -eq 0) 'ParsYuva Bronze application is running after technical predecessor preparation.'
Assert-BindingEqual $releaseLedgerBinding (Get-FileBinding $releaseLedgerPath 'release ledger final readback') 'Release ledger'
Assert-BindingEqual $producerBefore (Get-FileBinding $ProducerPath 'technical predecessor producer final readback') 'Technical predecessor producer'
Assert-EvidenceRunGuard $script:EvidenceRunGuard

$producerIdentity = $producerBefore
$receipt = [ordered]@{
  schemaVersion = 1
  id = 'PPT-WINDOWS-TECHNICAL-PREDECESSOR-PREPARATION-V1'
  evidenceKind = 'WINDOWS_TECHNICAL_PREDECESSOR_PREPARATION'
  status = 'PASS'
  exitCode = 0
  runId = $RunId
  evidenceRoot = $RunRoot
  startedAt = $RunStartedAt.ToString('O')
  completedAt = [DateTimeOffset]::UtcNow.ToString('O')
  installationMode = 'TECHNICAL_PREDECESSOR_PREPARATION_ONLY'
  releaseAcceptanceClaimed = $false
  deliveryEligible = $false
  targetPackageDeliveryPassClaimed = $false
  interactiveInstallerUiExercised = $false
  applicationLaunchAttempted = $false
  fromRelease = $ExpectedInstalledRelease
  fromReleaseId = $ExpectedInstalledReleaseId
  toRelease = $ExpectedTargetRelease
  toReleaseId = $ExpectedTargetReleaseId
  consumerRelease = $ExpectedConsumerRelease
  consumerReleaseId = $ExpectedConsumerReleaseId
  currentSource = $bundleVerification.currentSource
  producer = $producerIdentity
  lifecycleAuthority = [ordered]@{
    releaseLedger = $releaseLedgerBinding
    targetStatus = 'REJECTED_INSTALLER_VISUAL_UAT_FAIL'
    targetCountsAsDeliveryPass = $false
    immutablePackageHistoryRewritten = $false
    technicalPredecessorUse = 'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK'
    rejectedCheckpoint = 'a5334c13'
  }
  installedSourceBundle = $bundleVerification.installed
  targetPackageBundle = $bundleVerification.target
  installer = $installerBefore
  packagedRuntime = $packagedBefore
  installedBefore = $installedBefore
  installedAfter = $installedAfter
  silentInstallation = $installerProcess
  preservation = [ordered]@{
    before = $before
    after = $after
    postMarkerCleanup = $postCleanupState
    allUserDataContentEqualityPreserved = $true
    bronzeUserDataPreserved = $true
    silverUserDataPreserved = $true
    goldUserDataPreserved = $true
    legacyUserDataPreserved = $true
    silverGoldLegacyProgramMetadataPreserved = $true
    silverGoldLegacyRegistryMetadataPreserved = $true
    otherChannelWriteCount = 0
    bronzeRegistry = $bronzeRegistryAfter
  }
  syntheticMarker = [ordered]@{
    kind = $markerIdentity.kind
    sizeBytes = $markerIdentity.sizeBytes
    sha256 = $markerIdentity.sha256
    preservedDuringInstall = $true
    cleanupStatus = 'DELETED_AND_ABSENCE_READBACK_PASS'
  }
  privacyBoundary = [ordered]@{
    existingUserFileContentsHashedForEquality = $true
    existingUserFileContentsRecorded = $false
    existingUserFileNamesRecorded = $false
    receiptContainsUserContent = $false
    relativeNamesHashed = $true
    contentEqualityMeasured = $true
  }
  knownRejectedInstallerExperience = [ordered]@{
    targetStatus = 'REJECTED_INSTALLER_VISUAL_UAT_FAIL'
    checkpoint = 'a5334c13'
    interactiveUiWasNotUsed = $true
    acceptanceOrDeliveryClaim = $false
  }
  handoff = [ordered]@{
    expectedConsumerReleaseId = $ExpectedConsumerReleaseId
    installedRuntimeReadyForExactNormalUat110Readback = $true
    doesNotReplaceInstallerExperienceUat = $true
    doesNotReplaceInstalledReleaseUat110 = $true
    doesNotReplaceInstalledFrontendUat111 = $true
    doesNotReplaceFinalDeliveryReceipt = $true
  }
}
$receiptBinding = Write-AtomicJson $ReceiptPath $receipt
Close-EvidenceRunGuard $script:EvidenceRunGuard
[ordered]@{
  status = 'PASS'
  releaseAcceptanceClaimed = $false
  deliveryEligible = $false
  runId = $RunId
  receipt = $receiptBinding
} | ConvertTo-Json -Depth 20 -Compress
