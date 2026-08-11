param(
  [string]$EvidencePath = "",
  [switch]$KeepInstalled
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $root "apps\desktop"
$desktopPackage = Get-Content -LiteralPath (Join-Path $desktopRoot "package.json") -Raw | ConvertFrom-Json
$currentPackageVersion = [string]$desktopPackage.version
$appMetaSource = Get-Content -LiteralPath (Join-Path $root "packages\domain\src\app-meta.ts") -Raw
$applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
if (-not $applicationVersionMatch.Success) { throw "Application version could not be resolved from app-meta.ts." }
$currentApplicationVersion = $applicationVersionMatch.Groups[1].Value
$build = [int]($currentApplicationVersion.Split('.')[-1])
$releaseRoot = Join-Path $desktopRoot "release"
$validationRoot = Join-Path $root "artifacts\validation"
$runId = [Guid]::NewGuid().ToString("N")
$installRoot = Join-Path $root ".tmp\open022-windows-release-validation\$runId"
$installedExecutable = Join-Path $installRoot "Anadolu Parsı Aile Yaşam Merkezi.exe"
$uninstaller = Join-Path $installRoot "Uninstall Anadolu Parsı Aile Yaşam Merkezi.exe"
$currentUserUninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\21407021-5905-5b84-b819-cd67d4371a25"
if (-not $EvidencePath) { $EvidencePath = Join-Path $validationRoot "build$build-open022-windows-release-lifecycle.json" }

New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null
$steps = [System.Collections.Generic.List[object]]::new()
$installerPath = $null
$failure = $null

function Invoke-Checked {
  param([string]$Id,[string]$FilePath,[string[]]$Arguments,[string]$WorkingDirectory)
  $startedAt = [DateTimeOffset]::UtcNow
  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $FilePath
  $processInfo.WorkingDirectory = $WorkingDirectory
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $argumentListProperty = $processInfo.PSObject.Properties["ArgumentList"]
  if ($argumentListProperty -and $null -ne $processInfo.ArgumentList) {
    foreach ($argument in $Arguments) { $processInfo.ArgumentList.Add($argument) }
  } else {
    $quotedArguments = foreach ($argument in $Arguments) {
      if ($argument.Contains('"')) { throw "Process arguments containing quote characters are not supported." }
      if ($argument -match '\s') { '"' + $argument + '"' } else { $argument }
    }
    $processInfo.Arguments = $quotedArguments -join " "
  }
  $process = [System.Diagnostics.Process]::Start($processInfo)
  $process.WaitForExit()
  $steps.Add([ordered]@{
    id = $Id
    status = if ($process.ExitCode -eq 0) { "PASS" } else { "FAIL" }
    exitCode = $process.ExitCode
    startedAt = $startedAt.ToString("O")
    completedAt = [DateTimeOffset]::UtcNow.ToString("O")
  })
  if ($process.ExitCode -ne 0) { throw "$Id failed with exit code $($process.ExitCode)." }
}

try {
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") { throw "OPEN-022 release validation can run only on Windows." }

  Invoke-Checked -Id "windows-installer-build" -FilePath "cmd.exe" `
    -Arguments @("/d","/s","/c","npm.cmd run package:win --workspace @ppt/desktop") -WorkingDirectory $root

  Invoke-Checked -Id "development-open022-launch" -FilePath "node.exe" `
    -Arguments @("scripts\windows-open022-launch-test.mjs") -WorkingDirectory $root

  $installerPath = Get-ChildItem -LiteralPath $releaseRoot -File -Filter "*.exe" |
    Where-Object { $_.Name -notlike "*.__uninstaller.exe" } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $installerPath) { throw "Windows installer artifact was not found in $releaseRoot." }

  if (Test-Path -LiteralPath $currentUserUninstallKey) {
    $existingInstallation = Get-ItemProperty -LiteralPath $currentUserUninstallKey
    $existingUninstallCommand = [string]$existingInstallation.UninstallString
    $existingUninstallerPath = if ($existingUninstallCommand -match '^"([^"]+)"') { $Matches[1] } else { $null }
    $isStaleCurrentBuildEntry =
      $existingInstallation.DisplayVersion -eq $currentPackageVersion -and
      $existingUninstallerPath -and
      -not (Test-Path -LiteralPath $existingUninstallerPath -PathType Leaf)
    if (-not $isStaleCurrentBuildEntry) { throw "An existing current-user installation is present; OPEN-022 validation refuses to replace it." }
  }

  Invoke-Checked -Id "silent-install" -FilePath $installerPath `
    -Arguments @("/S","/currentuser","--no-desktop-shortcut","/D=$installRoot") -WorkingDirectory $root
  if (-not (Test-Path -LiteralPath $installedExecutable -PathType Leaf)) { throw "Installed application executable was not found: $installedExecutable" }

  Invoke-Checked -Id "installed-open022-launch" -FilePath "node.exe" `
    -Arguments @("scripts\windows-open022-launch-test.mjs","--executable=$installedExecutable") -WorkingDirectory $root

  if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw "Uninstaller was not found: $uninstaller" }
  if (-not $KeepInstalled) {
    Invoke-Checked -Id "silent-uninstall" -FilePath $uninstaller `
      -Arguments @("/S","/currentuser") -WorkingDirectory $root
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
    while (((Test-Path -LiteralPath $installedExecutable -PathType Leaf) -or (Test-Path -LiteralPath $currentUserUninstallKey)) -and [DateTimeOffset]::UtcNow -lt $deadline) {
      Start-Sleep -Seconds 1
    }
    if (Test-Path -LiteralPath $installedExecutable -PathType Leaf) { throw "Application executable remained after uninstall." }
    if (Test-Path -LiteralPath $currentUserUninstallKey) { throw "Current-user uninstall registry entry remained after uninstall." }
  }
} catch {
  $failure = $_.Exception.Message
} finally {
  if ($failure -and -not $KeepInstalled -and (Test-Path -LiteralPath $uninstaller)) {
    try {
      Start-Process -FilePath $uninstaller -ArgumentList @("/S","/currentuser") -WorkingDirectory $root -Wait -WindowStyle Hidden | Out-Null
    } catch {
      $failure = "$failure Cleanup also failed: $($_.Exception.Message)"
    }
  }

  $installerEvidence = $null
  if ($installerPath -and (Test-Path -LiteralPath $installerPath)) {
    $installerFile = Get-Item -LiteralPath $installerPath
    $installerEvidence = [ordered]@{
      path = $installerFile.FullName
      sizeBytes = $installerFile.Length
      sha256 = (Get-FileHash -LiteralPath $installerFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      authenticodeStatus = (Get-AuthenticodeSignature -LiteralPath $installerFile.FullName).Status.ToString()
    }
  }

  $evidence = [ordered]@{
    schemaVersion = 1
    product = "Anadolu Parsı Aile Yaşam Merkezi"
    applicationVersion = $currentApplicationVersion
    packageVersion = $currentPackageVersion
    build = $build
    stage = "Bronze RC2 Active Development"
    openWorkId = "OPEN-022"
    status = if ($failure) { "FAIL" } else { "PASS" }
    official = $true
    diagnosticOnly = $false
    generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
    installationDirectory = $installRoot
    keptInstalled = [bool]$KeepInstalled
    installer = $installerEvidence
    steps = $steps
    error = $failure
  }
  [System.IO.File]::WriteAllText($EvidencePath, "$(($evidence | ConvertTo-Json -Depth 8))`n", [System.Text.UTF8Encoding]::new($false))
}

if ($failure) { Write-Error $failure; exit 1 }
Write-Host "OPEN-022 Windows release lifecycle verified. Evidence: $EvidencePath"
