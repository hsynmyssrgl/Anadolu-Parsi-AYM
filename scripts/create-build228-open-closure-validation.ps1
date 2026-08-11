param(
  [Parameter(Mandatory = $true)][string]$SourceZip,
  [Parameter(Mandatory = $true)][string]$EvidenceZip,
  [string]$Report = 'artifacts/validation/build228-open021-open022-closure-validation.json'
)
$ErrorActionPreference = 'Stop'
$expectedSourceSha = '131091a153cf3a7eaf78b62f1dc2696761b8bde79cd7e3206264e10cb672d2c0'
$expectedEvidenceSha = 'efa151bb35b4ea0a027327052f735d42048f3e3c1f809175abf0cd5015549564'
$failures = [System.Collections.Generic.List[string]]::new()
function Add-Check([bool]$Condition, [string]$Message) { if (-not $Condition) { $failures.Add($Message) } }

$sourceItem = Get-Item -LiteralPath $SourceZip
$evidenceItem = Get-Item -LiteralPath $EvidenceZip
$sourceSha = (Get-FileHash -LiteralPath $sourceItem.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$evidenceSha = (Get-FileHash -LiteralPath $evidenceItem.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
Add-Check ($sourceSha -eq $expectedSourceSha) "Build227 source ZIP SHA mismatch: $sourceSha"
Add-Check ($evidenceSha -eq $expectedEvidenceSha) "Build227 Windows evidence ZIP SHA mismatch: $evidenceSha"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($evidenceItem.FullName)
try {
  function Read-ZipJson([string]$Name) {
    $entry = $archive.Entries | Where-Object { $_.FullName -eq $Name } | Select-Object -First 1
    if (-not $entry) { throw "Required evidence entry missing: $Name" }
    $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8, $true)
    try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
  }
  $closure = Read-ZipJson 'build227-bronze-security-windows-closure-result.json'
  $summary = Read-ZipJson 'build227-bronze-security-windows-run-summary.json'
} finally {
  $archive.Dispose()
}

Add-Check ($closure.build -eq 227) "closure build=$($closure.build)"
Add-Check ($closure.applicationVersion -eq '02.08.2026.227') "closure version=$($closure.applicationVersion)"
Add-Check ($closure.status -eq 'PASS') "closure status=$($closure.status)"
Add-Check ($closure.checks -eq 95) "closure checks=$($closure.checks)"
Add-Check ($closure.passCount -eq 95) "closure passCount=$($closure.passCount)"
Add-Check ($closure.failCount -eq 0) "closure failCount=$($closure.failCount)"
Add-Check ($closure.closureReadiness.open021 -eq 'READY_TO_CLOSE') "OPEN-021 readiness=$($closure.closureReadiness.open021)"
Add-Check ($closure.closureReadiness.open022 -eq 'READY_TO_CLOSE') "OPEN-022 readiness=$($closure.closureReadiness.open022)"
Add-Check (-not ($closure.results | Where-Object { $_.status -ne 'PASS' })) 'Closure contains a non-PASS result'
Add-Check ($summary.notRunIsPass -eq $false) "notRunIsPass=$($summary.notRunIsPass)"
Add-Check ($summary.status -eq 'PASS') "run summary status=$($summary.status)"
Add-Check (-not ($summary.steps | Where-Object { $_.status -ne 'PASS' })) 'Lifecycle contains a non-PASS step'

$reportObject = [ordered]@{
  schemaVersion = 1
  product = 'Anadolu Parsı Aile Yaşam Merkezi'
  build = 228
  applicationVersion = '02.08.2026.228'
  purpose = 'Official OPEN-021 and OPEN-022 closure validation against exact Build227 real Windows evidence'
  status = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
  closureEvidenceBuild = 227
  closureEvidenceZipSha256 = $evidenceSha
  exactSourceZipSha256 = $sourceSha
  evidenceZipName = $evidenceItem.Name
  sourceZipName = $sourceItem.Name
  evidenceChecks = $closure.checks
  evidencePassCount = $closure.passCount
  evidenceFailCount = $closure.failCount
  notRunIsPass = $false
  open021 = [ordered]@{ status = 'CLOSED'; readiness = $closure.closureReadiness.open021; development = 'PASS'; installed = 'PASS' }
  open022 = [ordered]@{ status = 'CLOSED'; readiness = $closure.closureReadiness.open022; development = 'PASS'; installed = 'PASS' }
  silverResultsUnchanged = [ordered]@{ fullRootTscNoEmit = 'FAIL'; unitIntegration = 'FAIL'; blockingSmoke = 'FAIL' }
  failures = @($failures)
  generatedAt = [DateTime]::UtcNow.ToString('o')
}
$reportPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Report))
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($reportPath)) | Out-Null
[System.IO.File]::WriteAllText($reportPath, (($reportObject | ConvertTo-Json -Depth 12) + "`n"), [System.Text.UTF8Encoding]::new($false))
if ($failures.Count -gt 0) { $failures | ForEach-Object { Write-Error $_ }; exit 1 }
Write-Host "Build228 OPEN-021/OPEN-022 closure validation: PASS"
