param(
  [string]$EvidencePath = "",
  [switch]$KeepInstalled,
  [switch]$DiagnosticNoSandbox
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $root "apps\desktop"
$desktopPackage = Get-Content -LiteralPath (Join-Path $desktopRoot "package.json") -Raw | ConvertFrom-Json
$currentPackageVersion = [string]$desktopPackage.version
$appMetaSource = Get-Content -LiteralPath (Join-Path $root "packages\domain\src\app-meta.ts") -Raw
$applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
if (-not $applicationVersionMatch.Success) {
  throw "Application version could not be resolved from app-meta.ts."
}
$currentApplicationVersion = $applicationVersionMatch.Groups[1].Value
$releaseRoot = Join-Path $desktopRoot "release"
$validationRoot = Join-Path $root "artifacts\validation"
$runId = [Guid]::NewGuid().ToString("N")
$installRoot = Join-Path $root ".tmp\windows-release-validation\$runId"
$installedExecutable = Join-Path $installRoot "Anadolu Parsı Aile Yaşam Merkezi.exe"
$uninstaller = Join-Path $installRoot "Uninstall Anadolu Parsı Aile Yaşam Merkezi.exe"
$currentUserUninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\21407021-5905-5b84-b819-cd67d4371a25"
if (-not $EvidencePath) {
  $evidenceFileName = if ($DiagnosticNoSandbox) {
    "windows-release-lifecycle-diagnostic-no-sandbox.json"
  } else {
    "windows-release-lifecycle.json"
  }
  $EvidencePath = Join-Path $validationRoot $evidenceFileName
}

New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null
$steps = [System.Collections.Generic.List[object]]::new()
$installerPath = $null
$failure = $null

function Invoke-Checked {
  param(
    [string]$Id,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )
  $startedAt = [DateTimeOffset]::UtcNow
  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $FilePath
  $processInfo.WorkingDirectory = $WorkingDirectory
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $argumentListProperty = $processInfo.PSObject.Properties["ArgumentList"]
  if ($argumentListProperty -and $null -ne $processInfo.ArgumentList) {
    foreach ($argument in $Arguments) {
      $processInfo.ArgumentList.Add($argument)
    }
  } else {
    $quotedArguments = foreach ($argument in $Arguments) {
      if ($argument.Contains('"')) {
        throw "Process arguments containing quote characters are not supported."
      }
      if ($argument -match '\s') {
        '"' + $argument + '"'
      } else {
        $argument
      }
    }
    $processInfo.Arguments = $quotedArguments -join " "
  }
  $process = [System.Diagnostics.Process]::Start($processInfo)
  $process.WaitForExit()
  $completedAt = [DateTimeOffset]::UtcNow
  $record = [ordered]@{
    id = $Id
    status = if ($process.ExitCode -eq 0) { "PASS" } else { "FAIL" }
    exitCode = $process.ExitCode
    startedAt = $startedAt.ToString("O")
    completedAt = $completedAt.ToString("O")
  }
  $steps.Add($record)
  if ($process.ExitCode -ne 0) {
    throw "$Id failed with exit code $($process.ExitCode)."
  }
}

try {
  $developmentLaunchArguments = @("scripts\windows-real-launch-test.mjs")
  if ($DiagnosticNoSandbox) {
    $developmentLaunchArguments += "--diagnostic-no-sandbox"
  }
  Invoke-Checked -Id "development-launch" -FilePath "node.exe" `
    -Arguments $developmentLaunchArguments -WorkingDirectory $root

  Invoke-Checked -Id "windows-installer-build" -FilePath "cmd.exe" `
    -Arguments @(
      "/d",
      "/s",
      "/c",
      "npm.cmd run package:win --workspace @ppt/desktop"
    ) `
    -WorkingDirectory $root

  $installerPath = Get-ChildItem -LiteralPath $releaseRoot -File -Filter "*.exe" |
    Where-Object { $_.Name -notlike "*.__uninstaller.exe" } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $installerPath) {
    throw "Windows installer artifact was not found in $releaseRoot."
  }
  if (Test-Path -LiteralPath $currentUserUninstallKey) {
    $existingInstallation = Get-ItemProperty -LiteralPath $currentUserUninstallKey
    $existingUninstallCommand = [string]$existingInstallation.UninstallString
    $existingUninstallerPath = if ($existingUninstallCommand -match '^"([^"]+)"') {
      $Matches[1]
    } else {
      $null
    }
    $isStaleCurrentBuildEntry =
      $existingInstallation.DisplayVersion -eq $currentPackageVersion -and
      $existingUninstallerPath -and
      -not (Test-Path -LiteralPath $existingUninstallerPath -PathType Leaf)
    if (-not $isStaleCurrentBuildEntry) {
      throw "A current-user Panthera installation already exists; lifecycle validation refuses to replace it."
    }
  }

  Invoke-Checked -Id "silent-install" -FilePath $installerPath `
    -Arguments @("/S", "/currentuser", "--no-desktop-shortcut", "/D=$installRoot") `
    -WorkingDirectory $root
  if (-not (Test-Path -LiteralPath $installedExecutable -PathType Leaf)) {
    throw "Installed application executable was not found: $installedExecutable"
  }

  $installedLaunchArguments = @(
    "scripts\windows-real-launch-test.mjs",
    "--executable=$installedExecutable"
  )
  if ($DiagnosticNoSandbox) {
    $installedLaunchArguments += "--diagnostic-no-sandbox"
  }
  Invoke-Checked -Id "installed-application-launch" -FilePath "node.exe" `
    -Arguments $installedLaunchArguments -WorkingDirectory $root

  if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
    throw "Uninstaller was not found: $uninstaller"
  }
  if (-not $KeepInstalled) {
    Invoke-Checked -Id "silent-uninstall" -FilePath $uninstaller `
      -Arguments @("/S", "/currentuser") -WorkingDirectory $root
    $uninstallDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
    while (
      (
        (Test-Path -LiteralPath $installedExecutable -PathType Leaf) -or
        (Test-Path -LiteralPath $currentUserUninstallKey)
      ) -and
      [DateTimeOffset]::UtcNow -lt $uninstallDeadline
    ) {
      Start-Sleep -Seconds 1
    }
    if (Test-Path -LiteralPath $installedExecutable -PathType Leaf) {
      throw "Application executable remained after uninstall."
    }
    if (Test-Path -LiteralPath $currentUserUninstallKey) {
      throw "Current-user uninstall registry entry remained after uninstall."
    }
  }
} catch {
  $failure = $_.Exception.Message
} finally {
  if ($failure -and -not $KeepInstalled -and (Test-Path -LiteralPath $uninstaller)) {
    try {
      Start-Process -FilePath $uninstaller -ArgumentList @("/S", "/currentuser") `
        -WorkingDirectory $root -Wait -WindowStyle Hidden | Out-Null
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
    schemaVersion = 2
    product = "Anadolu Parsı Aile Yaşam Merkezi"
    applicationVersion = $currentApplicationVersion
    packageVersion = $currentPackageVersion
    stage = "Bronze RC2 Active Development"
    status = if ($DiagnosticNoSandbox) {
      if ($failure) { "DIAGNOSTIC_FAIL" } else { "DIAGNOSTIC_PASS" }
    } else {
      if ($failure) { "FAIL" } else { "PASS" }
    }
    diagnosticOnly = [bool]$DiagnosticNoSandbox
    diagnosticMode = if ($DiagnosticNoSandbox) { "no-sandbox" } else { $null }
    officialGateStatus = if ($DiagnosticNoSandbox) {
      "UNCHANGED"
    } else {
      if ($failure) { "FAIL" } else { "PASS" }
    }
    generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
    installationDirectory = $installRoot
    keptInstalled = [bool]$KeepInstalled
    installer = $installerEvidence
    steps = $steps
    error = $failure
  }
  $evidenceJson = $evidence | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText(
    $EvidencePath,
    "$evidenceJson`n",
    [System.Text.UTF8Encoding]::new($false)
  )
}

if ($failure) {
  Write-Error $failure
  exit 1
}
if ($DiagnosticNoSandbox) {
  Write-Host "Diagnostic Windows release lifecycle verified. Official gate status is unchanged. Evidence: $EvidencePath"
} else {
  Write-Host "Windows release lifecycle verified. Evidence: $EvidencePath"
}
