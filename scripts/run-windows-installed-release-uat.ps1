[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerPath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PackagedExePath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstalledExePath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PreviousInstalledExePath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PackageProvenance,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$GovernedPreflight,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerExperienceUat,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PreviousPackageProvenance,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$EvidenceRoot,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$ExpectedReleaseId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ValidationBase = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\windows-installed-release-uat'))
$runId = [guid]::NewGuid().ToString('D')
$EvidenceCategoryParent = [IO.Path]::GetFullPath($EvidenceRoot)
$RunRoot = [IO.Path]::GetFullPath((Join-Path $EvidenceCategoryParent $runId))
$CanonicalInstallRoot = [IO.Path]::GetFullPath('C:\Program Files\PPT\ParsYuva-Bronze')
$CanonicalInstalledExe = [IO.Path]::GetFullPath((Join-Path $CanonicalInstallRoot 'ParsYuva-Bronze.exe'))
$CanonicalPreviousInstalledExe = $CanonicalInstalledExe
$ExpectedUserDataRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'ParsYuva'))
$RunnerPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'scripts\run-installed-frontend-user-uat.mjs'))
$PackageVerifierPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'scripts\verify-windows-package-provenance.mjs'))
$ProducerPath = [IO.Path]::GetFullPath($PSCommandPath)
$InstallationReceiptPath = [IO.Path]::GetFullPath((Join-Path $RunRoot 'windows-installed-release-uat110.json'))
$InstalledUiEvidenceRoot = [IO.Path]::GetFullPath((Join-Path $RunRoot 'installed-frontend'))
$InstalledUiReceiptPath = [IO.Path]::GetFullPath((Join-Path $InstalledUiEvidenceRoot 'installed-frontend-user-uat111.json'))

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

function Get-RelativePath([string]$BasePath, [string]$TargetPath) {
  $base = [Uri]::new(([IO.Path]::GetFullPath($BasePath).TrimEnd('\') + '\'))
  $target = [Uri]::new([IO.Path]::GetFullPath($TargetPath))
  return [Uri]::UnescapeDataString($base.MakeRelativeUri($target).ToString()).Replace('/', '\')
}

function Get-FileSha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-ContainedPath([string]$Candidate, [string]$Parent) {
  $fullCandidate = [IO.Path]::GetFullPath($Candidate).TrimEnd('\')
  $fullParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\')
  return $fullCandidate.StartsWith("$fullParent\", [StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparseChain([string]$Path, [bool]$LeafMayBeMissing = $false) {
  $full = [IO.Path]::GetFullPath($Path)
  if ((-not (Test-Path -LiteralPath $full)) -and (-not $LeafMayBeMissing)) {
    throw "Zorunlu yol bulunamadi: $full"
  }
  $cursor = if (Test-Path -LiteralPath $full) { $full } else { Split-Path -Parent $full }
  while ($cursor -and (Test-Path -LiteralPath $cursor)) {
    $item = Get-Item -LiteralPath $cursor -Force
    Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "Reparse/symlink yol reddedildi: $cursor"
    $parent = Split-Path -Parent $cursor
    if ($parent -eq $cursor) { break }
    $cursor = $parent
  }
}

function Assert-EvidenceRunGuard($Guard) {
  Assert-NoReparseChain $RunRoot
  $item = Get-Item -LiteralPath $Guard.Path -Force
  Assert-True (-not $item.PSIsContainer -and (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0)) 'Evidence run guard normal non-reparse dosya degil.'
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
  Assert-True ($offset -eq $Guard.Bytes.Length -and
    [Convert]::ToBase64String($readback) -ceq [Convert]::ToBase64String($Guard.Bytes)) 'Evidence run guard readback degisti.'
}

function New-EvidenceRunGuard {
  Assert-NoReparseChain $RunRoot
  $guardPath = Join-Path $RunRoot '.ppt-evidence-run.guard'
  $guardBytes = [Text.UTF8Encoding]::new($false).GetBytes("PPT-EXCLUSIVE-EVIDENCE-RUN-ROOT-GUARD-V1|$PID|$([guid]::NewGuid().ToString('D'))`n")
  $guardStream = [IO.File]::Open($guardPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::Read)
  $guardStream.Write($guardBytes, 0, $guardBytes.Length)
  $guardStream.Flush($true)
  $guard = [pscustomobject]@{ Path = $guardPath; Bytes = $guardBytes; Stream = $guardStream }
  Assert-EvidenceRunGuard $guard
  return $guard
}

function Close-EvidenceRunGuard($Guard) {
  Assert-EvidenceRunGuard $Guard
  $Guard.Stream.Dispose()
  Remove-Item -LiteralPath $Guard.Path -Force
  Assert-True (-not (Test-Path -LiteralPath $Guard.Path)) 'Evidence run guard cleanup absence readback FAIL.'
}

function Resolve-RegularFile([string]$Path, [string]$Label) {
  $full = [IO.Path]::GetFullPath($Path)
  Assert-NoReparseChain $full
  $item = Get-Item -LiteralPath $full -Force
  Assert-True (-not $item.PSIsContainer) "$Label normal dosya degil."
  Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "$Label reparse/symlink olamaz."
  return $full
}

function Read-JsonFile([string]$Path, [string]$Label) {
  $full = Resolve-RegularFile $Path $Label
  try { return Get-Content -LiteralPath $full -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { throw "$Label gecerli JSON degil: $($_.Exception.Message)" }
}

function Get-FileIdentity([string]$Path) {
  $full = Resolve-RegularFile $Path 'Executable'
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

function Get-TreeMetadataManifest([string]$Path, [string]$Scope) {
  $full = [IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $full)) {
    return [ordered]@{ scope = $Scope; exists = $false; fileCount = 0; directoryCount = 0; totalBytes = 0; metadataSha256 = Get-Sha256Text "$Scope|ABSENT" }
  }
  Assert-NoReparseChain $full
  $rootItem = Get-Item -LiteralPath $full -Force
  Assert-True $rootItem.PSIsContainer "$Scope kok yolu klasor degil."
  $records = [Collections.Generic.List[string]]::new()
  $fileCount = 0
  $directoryCount = 1
  $totalBytes = [long]0
  $records.Add("D|.|$([int64]$rootItem.Attributes)")
  foreach ($item in Get-ChildItem -LiteralPath $full -Force -Recurse) {
    Assert-True (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) "$Scope altinda reparse/symlink reddedildi."
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

function Get-UninstallRegistryManifest([string]$Scope) {
  $records = [Collections.Generic.List[string]]::new()
  $roots = @(
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($registryRoot in $roots) {
    if (-not (Test-Path -LiteralPath $registryRoot)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $registryRoot -ErrorAction Stop) {
      $value = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
      if ([string]$value.DisplayName -notmatch '^ParsYuva(?:\s|$)') { continue }
      $channel = if ([string]$value.DisplayName -match 'Bronze$') { 'bronze' } elseif ([string]$value.DisplayName -match 'Silver$') { 'silver' } elseif ([string]$value.DisplayName -match 'Gold$') { 'gold' } else { 'legacy' }
      if ($channel -ne $Scope) { continue }
      $records.Add((@(
        [string]$value.DisplayName,
        [string]$value.DisplayVersion,
        [string]$value.InstallLocation,
        [string]$value.DisplayIcon,
        [string]$value.UninstallString,
        [string]$value.QuietUninstallString
      ) -join '|'))
    }
  }
  $ordered = $records.ToArray() | Sort-Object
  return [ordered]@{ scope = "registry-$Scope"; entryCount = $ordered.Count; metadataSha256 = Get-Sha256Text ($ordered -join "`n") }
}

function Get-BronzeRegistryIdentity([string]$ExpectedVersion) {
  $matches = [Collections.Generic.List[object]]::new()
  foreach ($registryRoot in @(
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )) {
    if (-not (Test-Path -LiteralPath $registryRoot)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $registryRoot -ErrorAction Stop) {
      $value = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
      if ([string]$value.DisplayName -match '^ParsYuva.*Bronze$' -and
          -not [string]::IsNullOrWhiteSpace([string]$value.InstallLocation) -and
          [IO.Path]::GetFullPath([string]$value.InstallLocation).TrimEnd('\').Equals($CanonicalInstallRoot.TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) {
        $matches.Add($value)
      }
    }
  }
  Assert-True ($matches.Count -eq 1) 'Bronze uninstall registry kaydi exact tekil degil.'
  $entry = $matches[0]
  Assert-True ([string]$entry.DisplayVersion -eq $ExpectedVersion) 'Bronze uninstall DisplayVersion packaged surumle uyusmuyor.'
  Assert-True ([string]$entry.DisplayIcon -match [regex]::Escape('ParsYuva-Bronze.exe')) 'Bronze DisplayIcon expected EXE ile bagli degil.'
  Assert-True ([string]$entry.UninstallString -match [regex]::Escape($CanonicalInstallRoot)) 'Bronze UninstallString sibling install root ile bagli degil.'
  return [ordered]@{
    exactSingleEntry = $true
    displayVersion = [string]$entry.DisplayVersion
    installRoot = 'C:\Program Files\PPT\ParsYuva-Bronze'
    executable = 'ParsYuva-Bronze.exe'
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
  $data = [ordered]@{}
  foreach ($name in $programRoots.Keys) { $program[$name] = Get-TreeMetadataManifest $programRoots[$name] "program-$name" }
  foreach ($name in $dataRoots.Keys) { $data[$name] = Get-TreeMetadataManifest $dataRoots[$name] "userdata-$name" }
  $registry = [ordered]@{}
  foreach ($name in @('bronze', 'silver', 'gold', 'legacy')) { $registry[$name] = Get-UninstallRegistryManifest $name }
  return [ordered]@{ phase = $Phase; program = $program; userData = $data; uninstallRegistry = $registry }
}

function Assert-ManifestEqual($Before, $After, [string]$Label) {
  $left = $Before | ConvertTo-Json -Depth 20 -Compress
  $right = $After | ConvertTo-Json -Depth 20 -Compress
  Assert-True ($left -ceq $right) "$Label metadata manifesti degisti."
}

function Invoke-InstallerPhase([string]$Classification) {
  $startedAt = [DateTimeOffset]::UtcNow
  $process = Start-Process -FilePath $InstallerPath -ArgumentList @('/S') -PassThru
  $windowTitles = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  while (-not $process.HasExited) {
    $processIds = [Collections.Generic.HashSet[int]]::new()
    [void]$processIds.Add($process.Id)
    foreach ($child in Get-CimInstance Win32_Process -Filter "ParentProcessId=$($process.Id)" -ErrorAction SilentlyContinue) {
      [void]$processIds.Add([int]$child.ProcessId)
    }
    foreach ($candidate in Get-Process -ErrorAction SilentlyContinue | Where-Object { $processIds.Contains($_.Id) }) {
      if (-not [string]::IsNullOrWhiteSpace($candidate.MainWindowTitle)) { [void]$windowTitles.Add($candidate.MainWindowTitle) }
    }
    Start-Sleep -Milliseconds 100
    $process.Refresh()
  }
  Assert-True ($process.ExitCode -eq 0) "$Classification installer cikis kodu sifir degil: $($process.ExitCode)"
  $selectionDialog = @($windowTitles | Where-Object { $_ -match '(?i)kisisel veri|kişisel veri|personal data|yedek|backup|silme|delete data' }).Count -gt 0
  Assert-True (-not $selectionDialog) "$Classification sirasinda veri secim diyalogu goruldu."
  return [ordered]@{
    classification = $Classification
    exitCode = $process.ExitCode
    dataSelectionDialogObserved = $selectionDialog
    visibleWindowTitleCount = $windowTitles.Count
    startedAt = $startedAt.ToString('O')
    completedAt = [DateTimeOffset]::UtcNow.ToString('O')
  }
}

function Write-AtomicJson([string]$Path, $Value) {
  $target = [IO.Path]::GetFullPath($Path)
  Assert-True (Test-ContainedPath $target $RunRoot) 'Makbuz UUID runRoot disina yazilamaz.'
  Assert-EvidenceRunGuard $script:EvidenceRunGuard
  Assert-NoReparseChain $target $true
  $temporary = "$target.$PID.$([guid]::NewGuid().ToString('N')).tmp"
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 100) + "`n")
  $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  [IO.File]::Move($temporary, $target)
  Assert-EvidenceRunGuard $script:EvidenceRunGuard
  Assert-NoReparseChain $target
  $readback = [IO.File]::ReadAllBytes($target)
  Assert-True ($bytes.Length -eq $readback.Length -and (Get-Sha256Text ([Convert]::ToBase64String($bytes))) -eq (Get-Sha256Text ([Convert]::ToBase64String($readback)))) 'Atomik makbuz readback uyusmuyor.'
  return [ordered]@{ path = $target; sizeBytes = $readback.Length; sha256 = Get-FileSha256 $target }
}

$runStartedAt = [DateTimeOffset]::UtcNow
Assert-True ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'Windows kurulum UAT yonetici oturumu gerektirir.'
foreach ($name in @('InstallerPath', 'PackagedExePath', 'PreviousInstalledExePath', 'PackageProvenance', 'GovernedPreflight', 'InstallerExperienceUat', 'PreviousPackageProvenance')) {
  Set-Variable -Name $name -Value (Resolve-RegularFile (Get-Variable -Name $name -ValueOnly) $name)
}
Assert-True (Test-ContainedPath $PackageProvenance ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation')))) 'PackageProvenance validation kokunun altinda degil.'
Assert-True (Test-ContainedPath $GovernedPreflight ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation')))) 'GovernedPreflight validation kokunun altinda degil.'
Assert-True (Test-ContainedPath $InstallerExperienceUat ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation')))) 'InstallerExperienceUat validation kokunun altinda degil.'
Assert-True (Test-ContainedPath $PreviousPackageProvenance ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\release-history')))) 'PreviousPackageProvenance kanonik immutable release-history kokunun altinda degil.'
Assert-True ([IO.Path]::GetFullPath($PackageProvenance).Equals([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\windows-package-provenance.json')), [StringComparison]::OrdinalIgnoreCase)) 'PackageProvenance kanonik sabit yol degil.'
Assert-True ([IO.Path]::GetFullPath($GovernedPreflight).Equals([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\governed-preflight.json')), [StringComparison]::OrdinalIgnoreCase)) 'GovernedPreflight kanonik sabit yol degil.'
Assert-True ([IO.Path]::GetFullPath($InstalledExePath).Equals($CanonicalInstalledExe, [StringComparison]::OrdinalIgnoreCase)) 'InstalledExePath kanonik Bronze sibling install root altinda degil.'
Assert-True ([IO.Path]::GetFullPath($PreviousInstalledExePath).Equals($CanonicalPreviousInstalledExe, [StringComparison]::OrdinalIgnoreCase)) 'PreviousInstalledExePath kanonik Bronze sibling N runtime degil.'
Assert-True ([IO.Path]::GetFullPath($PreviousInstalledExePath).Equals([IO.Path]::GetFullPath($InstalledExePath), [StringComparison]::OrdinalIgnoreCase)) 'N ve N+1 ayni kanonik Bronze sibling runtime yolunu kullanmalidir.'
Assert-True ($EvidenceCategoryParent.Equals($ValidationBase, [StringComparison]::OrdinalIgnoreCase)) 'EvidenceRoot exact windows-installed-release-uat category parent olmali.'
Assert-True (-not (Test-Path -LiteralPath $RunRoot)) 'Generated UUID runRoot yeni ve bos olmalidir; partial run recover/overwrite edilmez.'
Assert-NoReparseChain $EvidenceCategoryParent $true
Assert-NoReparseChain $RunRoot $true

$nodePath = (Get-Command node -ErrorAction Stop).Source
$verificationJson = & $nodePath $PackageVerifierPath --package-provenance $PackageProvenance --governed-preflight $GovernedPreflight --expected-release-id $ExpectedReleaseId
Assert-True ($LASTEXITCODE -eq 0) 'Package provenance schema2/PR-235 canli readback FAIL oldu.'
$verifiedPackage = $verificationJson | ConvertFrom-Json
Assert-True ($verifiedPackage.status -eq 'PASS') 'Package provenance verifier PASS vermedi.'
$package = Read-JsonFile $PackageProvenance 'PackageProvenance'
$preflight = Read-JsonFile $GovernedPreflight 'GovernedPreflight'
$installerExperience = Read-JsonFile $InstallerExperienceUat 'InstallerExperienceUat'
Assert-True ($package.schemaVersion -eq 2 -and $package.id -eq 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2' -and $package.status -eq 'PASS') 'Package provenance PASS schema2 degil.'
Assert-True ($package.buildMode -eq 'LOCAL_UNSIGNED_NSIS' -and [string]$package.releaseId -ceq $ExpectedReleaseId) 'UAT yalniz exact NotSigned local-test release icindir.'
$applicationVersion = ([string]$package.release).Substring('Bronze '.Length)
$expectedInstallerPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot "apps\desktop\release\ParsYuva-Bronze-$applicationVersion.exe"))
$expectedPackagedPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps\desktop\release\win-unpacked\ParsYuva-Bronze.exe'))
Assert-True ([IO.Path]::GetFullPath($InstallerPath).Equals($expectedInstallerPath, [StringComparison]::OrdinalIgnoreCase)) 'InstallerPath kanonik release artifact degil.'
Assert-True ([IO.Path]::GetFullPath($PackagedExePath).Equals($expectedPackagedPath, [StringComparison]::OrdinalIgnoreCase)) 'PackagedExePath kanonik release runtime degil.'
Assert-True ($installerExperience.schemaVersion -eq 2 -and $installerExperience.status -eq 'PASS' -and $installerExperience.releaseId -eq $ExpectedReleaseId) 'Installer experience UAT exact package/source schema2 PASS degil.'

$packageBinding = [ordered]@{ path = $PackageProvenance; sizeBytes = (Get-Item -LiteralPath $PackageProvenance).Length; sha256 = Get-FileSha256 $PackageProvenance }
$preflightBinding = [ordered]@{ path = $GovernedPreflight; sizeBytes = (Get-Item -LiteralPath $GovernedPreflight).Length; sha256 = Get-FileSha256 $GovernedPreflight }
$installerExperienceBinding = [ordered]@{ path = $InstallerExperienceUat; sizeBytes = (Get-Item -LiteralPath $InstallerExperienceUat).Length; sha256 = Get-FileSha256 $InstallerExperienceUat }
$previousPackageBinding = [ordered]@{ path = $PreviousPackageProvenance; sizeBytes = (Get-Item -LiteralPath $PreviousPackageProvenance).Length; sha256 = Get-FileSha256 $PreviousPackageProvenance }
$producerIdentity = [ordered]@{ path = 'scripts/run-windows-installed-release-uat.ps1'; sizeBytes = (Get-Item -LiteralPath $ProducerPath).Length; sha256 = Get-FileSha256 $ProducerPath }
$installerIdentity = Get-FileIdentity $InstallerPath
$packagedIdentity = Get-FileIdentity $PackagedExePath
$installedBeforeIdentity = Get-FileIdentity $PreviousInstalledExePath
Assert-True ($installerIdentity.authenticodeStatus -eq 'NotSigned' -and $packagedIdentity.authenticodeStatus -eq 'NotSigned') 'Local-test installer/runtime NotSigned sinirinda degil.'
Assert-True ($package.artifacts.installer.sha256 -eq $installerIdentity.sha256 -and [long]$package.artifacts.installer.sizeBytes -eq $installerIdentity.sizeBytes) 'Installer package provenance bagi uyusmuyor.'
Assert-True ($package.artifacts.packagedRuntime.sha256 -eq $packagedIdentity.sha256 -and [long]$package.artifacts.packagedRuntime.sizeBytes -eq $packagedIdentity.sizeBytes) 'Packaged EXE provenance bagi uyusmuyor.'
Assert-True ($installerExperience.installer.sha256 -eq $installerIdentity.sha256 -and $installerExperience.packageProvenance.sha256 -eq $packageBinding.sha256 -and $installerExperience.sourceCommit -eq $verifiedPackage.sourceCommit) 'Installer experience receipt exact installer/package/source ile bagli degil.'

$newVersionMatch = [regex]::Match($packagedIdentity.fileVersion, '^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$')
$oldVersionMatch = [regex]::Match($installedBeforeIdentity.fileVersion, '^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$')
Assert-True ($newVersionMatch.Success -and $oldVersionMatch.Success) 'Installed/packaged FileVersion kanonik degil.'
Assert-True ($newVersionMatch.Groups[2].Value -eq $oldVersionMatch.Groups[2].Value -and $newVersionMatch.Groups[3].Value -eq $oldVersionMatch.Groups[3].Value) 'Yukseltme ayni aylik Bronze release serisinde degil.'
$newSequence = [int]$newVersionMatch.Groups[4].Value
$oldSequence = [int]$oldVersionMatch.Groups[4].Value
Assert-True ($newSequence -eq ($oldSequence + 1)) 'Ilk faz gercek exact N->N+1 surum yukseltmesi degil.'
$oldDate = [DateTime]::new([int]$oldVersionMatch.Groups[3].Value, [int]$oldVersionMatch.Groups[2].Value, [int]$oldVersionMatch.Groups[1].Value)
$newDate = [DateTime]::new([int]$newVersionMatch.Groups[3].Value, [int]$newVersionMatch.Groups[2].Value, [int]$newVersionMatch.Groups[1].Value)
Assert-True ($newDate -ge $oldDate) 'N->N+1 release tarihi monotonik degil.'
$expectedPreviousRelease = "Bronze $($oldVersionMatch.Groups[1].Value.PadLeft(2,'0')).$($oldVersionMatch.Groups[2].Value.PadLeft(2,'0')).$($oldVersionMatch.Groups[3].Value).$oldSequence"
Assert-True ([string]$package.parentRelease -eq $expectedPreviousRelease) 'Package parentRelease canli N release lineage ile uyusmuyor.'
$expectedPreviousBundle = [IO.Path]::GetFullPath((Join-Path $RepoRoot "artifacts\validation\release-history\bronze-$($expectedPreviousRelease.Substring('Bronze '.Length))-windows-package-provenance-bundle\bundle.json"))
Assert-True ([IO.Path]::GetFullPath($PreviousPackageProvenance).Equals($expectedPreviousBundle, [StringComparison]::OrdinalIgnoreCase)) 'PreviousPackageProvenance parent release icin kanonik immutable bundle.json yolu degil; eski tek JSON reddedildi.'
$previousVerifierSource = @'
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [root, bundlePath, parentRelease, currentSequence] = process.argv.slice(1);
const provenanceModule = await import(pathToFileURL(resolve(root, 'scripts/lib/release-source-provenance.mjs')).href);
const packageModule = await import(pathToFileURL(resolve(root, 'scripts/lib/windows-package-provenance.mjs')).href);
const current = await provenanceModule.captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
const verified = await packageModule.verifyPreviousWindowsPackageProvenance({
  root,
  preallocatedRelease: { monthlySequence: Number(currentSequence), parentRelease },
  bundlePath,
  currentProvenance: current.provenance,
  runGit: current.runGit
});
process.stdout.write(JSON.stringify({ status: 'PASS', ...verified }));
'@
$previousVerificationJson = & $nodePath --input-type=module -e $previousVerifierSource -- $RepoRoot $PreviousPackageProvenance $expectedPreviousRelease $newSequence
Assert-True ($LASTEXITCODE -eq 0) 'Previous package canonical history bundle/PR-235/Git readback FAIL oldu.'
$verifiedPreviousPackage = $previousVerificationJson | ConvertFrom-Json
Assert-True ($verifiedPreviousPackage.status -eq 'PASS' -and $verifiedPreviousPackage.release -eq $expectedPreviousRelease) 'Previous package canonical verifier exact N release PASS vermedi.'
Assert-True ($verifiedPreviousPackage.path -eq $previousPackageBinding.path -and [long]$verifiedPreviousPackage.sizeBytes -eq [long]$previousPackageBinding.sizeBytes -and $verifiedPreviousPackage.sha256 -eq $previousPackageBinding.sha256) 'Previous package bundle verifier readback bagi wrapper girdisiyle uyusmuyor.'
Assert-True ($package.previousPackageProvenance.sha256 -eq $verifiedPreviousPackage.sha256 -and [long]$package.previousPackageProvenance.sizeBytes -eq [long]$verifiedPreviousPackage.sizeBytes -and $package.previousPackageProvenance.release -eq $expectedPreviousRelease -and $package.previousPackageProvenance.releaseId -eq $verifiedPreviousPackage.releaseId -and $package.previousPackageProvenance.sourceCommit -eq $verifiedPreviousPackage.sourceCommit -and $package.previousPackageProvenance.producer.sha256 -eq $verifiedPreviousPackage.producer.sha256) 'Current package onceki kanonik bundle verifier sonucuyla bagli degil.'
Assert-True ($verifiedPreviousPackage.packagedRuntime.sha256 -eq $installedBeforeIdentity.sha256 -and [long]$verifiedPreviousPackage.packagedRuntime.sizeBytes -eq $installedBeforeIdentity.sizeBytes -and $installedBeforeIdentity.fileVersion -eq "$([int]$oldVersionMatch.Groups[1].Value).$([int]$oldVersionMatch.Groups[2].Value).$($oldVersionMatch.Groups[3].Value)-$oldSequence") 'Kurulu N runtime dogrulanmis onceki bundle packaged runtime ile canli exact eslesmiyor.'

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
$markerPath = Join-Path $bronzeDataRoot ".ppt-uat-synthetic-preservation-$([guid]::NewGuid().ToString('N')).json"
$markerValue = [ordered]@{ schemaVersion = 1; kind = 'PPT_SYNTHETIC_INSTALLATION_PRESERVATION_MARKER'; expectedReleaseId = $ExpectedReleaseId; nonce = [guid]::NewGuid().ToString('N') }
$markerBytes = [Text.UTF8Encoding]::new($false).GetBytes(($markerValue | ConvertTo-Json -Compress) + "`n")
$markerStream = [IO.File]::Open($markerPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $markerStream.Write($markerBytes, 0, $markerBytes.Length); $markerStream.Flush($true) } finally { $markerStream.Dispose() }
$markerIdentity = [ordered]@{ sizeBytes = $markerBytes.Length; sha256 = Get-FileSha256 $markerPath; kind = $markerValue.kind }

$phaseFailure = $null
try {
  $before = Get-StateSnapshot 'BEFORE_N_TO_N_PLUS_1'
  $upgradeProcess = Invoke-InstallerPhase 'VERSION_UPGRADE_N_TO_N_PLUS_1'
  $installedAfterUpgrade = Get-FileIdentity $InstalledExePath
  Assert-True ($installedAfterUpgrade.sha256 -eq $packagedIdentity.sha256 -and $installedAfterUpgrade.sizeBytes -eq $packagedIdentity.sizeBytes -and $installedAfterUpgrade.fileVersion -eq $packagedIdentity.fileVersion) 'Yukseltme sonrasi installed EXE packaged EXE ile exact degil.'
  $afterUpgrade = Get-StateSnapshot 'AFTER_N_TO_N_PLUS_1'
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.userData[$channel] $afterUpgrade.userData[$channel] "Yukseltme userdata-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.program[$channel] $afterUpgrade.program[$channel] "Yukseltme program-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.uninstallRegistry[$channel] $afterUpgrade.uninstallRegistry[$channel] "Yukseltme registry-$channel" }
  Assert-True ((Get-FileSha256 $markerPath) -eq $markerIdentity.sha256) 'Sentetik Bronze marker yukseltmede korunmadi.'
  $bronzeRegistryAfterUpgrade = Get-BronzeRegistryIdentity $packagedIdentity.fileVersion
  $maintenanceProcess = Invoke-InstallerPhase 'SAME_VERSION_MAINTENANCE'
  $installedAfterMaintenance = Get-FileIdentity $InstalledExePath
  Assert-True ($installedAfterMaintenance.sha256 -eq $packagedIdentity.sha256 -and $installedAfterMaintenance.sizeBytes -eq $packagedIdentity.sizeBytes -and $installedAfterMaintenance.fileVersion -eq $packagedIdentity.fileVersion) 'Maintenance sonrasi installed EXE packaged EXE ile exact degil.'
  $afterMaintenance = Get-StateSnapshot 'AFTER_SAME_VERSION_MAINTENANCE'
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $afterUpgrade.userData[$channel] $afterMaintenance.userData[$channel] "Maintenance userdata-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $afterUpgrade.program[$channel] $afterMaintenance.program[$channel] "Maintenance program-$channel" }
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $afterUpgrade.uninstallRegistry[$channel] $afterMaintenance.uninstallRegistry[$channel] "Maintenance registry-$channel" }
  Assert-True ((Get-FileSha256 $markerPath) -eq $markerIdentity.sha256) 'Sentetik Bronze marker maintenance fazinda korunmadi.'
  $bronzeRegistryAfterMaintenance = Get-BronzeRegistryIdentity $packagedIdentity.fileVersion
  Assert-True (($bronzeRegistryAfterUpgrade | ConvertTo-Json -Compress) -ceq ($bronzeRegistryAfterMaintenance | ConvertTo-Json -Compress)) 'Bronze registry kimligi maintenance fazinda degisti.'
} catch { $phaseFailure = $_ } finally {
  if (Test-Path -LiteralPath $markerPath -PathType Leaf) { Remove-Item -LiteralPath $markerPath -Force }
  if (-not $bronzeDataRootExisted -and (Test-Path -LiteralPath $bronzeDataRoot) -and @(Get-ChildItem -LiteralPath $bronzeDataRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $bronzeDataRoot -Force }
  if (-not $userDataRootExisted -and (Test-Path -LiteralPath $ExpectedUserDataRoot) -and @(Get-ChildItem -LiteralPath $ExpectedUserDataRoot -Force).Count -eq 0) { Remove-Item -LiteralPath $ExpectedUserDataRoot -Force }
}
if ($null -ne $phaseFailure) { throw $phaseFailure }
$postCleanupState = Get-StateSnapshot 'AFTER_SYNTHETIC_MARKER_CLEANUP'
foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $originalState.userData[$channel] $postCleanupState.userData[$channel] "Marker cleanup userdata-$channel" }
Assert-True (-not (Test-Path -LiteralPath $markerPath)) 'Sentetik marker cleanup absence readback FAIL.'
$runCompletedAt = [DateTimeOffset]::UtcNow

$installationReceipt = [ordered]@{
  schemaVersion = 2; id = 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V2'; evidenceKind = 'WINDOWS_INSTALLED_RELEASE_PRESERVATION'; status = 'PASS'; exitCode = 0
  runId = $runId; evidenceRoot = $RunRoot; startedAt = $runStartedAt.ToString('O'); completedAt = $runCompletedAt.ToString('O'); generatedAt = [DateTimeOffset]::UtcNow.ToString('O')
  classification = 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY'; release = [string]$package.release; expectedReleaseId = $ExpectedReleaseId
  sourceCommit = [string]$verifiedPackage.sourceCommit; governedSourceFingerprintSha256 = [string]$verifiedPackage.governedSourceFingerprintSha256; canonicalRuleRegistrySha256 = [string]$verifiedPackage.canonicalRuleRegistrySha256
  producer = $producerIdentity; installer = $installerIdentity; packagedRuntime = $packagedIdentity; installedBefore = $installedBeforeIdentity
  packageProvenance = $packageBinding; governedPreflight = $preflightBinding; installerExperience = $installerExperienceBinding; previousPackageProvenance = $previousPackageBinding
  syntheticMarker = [ordered]@{ sizeBytes = $markerIdentity.sizeBytes; sha256 = $markerIdentity.sha256; kind = $markerIdentity.kind; cleanupStatus = 'DELETED_AND_ABSENCE_READBACK_PASS' }
  privacyBoundary = [ordered]@{ existingUserFileContentsHashedForEquality = $true; existingUserFileContentsRecorded = $false; existingUserFileNamesRecorded = $false; receiptContainsUserContent = $false; contentEqualityMeasured = $true }
  upgrade = [ordered]@{ classification = $upgradeProcess.classification; status = 'PASS'; fromFileVersion = $installedBeforeIdentity.fileVersion; toFileVersion = $installedAfterUpgrade.fileVersion; fromSequence = $oldSequence; toSequence = $newSequence; exactSuccessor = $true; installerProcess = $upgradeProcess; before = $before; after = $afterUpgrade; installedRuntime = $installedAfterUpgrade; installedEqualsPackaged = $true; markerPreserved = $true; allUserDataContentEqualityPreserved = $true; otherChannelAndLegacyProgramMetadataPreserved = $true; otherChannelWriteCount = 0; dataSelectionDialogObserved = $false; bronzeRegistry = $bronzeRegistryAfterUpgrade }
  maintenance = [ordered]@{ classification = $maintenanceProcess.classification; status = 'PASS'; beforeFileVersion = $installedAfterUpgrade.fileVersion; afterFileVersion = $installedAfterMaintenance.fileVersion; sameVersion = $true; installerProcess = $maintenanceProcess; before = $afterUpgrade; after = $afterMaintenance; installedRuntime = $installedAfterMaintenance; installedEqualsPackaged = $true; markerPreserved = $true; allUserDataContentEqualityPreserved = $true; otherChannelAndLegacyProgramMetadataPreserved = $true; otherChannelWriteCount = 0; dataSelectionDialogObserved = $false; bronzeRegistry = $bronzeRegistryAfterMaintenance }
  cleanup = [ordered]@{ markerDeleted = $true; originalUserDataStateRestored = $true; markerAbsentReadback = $true }
  productionRelease = [ordered]@{ eligible = $false; signatureClaim = 'NOT_SIGNED_LOCAL_TEST_ONLY' }
}
$installationBinding = Write-AtomicJson $InstallationReceiptPath $installationReceipt

& $nodePath $RunnerPath --installed-exe $InstalledExePath --package-provenance $PackageProvenance --governed-preflight $GovernedPreflight --evidence-root $InstalledUiEvidenceRoot --expected-release-id $ExpectedReleaseId --installation-preservation $InstallationReceiptPath --parent-run-id $runId --output $InstalledUiReceiptPath
Assert-True ($LASTEXITCODE -eq 0) 'Installed frontend UAT runner FAIL oldu.'
$installedUi = Read-JsonFile $InstalledUiReceiptPath 'installed-frontend-user-uat111'
Assert-True ($installedUi.schemaVersion -eq 3 -and $installedUi.status -eq 'PASS' -and $installedUi.parentRunId -eq $runId -and $installedUi.runId -ne $runId) 'Installed frontend UAT111 envelope/run identity gecersiz.'
Assert-True ([string]$installedUi.sourceCommit -eq [string]$verifiedPackage.sourceCommit -and [string]$installedUi.releaseId -eq $ExpectedReleaseId) 'UAT111 source/release bagi stale.'
Assert-True ([string]$installedUi.installationPreservationSha256 -eq $installationBinding.sha256 -and [string]$installedUi.receiptBindings.installationPreservationSha256 -eq $installationBinding.sha256 -and [string]$installedUi.receiptBindings.packageProvenanceSha256 -eq $packageBinding.sha256) 'UAT111 receipt SHA bagi stale.'
$uiBinding = [ordered]@{ path = $InstalledUiReceiptPath; sizeBytes = (Get-Item -LiteralPath $InstalledUiReceiptPath).Length; sha256 = Get-FileSha256 $InstalledUiReceiptPath }
Assert-EvidenceRunGuard $script:EvidenceRunGuard
Close-EvidenceRunGuard $script:EvidenceRunGuard
[ordered]@{ status = 'PASS'; expectedReleaseId = $ExpectedReleaseId; runId = $runId; installationPreservation = $installationBinding; installedFrontend = $uiBinding } | ConvertTo-Json -Depth 20 -Compress
