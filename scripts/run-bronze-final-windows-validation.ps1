param(
  [string]$EvidencePath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$validationRoot = Join-Path $root "artifacts\validation"
$runId = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmss")
$appMetaSource = Get-Content -LiteralPath (Join-Path $root "packages\domain\src\app-meta.ts") -Raw
$applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
$packageVersionMatch = [regex]::Match($appMetaSource, "packageVersion: '([^']+)'")
if (-not $applicationVersionMatch.Success -or -not $packageVersionMatch.Success) {
  throw "Application/package version could not be resolved from app-meta.ts."
}
$applicationVersion = $applicationVersionMatch.Groups[1].Value
$packageVersion = $packageVersionMatch.Groups[1].Value
$buildText = $applicationVersion.Split('.')[-1]
if ($buildText -notmatch '^\d+$') { throw "Build number could not be resolved from application version=$applicationVersion." }
$build = [int]$buildText
$prefix = "build$build"
if (-not $EvidencePath) {
  $EvidencePath = Join-Path $validationRoot "$prefix-bronze-final-windows-validation-summary.json"
}

New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null
$steps = [System.Collections.Generic.List[object]]::new()
$failure = $null

function Invoke-ValidationStep {
  param(
    [string]$Id,
    [scriptblock]$Operation
  )
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
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") {
    throw "Bronze Final Windows validation can run only on Windows."
  }
  if (-not (Get-Command "node.exe" -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install the project-required Node.js version and retry."
  }
  if (-not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install the project-required Node.js version and retry."
  }

  $npmCacheRoot = Join-Path $validationRoot "npm-cache"
  New-Item -ItemType Directory -Force -Path $npmCacheRoot | Out-Null
  $env:PPT_NPM_CACHE_PATH = $npmCacheRoot
  $env:npm_config_cache = $npmCacheRoot
  $env:NPM_CONFIG_CACHE = $npmCacheRoot

  Invoke-ValidationStep -Id "source-preflight" -Operation {
    & node.exe "scripts\run-source-preflight.mjs" `
      "--report" "artifacts\validation\$prefix-source-preflight-windows.json"
  }
  Invoke-ValidationStep -Id "complete-rc2-gates" -Operation {
    & node.exe "scripts\run-rc2-validation-gates.mjs" `
      "--report" "artifacts\validation\$prefix-rc2-validation-report-windows.json"
  }
  Invoke-ValidationStep -Id "official-windows-lifecycle" -Operation {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
      -File "scripts\windows-release-validation.ps1" `
      -EvidencePath "artifacts\validation\$prefix-windows-release-lifecycle.json"
  }
  Invoke-ValidationStep -Id "open021-open022-windows-security-evidence" -Operation {
    & node.exe "scripts\verify-build216-windows-security-evidence-result.mjs" `
      $applicationVersion `
      "artifacts\validation\windows-real-launch-probe.json" `
      "artifacts\validation\windows-packaged-launch-probe.json" `
      "artifacts\validation\$prefix-windows-security-evidence-result.json"
  }
  Invoke-ValidationStep -Id "production-dependency-audit" -Operation {
    & node.exe "scripts\run-npm-audit-evidence.mjs" `
      "--scope" "production" `
      "--raw" "artifacts\validation\$prefix-production-npm-audit.json" `
      "--report" "artifacts\validation\$prefix-production-dependency-audit.json"
  }
  Invoke-ValidationStep -Id "build-toolchain-dependency-audit" -Operation {
    & node.exe "scripts\run-npm-audit-evidence.mjs" `
      "--scope" "build-toolchain" `
      "--raw" "artifacts\validation\$prefix-build-tool-npm-audit.json" `
      "--report" "artifacts\validation\$prefix-build-toolchain-dependency-audit.json"
  }
} catch {
  $failure = $_.Exception.Message
} finally {
  Pop-Location
}

$machineHasher = [System.Security.Cryptography.SHA256]::Create()
try {
  $machineNameSha256 = [BitConverter]::ToString(
    $machineHasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes([System.Environment]::MachineName))
  ).Replace("-", "").ToLowerInvariant()
} finally {
  $machineHasher.Dispose()
}

$summary = [ordered]@{
  schemaVersion = 2
  product = "Anadolu Parsı Aile Yaşam Merkezi"
  applicationVersion = $applicationVersion
  packageVersion = $packageVersion
  build = $build
  stage = "Bronze RC2 Active Development"
  status = if ($failure) { "FAIL" } else { "PASS" }
  officialSandboxRequired = $true
  diagnosticResultsAcceptedAsOfficial = $false
  open021WindowsEfsRequired = $true
  open022WindowsSafeStorageDpapiRequired = $true
  packagedElectronRequired = $true
  generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  host = [ordered]@{
    osVersion = [System.Environment]::OSVersion.VersionString
    powershellVersion = $PSVersionTable.PSVersion.ToString()
    machineNameSha256 = $machineNameSha256
  }
  steps = $steps
  error = $failure
}

$summaryJson = $summary | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($EvidencePath, "$summaryJson`n", [System.Text.UTF8Encoding]::new($false))

$sourceManifestPath = Join-Path $root "manifest.json"
$sourceSha256SumsPath = Join-Path $root "SHA256SUMS.txt"
if (-not (Test-Path -LiteralPath $sourceManifestPath -PathType Leaf)) { throw "Source manifest missing: $sourceManifestPath" }
if (-not (Test-Path -LiteralPath $sourceSha256SumsPath -PathType Leaf)) { throw "Source SHA256SUMS missing: $sourceSha256SumsPath" }

$evidenceSpecs = @(
  [ordered]@{ id = "summary"; path = $EvidencePath; required = $true },
  [ordered]@{ id = "source-preflight"; path = (Join-Path $validationRoot "$prefix-source-preflight-windows.json"); required = $true },
  [ordered]@{ id = "rc2-validation"; path = (Join-Path $validationRoot "$prefix-rc2-validation-report-windows.json"); required = $true },
  [ordered]@{ id = "windows-release-lifecycle"; path = (Join-Path $validationRoot "$prefix-windows-release-lifecycle.json"); required = $true },
  [ordered]@{ id = "windows-security-evidence"; path = (Join-Path $validationRoot "$prefix-windows-security-evidence-result.json"); required = $true },
  [ordered]@{ id = "development-launch-probe"; path = (Join-Path $validationRoot "windows-real-launch-probe.json"); required = $true },
  [ordered]@{ id = "packaged-launch-probe"; path = (Join-Path $validationRoot "windows-packaged-launch-probe.json"); required = $true },
  [ordered]@{ id = "production-dependency-audit"; path = (Join-Path $validationRoot "$prefix-production-dependency-audit.json"); required = $true },
  [ordered]@{ id = "build-toolchain-dependency-audit"; path = (Join-Path $validationRoot "$prefix-build-toolchain-dependency-audit.json"); required = $true }
)
$manifestFiles = @()
foreach ($spec in $evidenceSpecs) {
  $present = Test-Path -LiteralPath $spec.path -PathType Leaf
  $item = [ordered]@{
    id = $spec.id
    relativePath = Split-Path -Leaf $spec.path
    required = $spec.required
    present = $present
    sizeBytes = $null
    sha256 = $null
  }
  if ($present) {
    $file = Get-Item -LiteralPath $spec.path
    $item.sizeBytes = $file.Length
    $item.sha256 = (Get-FileHash -LiteralPath $spec.path -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  $manifestFiles += $item
}
$manifestStatus = if ($failure -or ($manifestFiles | Where-Object { $_.required -and -not $_.present }).Count -gt 0) { "FAIL" } else { "PASS" }
$evidenceManifest = [ordered]@{
  schemaVersion = 1
  product = "Anadolu Parsı Aile Yaşam Merkezi"
  build = $build
  applicationVersion = $applicationVersion
  packageVersion = $packageVersion
  platform = "win32"
  status = $manifestStatus
  generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
  host = [ordered]@{ machineNameSha256 = $machineNameSha256; osVersion = [System.Environment]::OSVersion.VersionString }
  source = [ordered]@{
    manifestSha256 = (Get-FileHash -LiteralPath $sourceManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    sha256SumsSha256 = (Get-FileHash -LiteralPath $sourceSha256SumsPath -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  files = $manifestFiles
}
$evidenceManifestPath = Join-Path $validationRoot "$prefix-windows-evidence-manifest.json"
[System.IO.File]::WriteAllText($evidenceManifestPath, "$(($evidenceManifest | ConvertTo-Json -Depth 8))`n", [System.Text.UTF8Encoding]::new($false))

$bundlePath = Join-Path $validationRoot "Bronze_Final_Windows_Kanitlari_Build${build}_$runId.zip"
$evidenceFiles = @($evidenceManifestPath) + @($evidenceSpecs | ForEach-Object { $_.path } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
if ($evidenceFiles.Count -gt 0) {
  Compress-Archive -LiteralPath $evidenceFiles -DestinationPath $bundlePath -Force
}
$bundleShaPath = "$bundlePath.sha256"
if (Test-Path -LiteralPath $bundlePath -PathType Leaf) {
  $bundleSha = (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText($bundleShaPath, "$bundleSha  $(Split-Path -Leaf $bundlePath)`n", [System.Text.UTF8Encoding]::new($false))
}

Write-Host "Evidence summary: $EvidencePath"
Write-Host "Evidence manifest: $evidenceManifestPath"
Write-Host "Evidence bundle: $bundlePath"
Write-Host "Evidence bundle SHA-256: $bundleShaPath"
if ($failure) {
  Write-Error $failure
  exit 1
}
Write-Host "Bronze Final Windows validation: PASS — Build $build / $applicationVersion"
