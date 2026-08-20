param()

$ErrorActionPreference = 'Stop'
$serviceName = 'ParsYuvaCoreService'
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
  [ordered]@{ schemaVersion = 1; serviceName = $serviceName; removed = $true; wasInstalled = $false } |
    ConvertTo-Json -Compress
  exit 0
}
if ($service.Status -ne 'Stopped') {
  & sc.exe stop $serviceName | Out-Null
  $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
}
& sc.exe delete $serviceName | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Windows Service kaldirilamadi.' }
[ordered]@{ schemaVersion = 1; serviceName = $serviceName; removed = $true; wasInstalled = $true } |
  ConvertTo-Json -Compress
