param([switch]$KeepInstalled)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$validationRoot = Join-Path $root "artifacts\validation"
New-Item -ItemType Directory -Force -Path $validationRoot | Out-Null
$appMetaSource = Get-Content -LiteralPath (Join-Path $root "packages\domain\src\app-meta.ts") -Raw
$applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
if (-not $applicationVersionMatch.Success) { throw "Application version could not be resolved." }
$applicationVersion = $applicationVersionMatch.Groups[1].Value
$build = [int]($applicationVersion.Split('.')[-1])
if ($build -ne 226) { throw "Unified Bronze Windows closure requires Build226; current build=$build." }
$runId = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmss")
$steps = [System.Collections.Generic.List[object]]::new()
$failure = $null
$resultExitCode = 1

function Invoke-RequiredStep {
  param([string]$Id,[scriptblock]$Operation)
  $startedAt=[DateTimeOffset]::UtcNow; $global:LASTEXITCODE=0
  & $Operation
  $exitCode=$LASTEXITCODE; if($null -eq $exitCode){$exitCode=0}
  $steps.Add([ordered]@{id=$Id;status=if($exitCode -eq 0){"PASS"}else{"FAIL"};exitCode=$exitCode;startedAt=$startedAt.ToString("O");completedAt=[DateTimeOffset]::UtcNow.ToString("O")})
  if($exitCode -ne 0){throw "$Id failed with exit code $exitCode."}
}

Push-Location $root
try {
  if (-not $IsWindows -and $PSVersionTable.PSEdition -eq "Core") { throw "Unified Bronze closure requires a real Windows host." }
  if (-not (Get-Command "node.exe" -ErrorAction SilentlyContinue)) { throw "Node.js is required." }
  if (-not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) { throw "npm is required." }

  Invoke-RequiredStep -Id "exact-source-integrity" -Operation {
    & node.exe "scripts\verify-source-integrity.mjs" "--report" "artifacts\validation\build226-bronze-security-source-integrity-windows.json"
  }
  Invoke-RequiredStep -Id "dependency-bootstrap-prerequisite" -Operation {
    & npm.cmd ci --no-audit --no-fund
  }

  Invoke-RequiredStep -Id "windows-packager-bootstrap-prerequisite" -Operation {
    & npm.cmd run windows-packager:install
  }
  $builderCli = Join-Path $root "tools\windows-packager\node_modules\electron-builder\cli.js"
  if (-not (Test-Path -LiteralPath $builderCli -PathType Leaf)) { throw "Isolated electron-builder CLI was not installed." }

  Invoke-RequiredStep -Id "workspace-package-build-prerequisite" -Operation {
    & npm.cmd run build:packages
  }
  Invoke-RequiredStep -Id "workspace-package-dist-guard" -Operation {
    & node.exe "scripts\verify-build226-workspace-dist-prerequisite.mjs"
  }

  Invoke-RequiredStep -Id "license-rtf-sync-prerequisite" -Operation {
    & npm.cmd run verify:license-sync --workspace @ppt/desktop
  }

  $lifecycleArgs=@("-NoProfile","-ExecutionPolicy","Bypass","-File","scripts\windows-bronze-security-release-validation-build226.ps1","-EvidencePath","artifacts\validation\build226-bronze-security-windows-release-lifecycle.json")
  if($KeepInstalled){$lifecycleArgs += "-KeepInstalled"}
  & powershell.exe @lifecycleArgs
  $lifecycleExit=$LASTEXITCODE; if($null -eq $lifecycleExit){$lifecycleExit=1}
  $steps.Add([ordered]@{id="unified-windows-lifecycle";status=if($lifecycleExit -eq 0){"PASS"}elseif($lifecycleExit -eq 21 -or $lifecycleExit -eq 22){"PARTIAL"}else{"FAIL"};exitCode=$lifecycleExit;startedAt=$null;completedAt=[DateTimeOffset]::UtcNow.ToString("O")})

  & node.exe "scripts\verify-build226-bronze-security-windows-result.mjs" $applicationVersion `
    "artifacts\validation\build226-bronze-security-windows-release-lifecycle.json" `
    "artifacts\validation\windows-open021-development-launch-probe.json" `
    "artifacts\validation\windows-open021-packaged-launch-probe.json" `
    "artifacts\validation\windows-open022-development-launch-probe.json" `
    "artifacts\validation\windows-open022-packaged-launch-probe.json" `
    "artifacts\validation\build226-bronze-security-source-integrity-windows.json" `
    "artifacts\validation\build226-bronze-security-windows-closure-result.json"
  $resultExitCode=$LASTEXITCODE; if($null -eq $resultExitCode){$resultExitCode=1}
  $steps.Add([ordered]@{id="unified-result-verification";status=if($resultExitCode -eq 0){"PASS"}elseif($resultExitCode -eq 21 -or $resultExitCode -eq 22){"PARTIAL"}else{"FAIL"};exitCode=$resultExitCode;startedAt=$null;completedAt=[DateTimeOffset]::UtcNow.ToString("O")})
} catch { $failure=$_.Exception.Message } finally { Pop-Location }

$resultPath=Join-Path $validationRoot "build226-bronze-security-windows-closure-result.json"
$result=$null
if(Test-Path -LiteralPath $resultPath -PathType Leaf){ try{$result=Get-Content -LiteralPath $resultPath -Raw|ConvertFrom-Json}catch{} }
$open021Readiness=if($result){[string]$result.closureReadiness.open021}else{"NOT_READY"}
$open022Readiness=if($result){[string]$result.closureReadiness.open022}else{"NOT_READY"}
$summaryPath=Join-Path $validationRoot "build226-bronze-security-windows-run-summary.json"
$summary=[ordered]@{
  schemaVersion=1;product="Anadolu Parsı Aile Yaşam Merkezi";applicationVersion=$applicationVersion;build=$build;
  evidencePurpose="Unified OPEN-021 + OPEN-022 real Windows closure";
  status=if($failure){"FAIL"}elseif($open021Readiness -eq "READY_TO_CLOSE" -and $open022Readiness -eq "READY_TO_CLOSE"){"PASS"}elseif($open021Readiness -eq "READY_TO_CLOSE" -or $open022Readiness -eq "READY_TO_CLOSE"){"PARTIAL"}else{"FAIL"};
  closureReadiness=[ordered]@{open021=$open021Readiness;open022=$open022Readiness;ledgerMutationPerformed=$false};
  realWindowsRequired=$true;prerequisiteNpmCiDoesNotAutoCloseOpen002=$true;generatedAt=[DateTimeOffset]::UtcNow.ToString("O");
  host=[ordered]@{osVersion=[System.Environment]::OSVersion.VersionString;powershellVersion=$PSVersionTable.PSVersion.ToString()};steps=$steps;error=$failure
}
[System.IO.File]::WriteAllText($summaryPath,"$($summary|ConvertTo-Json -Depth 10)`n",[System.Text.UTF8Encoding]::new($false))

$sourceManifestPath=Join-Path $root "manifest.json"; $sourceShaSumsPath=Join-Path $root "SHA256SUMS.txt"
if((Test-Path -LiteralPath $sourceManifestPath -PathType Leaf)-and(Test-Path -LiteralPath $sourceShaSumsPath -PathType Leaf)){
  $evidencePaths=@(
    $summaryPath,
    (Join-Path $validationRoot "build226-bronze-security-source-integrity-windows.json"),
    (Join-Path $validationRoot "build226-bronze-security-windows-release-lifecycle.json"),
    (Join-Path $validationRoot "windows-open021-development-launch-probe.json"),
    (Join-Path $validationRoot "windows-open021-packaged-launch-probe.json"),
    (Join-Path $validationRoot "windows-open022-development-launch-probe.json"),
    (Join-Path $validationRoot "windows-open022-packaged-launch-probe.json"),
    $resultPath
  )
  $fullDiagnosticLogs = @(
    Get-ChildItem -LiteralPath $validationRoot -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like 'build226-*-full-*.log' -or $_.Name -like 'windows-open02*-full-*.log' -or $_.Name -like 'windows-open02*-early-startup.json' } |
      Select-Object -ExpandProperty FullName
  )
  $evidencePaths += $fullDiagnosticLogs
  $files=@();foreach($path in $evidencePaths){$present=Test-Path -LiteralPath $path -PathType Leaf;$files+=[ordered]@{relativePath=Split-Path -Leaf $path;required=$true;present=$present;sizeBytes=if($present){(Get-Item -LiteralPath $path).Length}else{$null};sha256=if($present){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}else{$null}}}
  $manifest=[ordered]@{schemaVersion=1;product="Anadolu Parsı Aile Yaşam Merkezi";build=$build;applicationVersion=$applicationVersion;platform="win32";evidencePurpose="Unified OPEN-021 + OPEN-022 real Windows closure";bundleIntegrityStatus=if(($files|Where-Object{$_.required -and -not $_.present}).Count -eq 0){"PASS"}else{"FAIL"};closureReadiness=[ordered]@{open021=$open021Readiness;open022=$open022Readiness};source=[ordered]@{manifestSha256=(Get-FileHash -LiteralPath $sourceManifestPath -Algorithm SHA256).Hash.ToLowerInvariant();sha256SumsSha256=(Get-FileHash -LiteralPath $sourceShaSumsPath -Algorithm SHA256).Hash.ToLowerInvariant()};files=$files;generatedAt=[DateTimeOffset]::UtcNow.ToString("O")}
  $manifestPath=Join-Path $validationRoot "build226-bronze-security-windows-evidence-manifest.json"
  [System.IO.File]::WriteAllText($manifestPath,"$($manifest|ConvertTo-Json -Depth 10)`n",[System.Text.UTF8Encoding]::new($false))
  $bundleFiles=@($manifestPath)+@($evidencePaths|Where-Object{Test-Path -LiteralPath $_ -PathType Leaf})
  $bundlePath=Join-Path $validationRoot "Bronze_Guvenlik_Windows_Kanitlari_Build226_$runId.zip"
  Compress-Archive -LiteralPath $bundleFiles -DestinationPath $bundlePath -Force
  $bundleSha=(Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText("$bundlePath.sha256","$bundleSha  $(Split-Path -Leaf $bundlePath)`n",[System.Text.UTF8Encoding]::new($false))
  Write-Host "Unified evidence bundle: $bundlePath"
  Write-Host "Unified evidence SHA-256: $bundlePath.sha256"
}

Write-Host "Unified run summary: $summaryPath"
if($failure){Write-Error $failure;exit 1}
if($open021Readiness -eq "READY_TO_CLOSE" -and $open022Readiness -eq "READY_TO_CLOSE"){Write-Host "OPEN-021 + OPEN-022: PASS / READY_TO_CLOSE";exit 0}
if($open021Readiness -eq "READY_TO_CLOSE"){Write-Warning "OPEN-021 READY_TO_CLOSE; OPEN-022 NOT_READY";exit 21}
if($open022Readiness -eq "READY_TO_CLOSE"){Write-Warning "OPEN-022 READY_TO_CLOSE; OPEN-021 NOT_READY";exit 22}
Write-Error "Neither OPEN-021 nor OPEN-022 is ready to close."
exit 1
