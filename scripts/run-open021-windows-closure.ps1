param(
  [switch]$KeepInstalled
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$validationRoot = Join-Path $root "artifacts\validation"
New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null

$appMetaSource = Get-Content -LiteralPath (Join-Path $root "packages\domain\src\app-meta.ts") -Raw
$applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
if (-not $applicationVersionMatch.Success) { throw "Application version could not be resolved." }
$applicationVersion = $applicationVersionMatch.Groups[1].Value
$build = [int]($applicationVersion.Split('.')[-1])
if ($build -ne 217) { throw "OPEN-021 close runner requires Build217; current build=$build." }
$runId = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmss")
$failure = $null
$steps = [System.Collections.Generic.List[object]]::new()

function Invoke-Open021Step {
  param([string]$Id,[scriptblock]$Operation)
  $startedAt = [DateTimeOffset]::UtcNow
  $global:LASTEXITCODE = 0
  & $Operation
  $exitCode = $LASTEXITCODE
  if ($null -eq $exitCode) { $exitCode = 0 }
  $steps.Add([ordered]@{
    id = $Id
    status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
    exitCode = $exitCode
    startedAt = $startedAt.ToString("O")
    completedAt = [DateTimeOffset]::UtcNow.ToString("O")
  })
  if ($exitCode -ne 0) { throw "$Id failed with exit code $exitCode." }
}

Push-Location $root
try {
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") { throw "OPEN-021 can be closed only with real Windows evidence." }
  if (-not (Get-Command "node.exe" -ErrorAction SilentlyContinue)) { throw "Node.js is required." }
  if (-not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) { throw "npm is required." }

  Invoke-Open021Step -Id "exact-source-integrity" -Operation {
    & node.exe "scripts\verify-source-integrity.mjs" "--report" "artifacts\validation\build217-open021-source-integrity-windows.json"
  }

  Invoke-Open021Step -Id "dependency-bootstrap-prerequisite" -Operation {
    & npm.cmd ci --no-audit --no-fund
  }

  Invoke-Open021Step -Id "official-open021-windows-lifecycle" -Operation {
    $args = @(
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", "scripts\windows-open021-release-validation.ps1",
      "-EvidencePath", "artifacts\validation\build217-open021-windows-release-lifecycle.json"
    )
    if ($KeepInstalled) { $args += "-KeepInstalled" }
    & powershell.exe @args
  }

  Invoke-Open021Step -Id "open021-result-verification" -Operation {
    & node.exe "scripts\verify-build217-open021-windows-result.mjs" `
      $applicationVersion `
      "artifacts\validation\build217-open021-windows-release-lifecycle.json" `
      "artifacts\validation\windows-open021-development-launch-probe.json" `
      "artifacts\validation\windows-open021-packaged-launch-probe.json" `
      "artifacts\validation\build217-open021-source-integrity-windows.json" `
      "artifacts\validation\build217-open021-windows-closure-result.json"
  }
} catch {
  $failure = $_.Exception.Message
} finally {
  Pop-Location
}

$summaryPath = Join-Path $validationRoot "build217-open021-windows-run-summary.json"
$summary = [ordered]@{
  schemaVersion = 1
  product = "Anadolu Parsı Aile Yaşam Merkezi"
  applicationVersion = $applicationVersion
  build = $build
  openWorkId = "OPEN-021"
  status = if ($failure) { "FAIL" } else { "PASS" }
  closureReadiness = if ($failure) { "NOT_READY" } else { "READY_TO_CLOSE" }
  realWindowsRequired = $true
  prerequisiteNpmCiDoesNotAutoCloseOpen002 = $true
  open022StatusMutation = "NONE"
  generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  host = [ordered]@{
    osVersion = [System.Environment]::OSVersion.VersionString
    powershellVersion = $PSVersionTable.PSVersion.ToString()
  }
  steps = $steps
  error = $failure
}
[System.IO.File]::WriteAllText($summaryPath, "$(($summary | ConvertTo-Json -Depth 8))`n", [System.Text.UTF8Encoding]::new($false))

$sourceManifestPath = Join-Path $root "manifest.json"
$sourceShaSumsPath = Join-Path $root "SHA256SUMS.txt"
if (Test-Path -LiteralPath $sourceManifestPath -PathType Leaf -and Test-Path -LiteralPath $sourceShaSumsPath -PathType Leaf) {
  $evidencePaths = @(
    $summaryPath,
    (Join-Path $validationRoot "build217-open021-source-integrity-windows.json"),
    (Join-Path $validationRoot "build217-open021-windows-release-lifecycle.json"),
    (Join-Path $validationRoot "windows-open021-development-launch-probe.json"),
    (Join-Path $validationRoot "windows-open021-packaged-launch-probe.json"),
    (Join-Path $validationRoot "build217-open021-windows-closure-result.json")
  )
  $files = @()
  foreach ($path in $evidencePaths) {
    $present = Test-Path -LiteralPath $path -PathType Leaf
    $files += [ordered]@{
      relativePath = Split-Path -Leaf $path
      required = $true
      present = $present
      sizeBytes = if ($present) { (Get-Item -LiteralPath $path).Length } else { $null }
      sha256 = if ($present) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() } else { $null }
    }
  }
  $manifest = [ordered]@{
    schemaVersion = 1
    product = "Anadolu Parsı Aile Yaşam Merkezi"
    build = $build
    applicationVersion = $applicationVersion
    openWorkId = "OPEN-021"
    platform = "win32"
    status = if (-not $failure -and ($files | Where-Object { $_.required -and -not $_.present }).Count -eq 0) { "PASS" } else { "FAIL" }
    source = [ordered]@{
      manifestSha256 = (Get-FileHash -LiteralPath $sourceManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
      sha256SumsSha256 = (Get-FileHash -LiteralPath $sourceShaSumsPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    files = $files
    generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  }
  $manifestPath = Join-Path $validationRoot "build217-open021-windows-evidence-manifest.json"
  [System.IO.File]::WriteAllText($manifestPath, "$(($manifest | ConvertTo-Json -Depth 8))`n", [System.Text.UTF8Encoding]::new($false))

  $bundleFiles = @($manifestPath) + @($evidencePaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
  $bundlePath = Join-Path $validationRoot "OPEN021_Windows_Kanitlari_Build217_$runId.zip"
  Compress-Archive -LiteralPath $bundleFiles -DestinationPath $bundlePath -Force
  $bundleSha = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText("$bundlePath.sha256", "$bundleSha  $(Split-Path -Leaf $bundlePath)`n", [System.Text.UTF8Encoding]::new($false))
  Write-Host "OPEN-021 evidence bundle: $bundlePath"
  Write-Host "OPEN-021 evidence SHA-256: $bundlePath.sha256"
}

Write-Host "OPEN-021 run summary: $summaryPath"
if ($failure) { Write-Error $failure; exit 1 }
Write-Host "OPEN-021 Windows evidence: PASS — READY_TO_CLOSE"
exit 0
