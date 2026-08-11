param(
  [string]$EvidencePath = "",
  [switch]$KeepInstalled
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $root "apps\desktop"
$desktopPackagePath = Join-Path $desktopRoot "package.json"
$desktopPackage = [System.IO.File]::ReadAllText($desktopPackagePath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$currentPackageVersion = [string]$desktopPackage.version
$productName = [string]$desktopPackage.build.productName
$appMetaPath = Join-Path $root "packages\domain\src\app-meta.ts"
$appMetaSource = [System.IO.File]::ReadAllText($appMetaPath, [System.Text.Encoding]::UTF8)
$applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
if (-not $applicationVersionMatch.Success) { throw "Application version could not be resolved from app-meta.ts." }
$currentApplicationVersion = $applicationVersionMatch.Groups[1].Value
$build = [int]($currentApplicationVersion.Split('.')[-1])
if ($build -ne 227) { throw "Unified Bronze Windows security lifecycle requires Build227; current build=$build." }

$releaseRoot = Join-Path $desktopRoot "release"
$validationRoot = Join-Path $root "artifacts\validation"
$runId = [Guid]::NewGuid().ToString("N")
$installRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("PPTB227-" + $runId.Substring(0, 8))
$uninstallRegistryRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
if (-not $EvidencePath) { $EvidencePath = Join-Path $validationRoot "build227-bronze-security-windows-release-lifecycle.json" }

New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null
$steps = [System.Collections.Generic.List[object]]::new()
$installerPath = $null
$installedExecutable = $null
$uninstaller = $null
$installRegistryPath = $null
$infrastructureFailure = $null
$residue = New-Object System.Collections.ArrayList

function Add-StepResult {
  param(
    [string]$Id,
    [string]$Status,
    [int]$ExitCode,
    [string]$Error,
    [datetimeoffset]$StartedAt,
    [string]$StdoutTail = "",
    [string]$StderrTail = "",
    [string]$StdoutPath = "",
    [string]$StderrPath = "",
    [object]$Details = $null
  )
  $steps.Add([ordered]@{
    id = $Id
    status = $Status
    exitCode = $ExitCode
    startedAt = $StartedAt.ToString("O")
    completedAt = [DateTimeOffset]::UtcNow.ToString("O")
    error = $Error
    stdoutTail = $StdoutTail
    stderrTail = $StderrTail
    fullStdoutPath = $StdoutPath
    fullStderrPath = $StderrPath
    details = $Details
  })
}

function Add-DiscoveryStep {
  param([string]$Id, [bool]$Passed, [object]$Details, [string]$Error)
  $now = [DateTimeOffset]::UtcNow
  Add-StepResult -Id $Id -Status $(if ($Passed) { "PASS" } else { "FAIL" }) -ExitCode $(if ($Passed) { 0 } else { 1 }) -Error $(if ($Passed) { $null } else { $Error }) -StartedAt $now -Details $Details
}

function Add-NotRunStep {
  param([string]$Id, [string]$Reason)
  $now = [DateTimeOffset]::UtcNow
  Add-StepResult -Id $Id -Status "NOT_RUN" -ExitCode -1 -Error $Reason -StartedAt $now
}

function Invoke-RecordedProcess {
  param([string]$Id, [string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory)
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
    [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
    $stdout = [string]$stdoutTask.Result
    $stderr = [string]$stderrTask.Result
    $safeId = $Id -replace '[^A-Za-z0-9._-]', '_'
    $stdoutPath = Join-Path $validationRoot "build227-$safeId-full-stdout.log"
    $stderrPath = Join-Path $validationRoot "build227-$safeId-full-stderr.log"
    [System.IO.File]::WriteAllText($stdoutPath, $stdout, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::WriteAllText($stderrPath, $stderr, [System.Text.UTF8Encoding]::new($false))
    $tailLength = 12000
    $stdoutTail = if ($stdout.Length -gt $tailLength) { $stdout.Substring($stdout.Length - $tailLength) } else { $stdout }
    $stderrTail = if ($stderr.Length -gt $tailLength) { $stderr.Substring($stderr.Length - $tailLength) } else { $stderr }
    $passed = $process.ExitCode -eq 0
    Add-StepResult -Id $Id -Status $(if ($passed) { "PASS" } else { "FAIL" }) -ExitCode $process.ExitCode -Error $null -StartedAt $startedAt -StdoutTail $stdoutTail -StderrTail $stderrTail -StdoutPath (Split-Path -Leaf $stdoutPath) -StderrPath (Split-Path -Leaf $stderrPath)
    return $passed
  } catch {
    Add-StepResult -Id $Id -Status "FAIL" -ExitCode 1 -Error $_.Exception.Message -StartedAt $startedAt
    return $false
  }
}

function Step-Passed([string]$Id) {
  $row = $steps | Where-Object { $_.id -eq $Id } | Select-Object -Last 1
  return ($null -ne $row -and $row.status -eq "PASS")
}

function Get-ApplicationUninstallEntries {
  if (-not (Test-Path -LiteralPath $uninstallRegistryRoot)) { return @() }
  $entries = @()
  foreach ($key in Get-ChildItem -LiteralPath $uninstallRegistryRoot -ErrorAction SilentlyContinue) {
    try {
      $item = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
      $displayName = [string]$item.DisplayName
      if ($displayName -eq $productName -or $displayName.StartsWith("$productName ", [System.StringComparison]::Ordinal)) {
        $entries += [pscustomobject]@{
          RegistryPath = $key.PSPath
          DisplayName = $displayName
          DisplayVersion = [string]$item.DisplayVersion
          InstallLocation = [string]$item.InstallLocation
          UninstallString = [string]$item.UninstallString
        }
      }
    } catch { }
  }
  return @($entries)
}

function Resolve-UninstallerFromCommand([string]$Command) {
  if (-not $Command) { return $null }
  if ($Command -match '^"([^"]+)"') { return $Matches[1] }
  if ($Command -match '^([^ ]+\.exe)') { return $Matches[1] }
  return $null
}

function Find-InstallFiles {
  if (-not (Test-Path -LiteralPath $installRoot -PathType Container)) {
    return [pscustomobject]@{ Executable = $null; Uninstaller = $null }
  }
  $executables = @(Get-ChildItem -LiteralPath $installRoot -Filter "*.exe" -File -Recurse -ErrorAction SilentlyContinue)
  $uninstallerFile = $executables | Where-Object { $_.Name -match '(?i)^uninstall' } | Sort-Object FullName | Select-Object -First 1
  $applicationFile = $executables | Where-Object { $_.Name -notmatch '(?i)^uninstall' } | Sort-Object FullName | Select-Object -First 1
  return [pscustomobject]@{
    Executable = if ($applicationFile) { $applicationFile.FullName } else { $null }
    Uninstaller = if ($uninstallerFile) { $uninstallerFile.FullName } else { $null }
  }
}

try {
  if ($PSVersionTable.PSEdition -eq "Core" -and -not $IsWindows) { throw "Unified Bronze security validation can run only on real Windows." }
  $existingEntries = @(Get-ApplicationUninstallEntries)
  $blockingEntries = @($existingEntries | Where-Object {
    $candidate = Resolve-UninstallerFromCommand $_.UninstallString
    $candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)
  })
  if ($blockingEntries.Count -gt 0) {
    throw "An existing installed copy is present; validation will not replace a user installation."
  }

  $buildOk = Invoke-RecordedProcess -Id "windows-installer-build" -FilePath "cmd.exe" -Arguments @("/d", "/s", "/c", "npm.cmd run package:win --workspace @ppt/desktop") -WorkingDirectory $root
  if ($buildOk) {
    [void](Invoke-RecordedProcess -Id "development-open021-launch" -FilePath "node.exe" -Arguments @("scripts\windows-open021-launch-test.mjs") -WorkingDirectory $root)
    [void](Invoke-RecordedProcess -Id "development-open022-launch" -FilePath "node.exe" -Arguments @("scripts\windows-open022-launch-test.mjs") -WorkingDirectory $root)

    $installerPath = Get-ChildItem -LiteralPath $releaseRoot -File -Filter "*.exe" |
      Where-Object { $_.Name -notlike "*.__uninstaller.exe" } |
      Sort-Object LastWriteTimeUtc -Descending |
      Select-Object -First 1 -ExpandProperty FullName
    if (-not $installerPath) {
      Add-NotRunStep -Id "silent-install" -Reason "Installer artifact was not found after package:win."
      Add-NotRunStep -Id "installed-executable-found" -Reason "Installation did not run."
      Add-NotRunStep -Id "uninstaller-found" -Reason "Installation did not run."
      Add-NotRunStep -Id "uninstall-registry-found" -Reason "Installation did not run."
      Add-NotRunStep -Id "installed-open021-launch" -Reason "Installation was not available."
      Add-NotRunStep -Id "installed-open022-launch" -Reason "Installation was not available."
      Add-NotRunStep -Id "silent-uninstall" -Reason "Installation was not available."
      Add-NotRunStep -Id "lifecycle-cleanup" -Reason "Installation was not available."
    } else {
      $installOk = Invoke-RecordedProcess -Id "silent-install" -FilePath $installerPath -Arguments @("/S", "/currentuser", "--no-desktop-shortcut", "/D=$installRoot") -WorkingDirectory $root
      if ($installOk) {
        $deadline = [DateTimeOffset]::UtcNow.AddSeconds(90)
        do {
          $files = Find-InstallFiles
          $entries = @(Get-ApplicationUninstallEntries | Where-Object {
            ([string]$_.InstallLocation -eq $installRoot) -or ([string]$_.UninstallString -like "*$installRoot*")
          })
          if ($files.Executable -and $files.Uninstaller -and $entries.Count -gt 0) { break }
          Start-Sleep -Milliseconds 500
        } while ([DateTimeOffset]::UtcNow -lt $deadline)

        $installedExecutable = $files.Executable
        $uninstaller = $files.Uninstaller
        $installRegistryPath = if ($entries.Count -gt 0) { $entries[0].RegistryPath } else { $null }
        Add-DiscoveryStep -Id "installed-executable-found" -Passed ([bool]($installedExecutable -and (Test-Path -LiteralPath $installedExecutable -PathType Leaf))) -Details $installedExecutable -Error "Installed executable was not discovered within the bounded polling window."
        Add-DiscoveryStep -Id "uninstaller-found" -Passed ([bool]($uninstaller -and (Test-Path -LiteralPath $uninstaller -PathType Leaf))) -Details $uninstaller -Error "Uninstaller was not discovered within the bounded polling window."
        Add-DiscoveryStep -Id "uninstall-registry-found" -Passed ([bool]$installRegistryPath) -Details $installRegistryPath -Error "Dynamic uninstall registry record was not discovered."

        if (Step-Passed "installed-executable-found") {
          [void](Invoke-RecordedProcess -Id "installed-open021-launch" -FilePath "node.exe" -Arguments @("scripts\windows-open021-launch-test.mjs", "--executable=$installedExecutable") -WorkingDirectory $root)
          [void](Invoke-RecordedProcess -Id "installed-open022-launch" -FilePath "node.exe" -Arguments @("scripts\windows-open022-launch-test.mjs", "--executable=$installedExecutable") -WorkingDirectory $root)
        } else {
          Add-NotRunStep -Id "installed-open021-launch" -Reason "Installed executable discovery failed."
          Add-NotRunStep -Id "installed-open022-launch" -Reason "Installed executable discovery failed."
        }

        if ($KeepInstalled) {
          Add-NotRunStep -Id "silent-uninstall" -Reason "KeepInstalled was requested; official closure requires uninstall PASS."
          Add-NotRunStep -Id "lifecycle-cleanup" -Reason "KeepInstalled was requested."
        } elseif (Step-Passed "uninstaller-found") {
          [void](Invoke-RecordedProcess -Id "silent-uninstall" -FilePath $uninstaller -Arguments @("/S", "/currentuser") -WorkingDirectory $root)
          $cleanupDeadline = [DateTimeOffset]::UtcNow.AddSeconds(90)
          do {
            $remainingEntries = @(Get-ApplicationUninstallEntries | Where-Object {
              ([string]$_.InstallLocation -eq $installRoot) -or ([string]$_.UninstallString -like "*$installRoot*")
            })
            $residue.Clear()
            if (Test-Path -LiteralPath $installRoot) {
              foreach ($path in @(Get-ChildItem -LiteralPath $installRoot -Force -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)) {
                [void]$residue.Add($path)
              }
            }
            if ($remainingEntries.Count -eq 0 -and $residue.Count -eq 0) { break }
            Start-Sleep -Milliseconds 500
          } while ([DateTimeOffset]::UtcNow -lt $cleanupDeadline)
          $cleanupPassed = $remainingEntries.Count -eq 0 -and $residue.Count -eq 0
          Add-DiscoveryStep -Id "lifecycle-cleanup" -Passed $cleanupPassed -Details ([ordered]@{ registryEntries = $remainingEntries.Count; residue = $residue }) -Error "Application files or uninstall registry residue remained after silent uninstall."
        } else {
          Add-NotRunStep -Id "silent-uninstall" -Reason "Uninstaller discovery failed."
          Add-NotRunStep -Id "lifecycle-cleanup" -Reason "Uninstaller discovery failed."
        }
      } else {
        Add-NotRunStep -Id "installed-executable-found" -Reason "Silent install failed."
        Add-NotRunStep -Id "uninstaller-found" -Reason "Silent install failed."
        Add-NotRunStep -Id "uninstall-registry-found" -Reason "Silent install failed."
        Add-NotRunStep -Id "installed-open021-launch" -Reason "Silent install failed."
        Add-NotRunStep -Id "installed-open022-launch" -Reason "Silent install failed."
        Add-NotRunStep -Id "silent-uninstall" -Reason "Silent install failed."
        Add-NotRunStep -Id "lifecycle-cleanup" -Reason "Silent install failed."
      }
    }
  } else {
    foreach ($id in @("development-open021-launch", "development-open022-launch", "silent-install", "installed-executable-found", "uninstaller-found", "uninstall-registry-found", "installed-open021-launch", "installed-open022-launch", "silent-uninstall", "lifecycle-cleanup")) {
      Add-NotRunStep -Id $id -Reason "Installer/build step failed."
    }
  }
} catch {
  $infrastructureFailure = $_.Exception.Message
} finally {
  if (-not $KeepInstalled -and $uninstaller -and (Test-Path -LiteralPath $uninstaller -PathType Leaf) -and -not (Step-Passed "silent-uninstall")) {
    try { Start-Process -FilePath $uninstaller -ArgumentList @("/S", "/currentuser") -WorkingDirectory $root -Wait -WindowStyle Hidden | Out-Null } catch { }
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

  $sharedIds = @("windows-installer-build", "silent-install", "installed-executable-found", "uninstaller-found", "uninstall-registry-found", "silent-uninstall", "lifecycle-cleanup")
  $open021Ids = @("development-open021-launch", "installed-open021-launch")
  $open022Ids = @("development-open022-launch", "installed-open022-launch")
  $sharedPass = (-not $infrastructureFailure) -and (($sharedIds | Where-Object { -not (Step-Passed $_) }).Count -eq 0)
  $open021Pass = $sharedPass -and (($open021Ids | Where-Object { -not (Step-Passed $_) }).Count -eq 0)
  $open022Pass = $sharedPass -and (($open022Ids | Where-Object { -not (Step-Passed $_) }).Count -eq 0)
  $overall = if ($open021Pass -and $open022Pass) { "PASS" } elseif ($open021Pass -or $open022Pass) { "PARTIAL" } else { "FAIL" }

  $evidence = [ordered]@{
    schemaVersion = 1
    product = $productName
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
    installationPathLength = $installRoot.Length
    installedExecutable = $installedExecutable
    uninstaller = $uninstaller
    uninstallRegistryPath = $installRegistryPath
    residue = $residue
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
  [System.IO.File]::WriteAllText($EvidencePath, "$($evidence | ConvertTo-Json -Depth 12)`n", [System.Text.UTF8Encoding]::new($false))
}

Write-Host "Unified Bronze Windows security lifecycle evidence: $EvidencePath"
if ($infrastructureFailure) { Write-Error $infrastructureFailure; exit 1 }
if ($open021Pass -and $open022Pass) { Write-Host "Unified lifecycle: PASS for OPEN-021 and OPEN-022"; exit 0 }
if ($open021Pass) { Write-Warning "Unified lifecycle: OPEN-021 PASS, OPEN-022 FAIL"; exit 21 }
if ($open022Pass) { Write-Warning "Unified lifecycle: OPEN-022 PASS, OPEN-021 FAIL"; exit 22 }
Write-Error "Unified lifecycle did not produce closure-ready evidence for either OPEN item."
exit 1
