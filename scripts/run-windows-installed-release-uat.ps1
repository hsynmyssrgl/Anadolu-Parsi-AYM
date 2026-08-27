[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerPath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PackagedExePath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstalledExePath,
  [Parameter()][AllowEmptyString()][string]$PreviousInstalledExePath = '',
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$PackageProvenance,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$GovernedPreflight,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerExperienceUat,
  [Parameter()][AllowEmptyString()][string]$PreviousPackageProvenance = '',
  [Parameter()][AllowEmptyString()][string]$TechnicalPredecessorPreparation = '',
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
$TechnicalPredecessorValidationBase = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\windows-technical-predecessor-preparation'))
$TechnicalPredecessorProducerPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'scripts\run-windows-technical-predecessor-preparation.ps1'))
$ReleaseLedgerPath = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'config\release-ledger.json'))
$ExpectedTechnicalInstalledBundle = [IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\release-history\bronze-26.08.2026.51-windows-package-provenance-bundle\bundle.json'))
$InstallationReceiptPath = [IO.Path]::GetFullPath((Join-Path $RunRoot 'windows-installed-release-uat110.json'))
$InstalledUiEvidenceRoot = [IO.Path]::GetFullPath((Join-Path $RunRoot 'installed-frontend'))
$InstalledUiReceiptPath = [IO.Path]::GetFullPath((Join-Path $InstalledUiEvidenceRoot 'installed-frontend-user-uat111.json'))

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Test-NonNegativeSafeInteger($Value) {
  return (($Value -is [int]) -or ($Value -is [long])) -and [long]$Value -ge 0 -and [long]$Value -le 9007199254740991
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

function Get-FileBinding([string]$Path, [string]$Label) {
  $full = Resolve-RegularFile $Path $Label
  $item = Get-Item -LiteralPath $full -Force
  return [ordered]@{ path = $full; sizeBytes = [long]$item.Length; sha256 = Get-FileSha256 $full }
}

function Assert-BindingEqual($Expected, $Actual, [string]$Label) {
  Assert-True ([IO.Path]::GetFullPath([string]$Expected.path).Equals([IO.Path]::GetFullPath([string]$Actual.path), [StringComparison]::OrdinalIgnoreCase) -and
    [long]$Expected.sizeBytes -eq [long]$Actual.sizeBytes -and [string]$Expected.sha256 -ceq [string]$Actual.sha256) "$Label path/size/SHA-256 bagi degisti."
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
  $roots = @(
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($registryRoot in $roots) {
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
  Assert-True ($matches.Count -eq 1) 'Bronze uninstall registry kaydi exact tekil degil.'
  $entry = $matches[0]
  $expectedDisplayIcon = "$CanonicalInstalledExe,0"
  $expectedUninstaller = Join-Path $CanonicalInstallRoot 'Uninstall ParsYuva-Bronze.exe'
  $expectedUninstallString = '"' + $expectedUninstaller + '" /allusers'
  $expectedQuietUninstallString = "$expectedUninstallString /S"
  Assert-True ([string]$entry.DisplayName -ceq $expectedDisplayName) 'Bronze uninstall DisplayName packaged surumle exact uyusmuyor.'
  Assert-True ([string]$entry.DisplayVersion -ceq $ExpectedVersion) 'Bronze uninstall DisplayVersion packaged surumle uyusmuyor.'
  Assert-True ([string]$entry.DisplayIcon -ceq $expectedDisplayIcon) 'Bronze DisplayIcon expected EXE ile exact bagli degil.'
  Assert-True ([string]$entry.UninstallString -ceq $expectedUninstallString) 'Bronze UninstallString sibling install root ile exact bagli degil.'
  Assert-True ([string]$entry.QuietUninstallString -ceq $expectedQuietUninstallString) 'Bronze QuietUninstallString sibling install root ile exact bagli degil.'
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
foreach ($name in @('InstallerPath', 'PackagedExePath', 'PackageProvenance', 'GovernedPreflight', 'InstallerExperienceUat')) {
  Set-Variable -Name $name -Value (Resolve-RegularFile (Get-Variable -Name $name -ValueOnly) $name)
}
Assert-True (Test-ContainedPath $PackageProvenance ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation')))) 'PackageProvenance validation kokunun altinda degil.'
Assert-True (Test-ContainedPath $GovernedPreflight ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation')))) 'GovernedPreflight validation kokunun altinda degil.'
Assert-True (Test-ContainedPath $InstallerExperienceUat ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation')))) 'InstallerExperienceUat validation kokunun altinda degil.'
Assert-True ([IO.Path]::GetFullPath($PackageProvenance).Equals([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\windows-package-provenance.json')), [StringComparison]::OrdinalIgnoreCase)) 'PackageProvenance kanonik sabit yol degil.'
Assert-True ([IO.Path]::GetFullPath($GovernedPreflight).Equals([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\governed-preflight.json')), [StringComparison]::OrdinalIgnoreCase)) 'GovernedPreflight kanonik sabit yol degil.'
Assert-True ([IO.Path]::GetFullPath($InstalledExePath).Equals($CanonicalInstalledExe, [StringComparison]::OrdinalIgnoreCase)) 'InstalledExePath kanonik Bronze sibling install root altinda degil.'
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
Assert-True ($installerExperience.window.visualContentVerified -eq $true) 'Installer experience UAT sag icerik gorsel dogrulamasi PASS degil.'
Assert-True (@($installerExperience.screenshots).Count -eq 3 -and @($installerExperience.screenshots | Where-Object {
  $_.visualContentStatus -ne 'PASS' -or
  -not (Test-NonNegativeSafeInteger $_.captureAttempts) -or [long]$_.captureAttempts -lt 1 -or [long]$_.captureAttempts -gt 3 -or
  -not (Test-NonNegativeSafeInteger $_.printWindowFlags) -or [long]$_.printWindowFlags -ne 2 -or
  -not (Test-NonNegativeSafeInteger $_.width) -or [long]$_.width -lt 1 -or
  -not (Test-NonNegativeSafeInteger $_.height) -or [long]$_.height -lt 1 -or
  $null -eq $_.contentRegion -or
  -not (Test-NonNegativeSafeInteger $_.contentRegion.left) -or
  -not (Test-NonNegativeSafeInteger $_.contentRegion.top) -or
  -not (Test-NonNegativeSafeInteger $_.contentRegion.width) -or [long]$_.contentRegion.width -lt 24 -or
  -not (Test-NonNegativeSafeInteger $_.contentRegion.height) -or [long]$_.contentRegion.height -lt 12 -or
  ([long]$_.contentRegion.left + [long]$_.contentRegion.width) -gt [long]$_.width -or
  ([long]$_.contentRegion.top + [long]$_.contentRegion.height) -gt [long]$_.height -or
  -not (Test-NonNegativeSafeInteger $_.backgroundSampleCount) -or [long]$_.backgroundSampleCount -ne 8 -or
  -not (Test-NonNegativeSafeInteger $_.contentContrastPixelCount) -or [long]$_.contentContrastPixelCount -lt 40 -or
  -not (Test-NonNegativeSafeInteger $_.contentOccupiedRows) -or [long]$_.contentOccupiedRows -lt 6 -or
  -not (Test-NonNegativeSafeInteger $_.contentOccupiedColumns) -or [long]$_.contentOccupiedColumns -lt 12 -or
  -not (Test-NonNegativeSafeInteger $_.contentDarkPixelCount) -or [long]$_.contentDarkPixelCount -lt 40 -or
  -not (Test-NonNegativeSafeInteger $_.contentDarkOccupiedRows) -or [long]$_.contentDarkOccupiedRows -lt 6 -or
  -not (Test-NonNegativeSafeInteger $_.contentDarkOccupiedColumns) -or [long]$_.contentDarkOccupiedColumns -lt 12
}).Count -eq 0) 'Installer experience UAT uc ekranin title-region piksel kanitini tasimiyor.'

$packageBinding = [ordered]@{ path = $PackageProvenance; sizeBytes = (Get-Item -LiteralPath $PackageProvenance).Length; sha256 = Get-FileSha256 $PackageProvenance }
$preflightBinding = [ordered]@{ path = $GovernedPreflight; sizeBytes = (Get-Item -LiteralPath $GovernedPreflight).Length; sha256 = Get-FileSha256 $GovernedPreflight }
$installerExperienceBinding = [ordered]@{ path = $InstallerExperienceUat; sizeBytes = (Get-Item -LiteralPath $InstallerExperienceUat).Length; sha256 = Get-FileSha256 $InstallerExperienceUat }
$producerIdentity = [ordered]@{ path = 'scripts/run-windows-installed-release-uat.ps1'; sizeBytes = (Get-Item -LiteralPath $ProducerPath).Length; sha256 = Get-FileSha256 $ProducerPath }
$installerIdentity = Get-FileIdentity $InstallerPath
$packagedIdentity = Get-FileIdentity $PackagedExePath
Assert-True ($installerIdentity.authenticodeStatus -eq 'NotSigned' -and $packagedIdentity.authenticodeStatus -eq 'NotSigned') 'Local-test installer/runtime NotSigned sinirinda degil.'
Assert-True ($package.artifacts.installer.sha256 -eq $installerIdentity.sha256 -and [long]$package.artifacts.installer.sizeBytes -eq $installerIdentity.sizeBytes) 'Installer package provenance bagi uyusmuyor.'
Assert-True ($package.artifacts.packagedRuntime.sha256 -eq $packagedIdentity.sha256 -and [long]$package.artifacts.packagedRuntime.sizeBytes -eq $packagedIdentity.sizeBytes) 'Packaged EXE provenance bagi uyusmuyor.'
Assert-True ($installerExperience.installer.sha256 -eq $installerIdentity.sha256 -and $installerExperience.packageProvenance.sha256 -eq $packageBinding.sha256 -and $installerExperience.sourceCommit -eq $verifiedPackage.sourceCommit) 'Installer experience receipt exact installer/package/source ile bagli degil.'

$packageVersionMatch = [regex]::Match([string]$package.packageVersion, '^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$')
Assert-True ($packageVersionMatch.Success) 'Package packageVersion day.month.year-sequence biciminde kanonik degil.'
$packageDay = [int]$packageVersionMatch.Groups[1].Value
$packageMonth = [int]$packageVersionMatch.Groups[2].Value
$packageYear = [int]$packageVersionMatch.Groups[3].Value
$packageSequence = [int]$packageVersionMatch.Groups[4].Value
try { [void][DateTime]::new($packageYear, $packageMonth, $packageDay) } catch { throw 'Package packageVersion gecerli bir release takvim tarihi tasimiyor.' }
$expectedPackageVersion = "$packageDay.$packageMonth.$packageYear-$packageSequence"
$expectedVisibleVersion = '{0:D2}.{1:D2}.{2}.{3}' -f $packageDay, $packageMonth, $packageYear, $packageSequence
$expectedVisibleRelease = "Bronze $expectedVisibleVersion"
Assert-True ([string]$package.packageVersion -ceq $expectedPackageVersion) 'Package packageVersion normalize day.month.year-sequence kimligiyle exact degil.'
Assert-True ([string]$packagedIdentity.fileVersion -ceq [string]$package.packageVersion) 'Packaged EXE FileVersion package.packageVersion ile exact bagli degil.'
Assert-True ([string]$installerIdentity.fileVersion -ceq [string]$package.packageVersion) 'Installer FileVersion package.packageVersion ile exact bagli degil.'
Assert-True ([string]$package.version -ceq $expectedVisibleVersion) 'Package version DD.MM.YYYY.sequence kimligiyle exact bagli degil.'
Assert-True ([string]$package.release -ceq $expectedVisibleRelease) 'Package release Bronze DD.MM.YYYY.sequence kimligiyle exact bagli degil.'

$newVersionMatch = [regex]::Match($packagedIdentity.fileVersion, '^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$')
Assert-True ($newVersionMatch.Success) 'Packaged FileVersion kanonik degil.'
$newSequence = [int]$newVersionMatch.Groups[4].Value
$isGovernedBootstrap = $newSequence -eq 50
$isRecoveryBootstrap = $newSequence -eq 51
$isFreshInstallBootstrap = $isGovernedBootstrap -or $isRecoveryBootstrap
$requiresTechnicalPredecessorPreparation = [string]$package.release -ceq 'Bronze 27.08.2026.53' -and
  [string]$package.releaseId -ceq 'bronze-2026-08-27-r53' -and
  [string]$package.packageVersion -ceq '27.8.2026-53'
Assert-True ($newSequence -ge 50) 'Package sequence governed predecessor sinirinin altindadir.'
if ($requiresTechnicalPredecessorPreparation) {
  Assert-True (-not [string]::IsNullOrWhiteSpace($TechnicalPredecessorPreparation)) 'Bronze 53 exact teknik predecessor preparation makbuzu zorunludur.'
} else {
  Assert-True ([string]::IsNullOrWhiteSpace($TechnicalPredecessorPreparation)) 'TechnicalPredecessorPreparation yalniz exact Bronze 27.08.2026.53/r53 icin kabul edilir.'
}
$parentReleaseMatch = [regex]::Match([string]$package.parentRelease, '^Bronze (\d{2})\.(\d{2})\.(\d{4})\.(\d+)$')
Assert-True ($parentReleaseMatch.Success -and [int]$parentReleaseMatch.Groups[2].Value -eq [int]$newVersionMatch.Groups[2].Value -and [int]$parentReleaseMatch.Groups[3].Value -eq [int]$newVersionMatch.Groups[3].Value -and [int]$parentReleaseMatch.Groups[4].Value -eq ($newSequence - 1)) 'Package parentRelease exact ayni-ay predecessor lineage ile uyusmuyor.'
$expectedPreviousRelease = $null
$previousPackageBinding = $null
$verifiedPreviousPackage = $null
$installedBeforeIdentity = $null
$oldSequence = $null
$technicalPredecessorPreparationBinding = $null
$technicalPredecessorPreparationReceipt = $null
$technicalPredecessorProducerBinding = $null
$technicalPredecessorReleaseLedgerBinding = $null
$technicalPredecessorImmediateReadback = $null
$technicalPredecessorReadback = $null
if ($isGovernedBootstrap) {
  Assert-True ($null -eq $package.previousPackageProvenance) 'Bronze 50 governed bootstrap onceki paket self-claim tasiyamaz.'
  Assert-True ([string]::IsNullOrWhiteSpace($PreviousPackageProvenance) -and [string]::IsNullOrWhiteSpace($PreviousInstalledExePath)) 'Bronze 50 governed bootstrap onceki paket/runtime girdisi kabul etmez.'
  Assert-True (-not (Test-Path -LiteralPath $InstalledExePath)) 'Bronze 50 governed bootstrap fresh-install oncesinde kanonik EXE bulunmamalidir.'
} else {
  Assert-True (-not [string]::IsNullOrWhiteSpace($PreviousPackageProvenance)) 'Bronze 51+ exact parent package history bundle girdisi zorunludur.'
  $PreviousPackageProvenance = Resolve-RegularFile $PreviousPackageProvenance 'PreviousPackageProvenance'
  Assert-True (Test-ContainedPath $PreviousPackageProvenance ([IO.Path]::GetFullPath((Join-Path $RepoRoot 'artifacts\validation\release-history')))) 'PreviousPackageProvenance kanonik immutable release-history kokunun altinda degil.'
  $previousPackageBinding = [ordered]@{ path = $PreviousPackageProvenance; sizeBytes = (Get-Item -LiteralPath $PreviousPackageProvenance).Length; sha256 = Get-FileSha256 $PreviousPackageProvenance }
  if ($isRecoveryBootstrap) {
    Assert-True ([string]$package.release -ceq 'Bronze 26.08.2026.51' -and [string]$package.releaseId -ceq 'bronze-2026-08-26-r51' -and [string]$package.parentRelease -ceq 'Bronze 22.08.2026.50') 'Bronze 51 yalniz exact rejected-50 recovery bootstrap kimligiyle kullanilabilir.'
    Assert-True ([string]::IsNullOrWhiteSpace($PreviousInstalledExePath)) 'Bronze 51 recovery bootstrap trusted installed predecessor runtime kabul etmez.'
    Assert-True (-not (Test-Path -LiteralPath $InstalledExePath)) 'Bronze 51 recovery bootstrap fresh-install oncesinde kanonik EXE bulunmamalidir.'
    Assert-True ($package.previousPackageProvenance.lineageRole -ceq 'REJECTED_PARENT_HISTORY_ANCHOR_ONLY' -and $package.previousPackageProvenance.trustedInstalledPredecessor -eq $false -and $package.previousPackageProvenance.recoveryBootstrap.decision -ceq 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50' -and $package.previousPackageProvenance.recoveryBootstrap.parentStatus -ceq 'REJECTED_INVALID_PACKAGE' -and [int]$package.previousPackageProvenance.recoveryBootstrap.currentSequence -eq 51 -and [int]$package.previousPackageProvenance.recoveryBootstrap.parentSequence -eq 50) 'Bronze 51 recovery package rejected-50 history-only authority bagini tasimiyor.'
    $oldSequence = 50
    $expectedPreviousRelease = 'Bronze 22.08.2026.50'
  } else {
    Assert-True (-not [string]::IsNullOrWhiteSpace($PreviousInstalledExePath)) 'Bronze 52+ exact installed N runtime girdisi zorunludur.'
    $PreviousInstalledExePath = Resolve-RegularFile $PreviousInstalledExePath 'PreviousInstalledExePath'
    Assert-True ([IO.Path]::GetFullPath($PreviousInstalledExePath).Equals($CanonicalPreviousInstalledExe, [StringComparison]::OrdinalIgnoreCase)) 'PreviousInstalledExePath kanonik Bronze sibling N runtime degil.'
    Assert-True ([IO.Path]::GetFullPath($PreviousInstalledExePath).Equals([IO.Path]::GetFullPath($InstalledExePath), [StringComparison]::OrdinalIgnoreCase)) 'N ve N+1 ayni kanonik Bronze sibling runtime yolunu kullanmalidir.'
    $installedBeforeIdentity = Get-FileIdentity $PreviousInstalledExePath
    $oldVersionMatch = [regex]::Match($installedBeforeIdentity.fileVersion, '^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$')
    Assert-True ($oldVersionMatch.Success) 'Installed N FileVersion kanonik degil.'
    Assert-True ($newVersionMatch.Groups[2].Value -eq $oldVersionMatch.Groups[2].Value -and $newVersionMatch.Groups[3].Value -eq $oldVersionMatch.Groups[3].Value) 'Yukseltme ayni aylik Bronze release serisinde degil.'
    $oldSequence = [int]$oldVersionMatch.Groups[4].Value
    Assert-True ($newSequence -eq ($oldSequence + 1)) 'Ilk faz gercek exact N->N+1 surum yukseltmesi degil.'
    $expectedPreviousRelease = "Bronze $($oldVersionMatch.Groups[1].Value.PadLeft(2,'0')).$($oldVersionMatch.Groups[2].Value.PadLeft(2,'0')).$($oldVersionMatch.Groups[3].Value).$oldSequence"
    Assert-True ([string]$package.parentRelease -eq $expectedPreviousRelease) 'Package parentRelease canli installed N release kimligiyle uyusmuyor.'
    $oldDate = [DateTime]::new([int]$oldVersionMatch.Groups[3].Value, [int]$oldVersionMatch.Groups[2].Value, [int]$oldVersionMatch.Groups[1].Value)
    $newDate = [DateTime]::new([int]$newVersionMatch.Groups[3].Value, [int]$newVersionMatch.Groups[2].Value, [int]$newVersionMatch.Groups[1].Value)
    Assert-True ($newDate -ge $oldDate) 'N->N+1 release tarihi monotonik degil.'
  }
  $expectedPreviousBundle = [IO.Path]::GetFullPath((Join-Path $RepoRoot "artifacts\validation\release-history\bronze-$($expectedPreviousRelease.Substring('Bronze '.Length))-windows-package-provenance-bundle\bundle.json"))
  Assert-True ([IO.Path]::GetFullPath($PreviousPackageProvenance).Equals($expectedPreviousBundle, [StringComparison]::OrdinalIgnoreCase)) 'PreviousPackageProvenance parent release icin kanonik immutable bundle.json yolu degil; eski tek JSON reddedildi.'
  $previousVerifierSource = @'
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [root, bundlePath, parentRelease, currentSequence, visibleRelease, releaseId, recoveryBootstrapDecision] = process.argv.slice(1);
const provenanceModule = await import(pathToFileURL(resolve(root, 'scripts/lib/release-source-provenance.mjs')).href);
const packageModule = await import(pathToFileURL(resolve(root, 'scripts/lib/windows-package-provenance.mjs')).href);
const current = await provenanceModule.captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' });
const verified = await packageModule.verifyPreviousWindowsPackageProvenance({
  root,
  preallocatedRelease: { monthlySequence: Number(currentSequence), parentRelease, visibleRelease, releaseId, recoveryBootstrapDecision },
  bundlePath,
  currentProvenance: current.provenance,
  runGit: current.runGit
});
process.stdout.write(JSON.stringify({ status: 'PASS', ...verified }));
'@
  $recoveryBootstrapDecisionArgument = if ($isRecoveryBootstrap) { [string]$package.previousPackageProvenance.recoveryBootstrap.decision } else { 'NOT_APPLICABLE' }
  $previousVerificationJson = & $nodePath --input-type=module -e $previousVerifierSource -- $RepoRoot $PreviousPackageProvenance $expectedPreviousRelease $newSequence ([string]$package.release) ([string]$package.releaseId) $recoveryBootstrapDecisionArgument
  Assert-True ($LASTEXITCODE -eq 0) 'Previous package canonical history bundle/PR-235/Git readback FAIL oldu.'
  $verifiedPreviousPackage = $previousVerificationJson | ConvertFrom-Json
  Assert-True ($verifiedPreviousPackage.status -eq 'PASS' -and $verifiedPreviousPackage.release -eq $expectedPreviousRelease) 'Previous package canonical verifier exact N release PASS vermedi.'
  Assert-True ($verifiedPreviousPackage.path -eq $previousPackageBinding.path -and [long]$verifiedPreviousPackage.sizeBytes -eq [long]$previousPackageBinding.sizeBytes -and $verifiedPreviousPackage.sha256 -eq $previousPackageBinding.sha256) 'Previous package bundle verifier readback bagi wrapper girdisiyle uyusmuyor.'
  Assert-True ($package.previousPackageProvenance.sha256 -eq $verifiedPreviousPackage.sha256 -and [long]$package.previousPackageProvenance.sizeBytes -eq [long]$verifiedPreviousPackage.sizeBytes -and $package.previousPackageProvenance.release -eq $expectedPreviousRelease -and $package.previousPackageProvenance.releaseId -eq $verifiedPreviousPackage.releaseId -and $package.previousPackageProvenance.sourceCommit -eq $verifiedPreviousPackage.sourceCommit -and $package.previousPackageProvenance.producer.sha256 -eq $verifiedPreviousPackage.producer.sha256) 'Current package onceki kanonik bundle verifier sonucuyla bagli degil.'
  if ($isRecoveryBootstrap) {
    Assert-True ($verifiedPreviousPackage.lineageRole -ceq 'REJECTED_PARENT_HISTORY_ANCHOR_ONLY' -and $verifiedPreviousPackage.trustedInstalledPredecessor -eq $false -and $verifiedPreviousPackage.recoveryBootstrap.decision -ceq 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50' -and $verifiedPreviousPackage.recoveryBootstrap.parentStatus -ceq 'REJECTED_INVALID_PACKAGE') 'Verified Bronze 50 parent recovery bootstrap icin history-anchor-only olarak siniflanmadi.'
    Assert-True ($package.previousPackageProvenance.lineageRole -ceq $verifiedPreviousPackage.lineageRole -and $package.previousPackageProvenance.trustedInstalledPredecessor -eq $verifiedPreviousPackage.trustedInstalledPredecessor -and $package.previousPackageProvenance.recoveryBootstrap.decision -ceq $verifiedPreviousPackage.recoveryBootstrap.decision -and $package.previousPackageProvenance.recoveryBootstrap.parentStatus -ceq $verifiedPreviousPackage.recoveryBootstrap.parentStatus -and $package.previousPackageProvenance.recoveryBootstrap.releaseLedger.sha256 -ceq $verifiedPreviousPackage.recoveryBootstrap.releaseLedger.sha256 -and [long]$package.previousPackageProvenance.recoveryBootstrap.releaseLedger.sizeBytes -eq [long]$verifiedPreviousPackage.recoveryBootstrap.releaseLedger.sizeBytes) 'Current package recovery predecessor self-claim canonical verifier sonucuyla exact bagli degil.'
  } else {
    Assert-True ($verifiedPreviousPackage.packagedRuntime.sha256 -eq $installedBeforeIdentity.sha256 -and [long]$verifiedPreviousPackage.packagedRuntime.sizeBytes -eq $installedBeforeIdentity.sizeBytes -and $installedBeforeIdentity.fileVersion -eq "$([int]$oldVersionMatch.Groups[1].Value).$([int]$oldVersionMatch.Groups[2].Value).$($oldVersionMatch.Groups[3].Value)-$oldSequence") 'Kurulu N runtime dogrulanmis onceki bundle packaged runtime ile canli exact eslesmiyor.'
  }
}

if ($requiresTechnicalPredecessorPreparation) {
  Assert-True ([string]$package.release -ceq 'Bronze 27.08.2026.53' -and
    [string]$package.releaseId -ceq 'bronze-2026-08-27-r53' -and
    [string]$package.packageVersion -ceq '27.8.2026-53' -and
    [string]$package.parentRelease -ceq 'Bronze 27.08.2026.52') 'Technical predecessor preparation yalniz exact Bronze 53 consumer kimligiyle kullanilabilir.'
  $TechnicalPredecessorPreparation = Resolve-RegularFile $TechnicalPredecessorPreparation 'TechnicalPredecessorPreparation'
  $technicalPredecessorRunRoot = [IO.Path]::GetFullPath((Split-Path -Parent $TechnicalPredecessorPreparation))
  $technicalPredecessorCategoryParent = [IO.Path]::GetFullPath((Split-Path -Parent $technicalPredecessorRunRoot))
  $technicalPredecessorRunId = Split-Path -Leaf $technicalPredecessorRunRoot
  $technicalPredecessorParsedRunId = [guid]::Empty
  Assert-True ([guid]::TryParseExact($technicalPredecessorRunId, 'D', [ref]$technicalPredecessorParsedRunId) -and
    $technicalPredecessorRunId -cmatch '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' -and
    $technicalPredecessorParsedRunId.ToString('D') -ceq $technicalPredecessorRunId) 'TechnicalPredecessorPreparation kanonik lowercase UUID-v4 run klasoru tasimiyor.'
  Assert-True ($technicalPredecessorCategoryParent.Equals($TechnicalPredecessorValidationBase, [StringComparison]::OrdinalIgnoreCase)) 'TechnicalPredecessorPreparation exact kanonik kategori kokunun altinda degil.'
  $expectedTechnicalPredecessorReceipt = [IO.Path]::GetFullPath((Join-Path $technicalPredecessorRunRoot 'windows-technical-predecessor-preparation.json'))
  Assert-True ([IO.Path]::GetFullPath($TechnicalPredecessorPreparation).Equals($expectedTechnicalPredecessorReceipt, [StringComparison]::OrdinalIgnoreCase)) 'TechnicalPredecessorPreparation kanonik UUID receipt yolu degil.'
  Assert-NoReparseChain $TechnicalPredecessorPreparation
  $technicalPredecessorPreparationBinding = Get-FileBinding $TechnicalPredecessorPreparation 'TechnicalPredecessorPreparation'
  $technicalPredecessorPreparationReceipt = Read-JsonFile $TechnicalPredecessorPreparation 'TechnicalPredecessorPreparation'
  $technicalPredecessorProducerBinding = Get-FileBinding $TechnicalPredecessorProducerPath 'technical predecessor producer'
  $technicalPredecessorReleaseLedgerBinding = Get-FileBinding $ReleaseLedgerPath 'release ledger'
  $technicalInstalledBundleBinding = Get-FileBinding $ExpectedTechnicalInstalledBundle 'immutable Bronze 51 bundle'

  Assert-True ([int]$technicalPredecessorPreparationReceipt.schemaVersion -eq 1 -and
    [string]$technicalPredecessorPreparationReceipt.id -ceq 'PPT-WINDOWS-TECHNICAL-PREDECESSOR-PREPARATION-V1' -and
    [string]$technicalPredecessorPreparationReceipt.evidenceKind -ceq 'WINDOWS_TECHNICAL_PREDECESSOR_PREPARATION' -and
    [string]$technicalPredecessorPreparationReceipt.status -ceq 'PASS' -and
    [int]$technicalPredecessorPreparationReceipt.exitCode -eq 0 -and
    [string]$technicalPredecessorPreparationReceipt.runId -ceq $technicalPredecessorRunId -and
    [IO.Path]::GetFullPath([string]$technicalPredecessorPreparationReceipt.evidenceRoot).Equals($technicalPredecessorRunRoot, [StringComparison]::OrdinalIgnoreCase)) 'Technical predecessor preparation envelope/UUID/runRoot exact degil.'
  $technicalPredecessorStartedAt = [DateTimeOffset]::Parse([string]$technicalPredecessorPreparationReceipt.startedAt)
  $technicalPredecessorCompletedAt = [DateTimeOffset]::Parse([string]$technicalPredecessorPreparationReceipt.completedAt)
  Assert-True ($technicalPredecessorCompletedAt -ge $technicalPredecessorStartedAt -and $technicalPredecessorCompletedAt -le $runStartedAt) 'Technical predecessor preparation zaman sirasi UAT110 oncesi exact degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.installationMode -ceq 'TECHNICAL_PREDECESSOR_PREPARATION_ONLY' -and
    $technicalPredecessorPreparationReceipt.releaseAcceptanceClaimed -eq $false -and
    $technicalPredecessorPreparationReceipt.deliveryEligible -eq $false -and
    $technicalPredecessorPreparationReceipt.targetPackageDeliveryPassClaimed -eq $false -and
    $technicalPredecessorPreparationReceipt.interactiveInstallerUiExercised -eq $false -and
    $technicalPredecessorPreparationReceipt.applicationLaunchAttempted -eq $false) 'Technical predecessor preparation kabul/teslim siniri gecersiz.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.fromRelease -ceq 'Bronze 26.08.2026.51' -and
    [string]$technicalPredecessorPreparationReceipt.fromReleaseId -ceq 'bronze-2026-08-26-r51' -and
    [string]$technicalPredecessorPreparationReceipt.toRelease -ceq 'Bronze 27.08.2026.52' -and
    [string]$technicalPredecessorPreparationReceipt.toReleaseId -ceq 'bronze-2026-08-27-r52' -and
    [string]$technicalPredecessorPreparationReceipt.consumerRelease -ceq 'Bronze 27.08.2026.53' -and
    [string]$technicalPredecessorPreparationReceipt.consumerReleaseId -ceq 'bronze-2026-08-27-r53') 'Technical predecessor preparation .51/.52/.53 release zinciri exact degil.'
  Assert-True (($technicalPredecessorPreparationReceipt.currentSource | ConvertTo-Json -Depth 100 -Compress) -ceq
    ($package.sourceProvenance | ConvertTo-Json -Depth 100 -Compress)) 'Technical predecessor preparation current source exact Bronze 53 package source ile bagli degil.'
  Assert-True ($technicalPredecessorPreparationReceipt.currentSource.worktreeClean -eq $true -and
    $technicalPredecessorPreparationReceipt.currentSource.sharedGitObjectDatabaseVerified -eq $true -and
    [string]$technicalPredecessorPreparationReceipt.currentSource.headCommit -ceq [string]$verifiedPackage.sourceCommit -and
    [string]$technicalPredecessorPreparationReceipt.currentSource.governedSourceFingerprint.sha256 -ceq [string]$verifiedPackage.governedSourceFingerprintSha256) 'Technical predecessor preparation canli temiz source/Git/fingerprint bagi gecersiz.'
  Assert-BindingEqual $technicalPredecessorPreparationReceipt.producer $technicalPredecessorProducerBinding 'Technical predecessor producer'
  Assert-True ([IO.Path]::IsPathRooted([string]$technicalPredecessorPreparationReceipt.producer.path) -and
    [IO.Path]::GetFullPath([string]$technicalPredecessorPreparationReceipt.producer.path).Equals($TechnicalPredecessorProducerPath, [StringComparison]::OrdinalIgnoreCase)) 'Technical predecessor producer kanonik absolute script yolu degil.'
  Assert-True ([IO.Path]::IsPathRooted([string]$technicalPredecessorPreparationReceipt.lifecycleAuthority.releaseLedger.path)) 'Technical predecessor release ledger yolu absolute degil.'
  Assert-BindingEqual $technicalPredecessorPreparationReceipt.lifecycleAuthority.releaseLedger $technicalPredecessorReleaseLedgerBinding 'Technical predecessor release ledger'

  $technicalReleaseLedger = Read-JsonFile $ReleaseLedgerPath 'release ledger'
  $technicalTargetLedgerEntries = @($technicalReleaseLedger.entries | Where-Object { [string]$_.releaseId -ceq 'bronze-2026-08-27-r52' })
  $technicalConsumerLedgerEntries = @($technicalReleaseLedger.entries | Where-Object { [string]$_.releaseId -ceq 'bronze-2026-08-27-r53' })
  Assert-True ($technicalTargetLedgerEntries.Count -eq 1 -and
    [string]$technicalTargetLedgerEntries[0].version -ceq '27.08.2026.52' -and
    [string]$technicalTargetLedgerEntries[0].status -ceq 'REJECTED_INSTALLER_VISUAL_UAT_FAIL' -and
    [string]$technicalTargetLedgerEntries[0].rejection.effectiveStatus -ceq 'REJECTED_INSTALLER_VISUAL_UAT_FAIL' -and
    $technicalTargetLedgerEntries[0].rejection.countsAsDeliveryPass -eq $false -and
    $technicalTargetLedgerEntries[0].rejection.immutablePackageHistoryRewritten -eq $false -and
    [string]$technicalTargetLedgerEntries[0].rejection.technicalPredecessorUse -ceq 'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK' -and
    @($technicalTargetLedgerEntries[0].rejection.evidence) -contains 'a5334c13') 'Live release ledger rejected Bronze 52 technical predecessor authority exact degil.'
  Assert-True ($technicalConsumerLedgerEntries.Count -eq 1 -and
    [string]$technicalReleaseLedger.current.releaseId -ceq 'bronze-2026-08-27-r53' -and
    [string]$technicalReleaseLedger.current.visibleRelease -ceq 'Bronze 27.08.2026.53' -and
    [int]$technicalReleaseLedger.current.monthlySequence -eq 53 -and
    [string]$technicalReleaseLedger.current.status -ceq 'IN_PROGRESS' -and
    [string]$technicalReleaseLedger.current.parentRelease -ceq 'Bronze 27.08.2026.52' -and
    [string]$technicalConsumerLedgerEntries[0].parentRelease -ceq 'Bronze 27.08.2026.52') 'Live release ledger Bronze 53 consumer authority exact degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.lifecycleAuthority.targetStatus -ceq 'REJECTED_INSTALLER_VISUAL_UAT_FAIL' -and
    $technicalPredecessorPreparationReceipt.lifecycleAuthority.targetCountsAsDeliveryPass -eq $false -and
    $technicalPredecessorPreparationReceipt.lifecycleAuthority.immutablePackageHistoryRewritten -eq $false -and
    [string]$technicalPredecessorPreparationReceipt.lifecycleAuthority.technicalPredecessorUse -ceq 'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK' -and
    [string]$technicalPredecessorPreparationReceipt.lifecycleAuthority.rejectedCheckpoint -ceq 'a5334c13') 'Technical predecessor lifecycle authority exact rejected Bronze 52 kaydiyla bagli degil.'

  Assert-BindingEqual $technicalPredecessorPreparationReceipt.installedSourceBundle.bundle $technicalInstalledBundleBinding 'Technical predecessor immutable Bronze 51 bundle'
  Assert-BindingEqual $technicalPredecessorPreparationReceipt.targetPackageBundle.bundle $previousPackageBinding 'Technical predecessor immutable Bronze 52 bundle'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.installedSourceBundle.release -ceq 'Bronze 26.08.2026.51' -and
    [string]$technicalPredecessorPreparationReceipt.installedSourceBundle.releaseId -ceq 'bronze-2026-08-26-r51' -and
    [string]$technicalPredecessorPreparationReceipt.installedSourceBundle.packageVersion -ceq '26.8.2026-51' -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.release -ceq 'Bronze 27.08.2026.52' -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.releaseId -ceq 'bronze-2026-08-27-r52' -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.packageVersion -ceq '27.8.2026-52' -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.sourceCommit -ceq [string]$verifiedPreviousPackage.sourceCommit) 'Technical predecessor immutable .51/.52 bundle kimligi exact degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.targetPackageBundle.previousPackageProvenance.release -ceq 'Bronze 26.08.2026.51' -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.previousPackageProvenance.releaseId -ceq 'bronze-2026-08-26-r51' -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.previousPackageProvenance.sha256 -ceq [string]$technicalPredecessorPreparationReceipt.installedSourceBundle.bundle.sha256 -and
    [long]$technicalPredecessorPreparationReceipt.targetPackageBundle.previousPackageProvenance.sizeBytes -eq [long]$technicalPredecessorPreparationReceipt.installedSourceBundle.bundle.sizeBytes -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.previousPackageProvenance.sourceCommit -ceq [string]$technicalPredecessorPreparationReceipt.installedSourceBundle.sourceCommit -and
    [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.previousPackageProvenance.producer.sha256 -ceq [string]$technicalPredecessorPreparationReceipt.installedSourceBundle.producer.sha256) 'Technical predecessor Bronze 52 bundle exact immutable Bronze 51 parentine bagli degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.installedBefore.fileVersion -ceq '26.8.2026-51' -and
    [string]$technicalPredecessorPreparationReceipt.installedBefore.sha256 -ceq [string]$technicalPredecessorPreparationReceipt.installedSourceBundle.packagedRuntime.sha256 -and
    [long]$technicalPredecessorPreparationReceipt.installedBefore.sizeBytes -eq [long]$technicalPredecessorPreparationReceipt.installedSourceBundle.packagedRuntime.sizeBytes -and
    [string]$technicalPredecessorPreparationReceipt.installedAfter.fileVersion -ceq '27.8.2026-52' -and
    [string]$technicalPredecessorPreparationReceipt.installedAfter.sha256 -ceq [string]$verifiedPreviousPackage.packagedRuntime.sha256 -and
    [long]$technicalPredecessorPreparationReceipt.installedAfter.sizeBytes -eq [long]$verifiedPreviousPackage.packagedRuntime.sizeBytes -and
    [string]$technicalPredecessorPreparationReceipt.installedAfter.sha256 -ceq [string]$installedBeforeIdentity.sha256 -and
    [long]$technicalPredecessorPreparationReceipt.installedAfter.sizeBytes -eq [long]$installedBeforeIdentity.sizeBytes -and
    [string]$technicalPredecessorPreparationReceipt.installedAfter.productVersion -ceq [string]$installedBeforeIdentity.productVersion -and
    [string]$technicalPredecessorPreparationReceipt.installedAfter.authenticodeStatus -ceq [string]$installedBeforeIdentity.authenticodeStatus) 'Technical predecessor installedBefore/After handoff canli .52 runtime ile exact degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.installer.sha256 -ceq [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.installer.sha256 -and
    [long]$technicalPredecessorPreparationReceipt.installer.sizeBytes -eq [long]$technicalPredecessorPreparationReceipt.targetPackageBundle.installer.sizeBytes -and
    [string]$technicalPredecessorPreparationReceipt.packagedRuntime.sha256 -ceq [string]$technicalPredecessorPreparationReceipt.targetPackageBundle.packagedRuntime.sha256 -and
    [long]$technicalPredecessorPreparationReceipt.packagedRuntime.sizeBytes -eq [long]$technicalPredecessorPreparationReceipt.targetPackageBundle.packagedRuntime.sizeBytes) 'Technical predecessor .52 installer/runtime bundle bagi exact degil.'
  Assert-True ($technicalPredecessorPreparationReceipt.preservation.allUserDataContentEqualityPreserved -eq $true -and
    $technicalPredecessorPreparationReceipt.preservation.bronzeUserDataPreserved -eq $true -and
    $technicalPredecessorPreparationReceipt.preservation.silverUserDataPreserved -eq $true -and
    $technicalPredecessorPreparationReceipt.preservation.goldUserDataPreserved -eq $true -and
    $technicalPredecessorPreparationReceipt.preservation.legacyUserDataPreserved -eq $true -and
    $technicalPredecessorPreparationReceipt.preservation.silverGoldLegacyProgramMetadataPreserved -eq $true -and
    $technicalPredecessorPreparationReceipt.preservation.silverGoldLegacyRegistryMetadataPreserved -eq $true -and
    [int]$technicalPredecessorPreparationReceipt.preservation.otherChannelWriteCount -eq 0 -and
    $technicalPredecessorPreparationReceipt.syntheticMarker.preservedDuringInstall -eq $true -and
    [string]$technicalPredecessorPreparationReceipt.syntheticMarker.cleanupStatus -ceq 'DELETED_AND_ABSENCE_READBACK_PASS') 'Technical predecessor veri/kanal koruma kaniti exact PASS degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.knownRejectedInstallerExperience.targetStatus -ceq 'REJECTED_INSTALLER_VISUAL_UAT_FAIL' -and
    [string]$technicalPredecessorPreparationReceipt.knownRejectedInstallerExperience.checkpoint -ceq 'a5334c13' -and
    $technicalPredecessorPreparationReceipt.knownRejectedInstallerExperience.interactiveUiWasNotUsed -eq $true -and
    $technicalPredecessorPreparationReceipt.knownRejectedInstallerExperience.acceptanceOrDeliveryClaim -eq $false) 'Technical predecessor bilinen rejected Bronze 52 siniri exact degil.'
  Assert-True ([string]$technicalPredecessorPreparationReceipt.handoff.expectedConsumerReleaseId -ceq 'bronze-2026-08-27-r53' -and
    $technicalPredecessorPreparationReceipt.handoff.installedRuntimeReadyForExactNormalUat110Readback -eq $true -and
    $technicalPredecessorPreparationReceipt.handoff.doesNotReplaceInstallerExperienceUat -eq $true -and
    $technicalPredecessorPreparationReceipt.handoff.doesNotReplaceInstalledReleaseUat110 -eq $true -and
    $technicalPredecessorPreparationReceipt.handoff.doesNotReplaceInstalledFrontendUat111 -eq $true -and
    $technicalPredecessorPreparationReceipt.handoff.doesNotReplaceFinalDeliveryReceipt -eq $true) 'Technical predecessor Bronze 53 handoff siniri exact degil.'
}

if (-not (Test-Path -LiteralPath $EvidenceCategoryParent)) { [IO.Directory]::CreateDirectory($EvidenceCategoryParent) | Out-Null }
Assert-NoReparseChain $EvidenceCategoryParent
[IO.Directory]::CreateDirectory($RunRoot) | Out-Null
Assert-NoReparseChain $RunRoot
$script:EvidenceRunGuard = New-EvidenceRunGuard

$originalState = Get-StateSnapshot 'ORIGINAL_BEFORE_SYNTHETIC_MARKER'
$targetExecutableAbsentBefore = -not (Test-Path -LiteralPath $InstalledExePath)
if ($isFreshInstallBootstrap) {
  Assert-True ($originalState.program.bronze.exists -eq $false) 'Bronze fresh-install bootstrap oncesinde kanonik install root tamamen yok olmalidir.'
  Assert-True ([int]$originalState.uninstallRegistry.bronze.entryCount -eq 0) 'Bronze fresh-install bootstrap oncesinde Bronze uninstall registry kaydi bulunmamalidir.'
}
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
  $primaryClassification = if ($isGovernedBootstrap) { 'BOOTSTRAP_FRESH_INSTALL_SEQUENCE_50' } elseif ($isRecoveryBootstrap) { 'RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51' } else { 'VERSION_UPGRADE_N_TO_N_PLUS_1' }
  $primaryBeforePhase = if ($isGovernedBootstrap) { 'BEFORE_BOOTSTRAP_FRESH_INSTALL' } elseif ($isRecoveryBootstrap) { 'BEFORE_RECOVERY_BOOTSTRAP_FRESH_INSTALL' } else { 'BEFORE_N_TO_N_PLUS_1' }
  $primaryAfterPhase = if ($isGovernedBootstrap) { 'AFTER_BOOTSTRAP_FRESH_INSTALL' } elseif ($isRecoveryBootstrap) { 'AFTER_RECOVERY_BOOTSTRAP_FRESH_INSTALL' } else { 'AFTER_N_TO_N_PLUS_1' }
  $before = Get-StateSnapshot $primaryBeforePhase
  if ($isFreshInstallBootstrap) {
    $targetExecutableAbsentBefore = -not (Test-Path -LiteralPath $InstalledExePath)
    Assert-True ($before.program.bronze.exists -eq $false -and $targetExecutableAbsentBefore -and [int]$before.uninstallRegistry.bronze.entryCount -eq 0) 'Bronze fresh-install yoklugu installer baslamadan hemen once yeniden dogrulanamadi.'
  } else {
    $installedBeforeReadback = Get-FileIdentity $PreviousInstalledExePath
    Assert-True ($installedBeforeReadback.sha256 -eq $installedBeforeIdentity.sha256 -and $installedBeforeReadback.sizeBytes -eq $installedBeforeIdentity.sizeBytes -and $installedBeforeReadback.fileVersion -eq $installedBeforeIdentity.fileVersion) 'Installed N runtime installer baslamadan onceki canli geri-okumada degisti.'
    Assert-True ($verifiedPreviousPackage.packagedRuntime.sha256 -eq $installedBeforeReadback.sha256 -and [long]$verifiedPreviousPackage.packagedRuntime.sizeBytes -eq $installedBeforeReadback.sizeBytes) 'Installed N runtime son geri-okumasi immutable previous package ile uyusmuyor.'
    $installedBeforeIdentity = $installedBeforeReadback
  }
  if ($requiresTechnicalPredecessorPreparation) {
    $technicalPredecessorImmediateBinding = Get-FileBinding $TechnicalPredecessorPreparation 'TechnicalPredecessorPreparation immediate readback'
    $technicalPredecessorProducerImmediateBinding = Get-FileBinding $TechnicalPredecessorProducerPath 'technical predecessor producer immediate readback'
    $technicalPredecessorReleaseLedgerImmediateBinding = Get-FileBinding $ReleaseLedgerPath 'release ledger immediate readback'
    Assert-BindingEqual $technicalPredecessorPreparationBinding $technicalPredecessorImmediateBinding 'Technical predecessor preparation immediate readback'
    $technicalPredecessorImmediateReceipt = Read-JsonFile $TechnicalPredecessorPreparation 'TechnicalPredecessorPreparation immediate readback'
    Assert-True (($technicalPredecessorImmediateReceipt | ConvertTo-Json -Depth 100 -Compress) -ceq
      ($technicalPredecessorPreparationReceipt | ConvertTo-Json -Depth 100 -Compress)) 'Technical predecessor preparation receipt installer baslamadan once degisti.'
    Assert-BindingEqual $technicalPredecessorProducerBinding $technicalPredecessorProducerImmediateBinding 'Technical predecessor producer immediate readback'
    Assert-BindingEqual $technicalPredecessorReleaseLedgerBinding $technicalPredecessorReleaseLedgerImmediateBinding 'Technical predecessor release ledger immediate readback'
    Assert-True ([string]$technicalPredecessorPreparationReceipt.installedAfter.sha256 -ceq [string]$installedBeforeReadback.sha256 -and
      [long]$technicalPredecessorPreparationReceipt.installedAfter.sizeBytes -eq [long]$installedBeforeReadback.sizeBytes -and
      [string]$technicalPredecessorPreparationReceipt.installedAfter.fileVersion -ceq [string]$installedBeforeReadback.fileVersion) 'Technical predecessor .52 handoff installer baslamadan hemen onceki canli runtime ile exact degil.'
    $technicalPredecessorImmediateReadback = [ordered]@{
      receipt = $technicalPredecessorImmediateBinding
      producer = $technicalPredecessorProducerImmediateBinding
      releaseLedger = $technicalPredecessorReleaseLedgerImmediateBinding
      installedHandoff = $installedBeforeReadback
    }
  }
  $primaryProcess = Invoke-InstallerPhase $primaryClassification
  $installedAfterPrimary = Get-FileIdentity $InstalledExePath
  Assert-True ($installedAfterPrimary.sha256 -eq $packagedIdentity.sha256 -and $installedAfterPrimary.sizeBytes -eq $packagedIdentity.sizeBytes -and $installedAfterPrimary.fileVersion -eq $packagedIdentity.fileVersion) 'Ilk kurulum/yukseltme sonrasi installed EXE packaged EXE ile exact degil.'
  $afterPrimary = Get-StateSnapshot $primaryAfterPhase
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.userData[$channel] $afterPrimary.userData[$channel] "Ilk kurulum/yukseltme userdata-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.program[$channel] $afterPrimary.program[$channel] "Ilk kurulum/yukseltme program-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $before.uninstallRegistry[$channel] $afterPrimary.uninstallRegistry[$channel] "Ilk kurulum/yukseltme registry-$channel" }
  Assert-True ((Get-FileSha256 $markerPath) -eq $markerIdentity.sha256) 'Sentetik Bronze marker ilk kurulum/yukseltme fazinda korunmadi.'
  $bronzeRegistryAfterPrimary = Get-BronzeRegistryIdentity $packagedIdentity.fileVersion
  $maintenanceProcess = Invoke-InstallerPhase 'SAME_VERSION_MAINTENANCE'
  $installedAfterMaintenance = Get-FileIdentity $InstalledExePath
  Assert-True ($installedAfterMaintenance.sha256 -eq $packagedIdentity.sha256 -and $installedAfterMaintenance.sizeBytes -eq $packagedIdentity.sizeBytes -and $installedAfterMaintenance.fileVersion -eq $packagedIdentity.fileVersion) 'Maintenance sonrasi installed EXE packaged EXE ile exact degil.'
  $afterMaintenance = Get-StateSnapshot 'AFTER_SAME_VERSION_MAINTENANCE'
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $afterPrimary.userData[$channel] $afterMaintenance.userData[$channel] "Maintenance userdata-$channel" }
  foreach ($channel in @('silver', 'gold', 'legacy')) { Assert-ManifestEqual $afterPrimary.program[$channel] $afterMaintenance.program[$channel] "Maintenance program-$channel" }
  foreach ($channel in @('bronze', 'silver', 'gold', 'legacy')) { Assert-ManifestEqual $afterPrimary.uninstallRegistry[$channel] $afterMaintenance.uninstallRegistry[$channel] "Maintenance registry-$channel" }
  Assert-True ((Get-FileSha256 $markerPath) -eq $markerIdentity.sha256) 'Sentetik Bronze marker maintenance fazinda korunmadi.'
  $bronzeRegistryAfterMaintenance = Get-BronzeRegistryIdentity $packagedIdentity.fileVersion
  Assert-True (($bronzeRegistryAfterPrimary | ConvertTo-Json -Compress) -ceq ($bronzeRegistryAfterMaintenance | ConvertTo-Json -Compress)) 'Bronze registry kimligi maintenance fazinda degisti.'
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

if ($requiresTechnicalPredecessorPreparation) {
  $technicalPredecessorFinalBinding = Get-FileBinding $TechnicalPredecessorPreparation 'TechnicalPredecessorPreparation final readback'
  $technicalPredecessorProducerFinalBinding = Get-FileBinding $TechnicalPredecessorProducerPath 'technical predecessor producer final readback'
  $technicalPredecessorReleaseLedgerFinalBinding = Get-FileBinding $ReleaseLedgerPath 'release ledger final readback'
  Assert-BindingEqual $technicalPredecessorPreparationBinding $technicalPredecessorFinalBinding 'Technical predecessor preparation final readback'
  Assert-BindingEqual $technicalPredecessorProducerBinding $technicalPredecessorProducerFinalBinding 'Technical predecessor producer final readback'
  Assert-BindingEqual $technicalPredecessorReleaseLedgerBinding $technicalPredecessorReleaseLedgerFinalBinding 'Technical predecessor release ledger final readback'
  $technicalPredecessorReadback = [ordered]@{
    status = 'PASS'
    immediate = $technicalPredecessorImmediateReadback
    final = [ordered]@{
      receipt = $technicalPredecessorFinalBinding
      producer = $technicalPredecessorProducerFinalBinding
      releaseLedger = $technicalPredecessorReleaseLedgerFinalBinding
    }
    installedHandoff = $technicalPredecessorPreparationReceipt.installedAfter
    consumerReleaseId = [string]$technicalPredecessorPreparationReceipt.consumerReleaseId
    verifiedImmediatelyBeforeInstaller = $true
    verifiedAfterInstallationPhases = $true
  }
}

$installationMode = if ($isGovernedBootstrap) { 'BOOTSTRAP_FRESH_INSTALL' } elseif ($isRecoveryBootstrap) { 'RECOVERY_BOOTSTRAP_FRESH_INSTALL' } else { 'CONTINUATION_N_TO_N_PLUS_ONE' }
$primaryInstallationReceipt = [ordered]@{
  classification = $primaryProcess.classification; status = 'PASS'
  fromFileVersion = if ($isFreshInstallBootstrap) { $null } else { $installedBeforeIdentity.fileVersion }
  toFileVersion = $installedAfterPrimary.fileVersion
  fromSequence = if ($isFreshInstallBootstrap) { $null } else { $oldSequence }
  toSequence = $newSequence
  exactSuccessor = -not $isFreshInstallBootstrap
  governedBootstrap = $isGovernedBootstrap
  recoveryBootstrap = $isRecoveryBootstrap
  targetInstallRootAbsentBefore = if ($isFreshInstallBootstrap) { $before.program.bronze.exists -eq $false } else { $false }
  targetExecutableAbsentBefore = if ($isFreshInstallBootstrap) { $targetExecutableAbsentBefore } else { $false }
  bronzeUninstallRegistryAbsentBefore = if ($isFreshInstallBootstrap) { [int]$before.uninstallRegistry.bronze.entryCount -eq 0 } else { $false }
  packagePreviousProvenanceAbsent = if ($isGovernedBootstrap) { $null -eq $package.previousPackageProvenance } else { $false }
  installerProcess = $primaryProcess; before = $before; after = $afterPrimary; installedRuntime = $installedAfterPrimary
  installedEqualsPackaged = $true; markerPreserved = $true; allUserDataContentEqualityPreserved = $true
  otherChannelAndLegacyProgramMetadataPreserved = $true; otherChannelWriteCount = 0; dataSelectionDialogObserved = $false
  bronzeRegistry = $bronzeRegistryAfterPrimary
}
$freshInstallReceipt = if ($isFreshInstallBootstrap) { $primaryInstallationReceipt } else { $null }
$upgradeReceipt = if ($isFreshInstallBootstrap) { $null } else { $primaryInstallationReceipt }

$installationReceipt = [ordered]@{
  schemaVersion = 3; id = 'PPT-WINDOWS-INSTALLED-RELEASE-UAT110-V3'; evidenceKind = 'WINDOWS_INSTALLED_RELEASE_PRESERVATION'; status = 'PASS'; exitCode = 0
  runId = $runId; evidenceRoot = $RunRoot; startedAt = $runStartedAt.ToString('O'); completedAt = $runCompletedAt.ToString('O'); generatedAt = [DateTimeOffset]::UtcNow.ToString('O')
  classification = 'LOCAL_UNSIGNED_INSTALLATION_PRESERVATION_ONLY'; installationMode = $installationMode; release = [string]$package.release; expectedReleaseId = $ExpectedReleaseId
  sourceCommit = [string]$verifiedPackage.sourceCommit; governedSourceFingerprintSha256 = [string]$verifiedPackage.governedSourceFingerprintSha256; canonicalRuleRegistrySha256 = [string]$verifiedPackage.canonicalRuleRegistrySha256
  producer = $producerIdentity; installer = $installerIdentity; packagedRuntime = $packagedIdentity; installedBefore = $installedBeforeIdentity
  packageProvenance = $packageBinding; governedPreflight = $preflightBinding; installerExperience = $installerExperienceBinding; previousPackageProvenance = $previousPackageBinding
  technicalPredecessorPreparation = $technicalPredecessorPreparationBinding; technicalPredecessorReadback = $technicalPredecessorReadback
  recoveryBootstrapAuthority = if ($isRecoveryBootstrap) { $package.previousPackageProvenance.recoveryBootstrap } else { $null }
  syntheticMarker = [ordered]@{ sizeBytes = $markerIdentity.sizeBytes; sha256 = $markerIdentity.sha256; kind = $markerIdentity.kind; cleanupStatus = 'DELETED_AND_ABSENCE_READBACK_PASS' }
  privacyBoundary = [ordered]@{ existingUserFileContentsHashedForEquality = $true; existingUserFileContentsRecorded = $false; existingUserFileNamesRecorded = $false; receiptContainsUserContent = $false; contentEqualityMeasured = $true }
  primaryInstallation = $primaryInstallationReceipt; freshInstall = $freshInstallReceipt; upgrade = $upgradeReceipt
  maintenance = [ordered]@{ classification = $maintenanceProcess.classification; precedingPhase = $primaryProcess.classification; status = 'PASS'; beforeFileVersion = $installedAfterPrimary.fileVersion; afterFileVersion = $installedAfterMaintenance.fileVersion; sameVersion = $true; installerProcess = $maintenanceProcess; before = $afterPrimary; after = $afterMaintenance; installedRuntime = $installedAfterMaintenance; installedEqualsPackaged = $true; markerPreserved = $true; allUserDataContentEqualityPreserved = $true; otherChannelAndLegacyProgramMetadataPreserved = $true; otherChannelWriteCount = 0; dataSelectionDialogObserved = $false; bronzeRegistry = $bronzeRegistryAfterMaintenance }
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
