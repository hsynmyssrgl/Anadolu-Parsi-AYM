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
if ($build -ne 224) { throw "Unified Bronze Windows security lifecycle requires Build224; current build=$build." }
$releaseRoot = Join-Path $desktopRoot "release"
$validationRoot = Join-Path $root "artifacts\validation"
$runId = [Guid]::NewGuid().ToString("N")
$installRoot = Join-Path $root ".tmp\bronze-security-windows-release-validation\$runId"
$installedExecutable = Join-Path $installRoot "Anadolu Parsı Aile Yaşam Merkezi.exe"
$uninstaller = Join-Path $installRoot "Uninstall Anadolu Parsı Aile Yaşam Merkezi.exe"
$currentUserUninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\21407021-5905-5b84-b819-cd67d4371a25"
if (-not $EvidencePath) { $EvidencePath = Join-Path $validationRoot "build224-bronze-security-windows-release-lifecycle.json" }

New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null
$steps = [System.Collections.Generic.List[object]]::new()
$installerPath = $null
$infrastructureFailure = $null

function Add-StepResult {
  param([string]$Id,[string]$Status,[int]$ExitCode,[string]$Error,[datetimeoffset]$StartedAt,[string]$StdoutTail="",[string]$StderrTail="")
  $steps.Add([ordered]@{
    id = $Id
    status = $Status
    exitCode = $ExitCode
    startedAt = $StartedAt.ToString("O")
    completedAt = [DateTimeOffset]::UtcNow.ToString("O")
    error = $Error
    stdoutTail = $StdoutTail
    stderrTail = $StderrTail
  })
}

function Invoke-RecordedProcess {
  param([string]$Id,[string]$FilePath,[string[]]$Arguments,[string]$WorkingDirectory)
  $startedAt = [DateTimeOffset]::UtcNow
  try {
    $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processInfo.FileName = $FilePath
    $processInfo.WorkingDirectory = $WorkingDirectory
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
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
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask,$stderrTask))
    $stdout = [string]$stdoutTask.Result
    $stderr = [string]$stderrTask.Result
    $tailLength = 12000
    $stdoutTail = if ($stdout.Length -gt $tailLength) { $stdout.Substring($stdout.Length-$tailLength) } else { $stdout }
    $stderrTail = if ($stderr.Length -gt $tailLength) { $stderr.Substring($stderr.Length-$tailLength) } else { $stderr }
    $status = if ($process.ExitCode -eq 0) { "PASS" } else { "FAIL" }
    Add-StepResult -Id $Id -Status $status -ExitCode $process.ExitCode -Error $null -StartedAt $startedAt -StdoutTail $stdoutTail -StderrTail $stderrTail
    return ($process.ExitCode -eq 0)
  } catch {
    Add-StepResult -Id $Id -Status "FAIL" -ExitCode 1 -Error $_.Exception.Message -StartedAt $startedAt
    return $false
  }
}

function Add-NotRunStep {
  param([string]$Id,[string]$Reason)
  $now = [DateTimeOffset]::UtcNow
  Add-StepResult -Id $Id -Status "NOT_RUN" -ExitCode -1 -Error $Reason -StartedAt $now
}

function Step-Passed([string]$Id) {
  $row = $steps | Where-Object { $_.id -eq $Id } | Select-Object -Last 1
  return ($null -ne $row -and $row.status -eq "PASS")
}

try {
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") { throw "Unified Bronze security validation can run only on real Windows." }

  $buildOk = Invoke-RecordedProcess -Id "windows-installer-build" -FilePath "cmd.exe" `
    -Arguments @("/d","/s","/c","npm.cmd run package:win --workspace @ppt/desktop") -WorkingDirectory $root

  if ($buildOk) {
    [void](Invoke-RecordedProcess -Id "development-open021-launch" -FilePath "node.exe" `
      -Arguments @("scripts\windows-open021-launch-test.mjs") -WorkingDirectory $root)
    [void](Invoke-RecordedProcess -Id "development-open022-launch" -FilePath "node.exe" `
      -Arguments @("scripts\windows-open022-launch-test.mjs") -WorkingDirectory $root)

    $installerPath = Get-ChildItem -LiteralPath $releaseRoot -File -Filter "*.exe" |
      Where-Object { $_.Name -notlike "*.__uninstaller.exe" } |
      Sort-Object LastWriteTimeUtc -Descending |
      Select-Object -First 1 -ExpandProperty FullName
    if (-not $installerPath) {
      Add-NotRunStep -Id "silent-install" -Reason "Installer artifact was not found after package:win."
      Add-NotRunStep -Id "installed-open021-launch" -Reason "Installation was not available."
      Add-NotRunStep -Id "installed-open022-launch" -Reason "Installation was not available."
      Add-NotRunStep -Id "silent-uninstall" -Reason "Installation was not available."
    } else {
      $existingInstallationBlocks = $false
      if (Test-Path -LiteralPath $currentUserUninstallKey) {
        $existingInstallation = Get-ItemProperty -LiteralPath $currentUserUninstallKey
        $existingUninstallCommand = [string]$existingInstallation.UninstallString
        $existingUninstallerPath = if ($existingUninstallCommand -match '^"([^"]+)"') { $Matches[1] } else { $null }
        $isStaleCurrentBuildEntry =
          $existingInstallation.DisplayVersion -eq $currentPackageVersion -and
          $existingUninstallerPath -and
          -not (Test-Path -LiteralPath $existingUninstallerPath -PathType Leaf)
        $existingInstallationBlocks = -not $isStaleCurrentBuildEntry
      }

      if ($existingInstallationBlocks) {
        Add-NotRunStep -Id "silent-install" -Reason "An existing current-user installation is present; validation refuses to replace it."
        Add-NotRunStep -Id "installed-open021-launch" -Reason "Fresh validation installation was not created."
        Add-NotRunStep -Id "installed-open022-launch" -Reason "Fresh validation installation was not created."
        Add-NotRunStep -Id "silent-uninstall" -Reason "Fresh validation installation was not created."
      } else {
        $installOk = Invoke-RecordedProcess -Id "silent-install" -FilePath $installerPath `
          -Arguments @("/S","/currentuser","--no-desktop-shortcut","/D=$installRoot") -WorkingDirectory $root
        if ($installOk -and (Test-Path -LiteralPath $installedExecutable -PathType Leaf)) {
          [void](Invoke-RecordedProcess -Id "installed-open021-launch" -FilePath "node.exe" `
            -Arguments @("scripts\windows-open021-launch-test.mjs","--executable=$installedExecutable") -WorkingDirectory $root)
          [void](Invoke-RecordedProcess -Id "installed-open022-launch" -FilePath "node.exe" `
            -Arguments @("scripts\windows-open022-launch-test.mjs","--executable=$installedExecutable") -WorkingDirectory $root)
        } else {
          Add-NotRunStep -Id "installed-open021-launch" -Reason "Installed executable was not available."
          Add-NotRunStep -Id "installed-open022-launch" -Reason "Installed executable was not available."
        }

        if ($KeepInstalled) {
          Add-NotRunStep -Id "silent-uninstall" -Reason "KeepInstalled was requested; official closure requires uninstall PASS."
        } elseif (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
          [void](Invoke-RecordedProcess -Id "silent-uninstall" -FilePath $uninstaller `
            -Arguments @("/S","/currentuser") -WorkingDirectory $root)
          $deadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
          while (((Test-Path -LiteralPath $installedExecutable -PathType Leaf) -or (Test-Path -LiteralPath $currentUserUninstallKey)) -and [DateTimeOffset]::UtcNow -lt $deadline) {
            Start-Sleep -Seconds 1
          }
          if ((Test-Path -LiteralPath $installedExecutable -PathType Leaf) -or (Test-Path -LiteralPath $currentUserUninstallKey)) {
            $row = $steps | Where-Object { $_.id -eq "silent-uninstall" } | Select-Object -Last 1
            if ($row) { $row.status = "FAIL"; $row.error = "Application or uninstall registry entry remained after uninstall." }
          }
        } else {
          Add-NotRunStep -Id "silent-uninstall" -Reason "Uninstaller was not found."
        }
      }
    }
  } else {
    Add-NotRunStep -Id "development-open021-launch" -Reason "Installer/build step failed."
    Add-NotRunStep -Id "development-open022-launch" -Reason "Installer/build step failed."
    Add-NotRunStep -Id "silent-install" -Reason "Installer/build step failed."
    Add-NotRunStep -Id "installed-open021-launch" -Reason "Installer/build step failed."
    Add-NotRunStep -Id "installed-open022-launch" -Reason "Installer/build step failed."
    Add-NotRunStep -Id "silent-uninstall" -Reason "Installer/build step failed."
  }
} catch {
  $infrastructureFailure = $_.Exception.Message
} finally {
  if (-not $KeepInstalled -and (Test-Path -LiteralPath $uninstaller -PathType Leaf) -and -not (Step-Passed "silent-uninstall")) {
    try { Start-Process -FilePath $uninstaller -ArgumentList @("/S","/currentuser") -WorkingDirectory $root -Wait -WindowStyle Hidden | Out-Null } catch {}
  }

  $installerEvidence = $null
  if ($installerPath -and (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
    $installerFile = Get-Item -LiteralPath $installerPath
    $installerEvidence = [ordered]@{
      path = $installerFile.FullName
      sizeBytes = $installerFile.Length
      sha256 = (Get-FileHash -LiteralPath $installerFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      authenticodeStatus = (Get-AuthenticodeSignature -LiteralPath $installerFile.FullName).Status.ToString()
    }
  }

  $sharedIds = @("windows-installer-build","silent-install","silent-uninstall")
  $open021Ids = @("development-open021-launch","installed-open021-launch")
  $open022Ids = @("development-open022-launch","installed-open022-launch")
  $sharedPass = (-not $infrastructureFailure) -and (($sharedIds | Where-Object { -not (Step-Passed $_) }).Count -eq 0)
  $open021Pass = $sharedPass -and (($open021Ids | Where-Object { -not (Step-Passed $_) }).Count -eq 0)
  $open022Pass = $sharedPass -and (($open022Ids | Where-Object { -not (Step-Passed $_) }).Count -eq 0)
  $overall = if ($open021Pass -and $open022Pass) { "PASS" } elseif ($open021Pass -or $open022Pass) { "PARTIAL" } else { "FAIL" }

  $evidence = [ordered]@{
    schemaVersion = 1
    product = "Anadolu Parsı Aile Yaşam Merkezi"
    applicationVersion = $currentApplicationVersion
    packageVersion = $currentPackageVersion
    build = $build
    stage = "Bronze RC2 Active Development"
    evidencePurpose = "OPEN-021 + OPEN-022 unified real Windows closure"
    status = $overall
    official = $true
    diagnosticOnly = $false
    generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
    installationDirectory = $installRoot
    keptInstalled = [bool]$KeepInstalled
    installer = $installerEvidence
    readiness = [ordered]@{
      sharedLifecycle = if ($sharedPass) { "PASS" } else { "FAIL" }
      open021Lifecycle = if ($open021Pass) { "PASS" } else { "FAIL" }
      open022Lifecycle = if ($open022Pass) { "PASS" } else { "FAIL" }
    }
    steps = $steps
    error = $infrastructureFailure
  }
  [System.IO.File]::WriteAllText($EvidencePath, "$($evidence | ConvertTo-Json -Depth 10)`n", [System.Text.UTF8Encoding]::new($false))
}

Write-Host "Unified Bronze Windows security lifecycle evidence: $EvidencePath"
if ($infrastructureFailure) { Write-Error $infrastructureFailure; exit 1 }
if ($open021Pass -and $open022Pass) { Write-Host "Unified lifecycle: PASS for OPEN-021 and OPEN-022"; exit 0 }
if ($open021Pass) { Write-Warning "Unified lifecycle: OPEN-021 PASS, OPEN-022 FAIL"; exit 21 }
if ($open022Pass) { Write-Warning "Unified lifecycle: OPEN-022 PASS, OPEN-021 FAIL"; exit 22 }
Write-Error "Unified lifecycle did not produce closure-ready evidence for either OPEN item."
exit 1
