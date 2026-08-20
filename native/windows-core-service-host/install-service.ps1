param(
  [Parameter(Mandatory = $true)][string]$HostExecutable,
  [Parameter(Mandatory = $true)][string]$ProtectedConfiguration
)

$ErrorActionPreference = 'Stop'
$serviceName = 'ParsYuvaCoreService'
$displayName = 'ParsYuva Aile Yasam Merkezi Core Service'
$hostPath = [IO.Path]::GetFullPath($HostExecutable)
$configurationPath = [IO.Path]::GetFullPath($ProtectedConfiguration)
if (-not (Test-Path -LiteralPath $hostPath -PathType Leaf)) { throw 'Windows Service Host bulunamadi.' }
if (-not (Test-Path -LiteralPath $configurationPath -PathType Leaf)) { throw 'Korumali servis yapilandirmasi bulunamadi.' }
if ((Get-Service -Name $serviceName -ErrorAction SilentlyContinue)) { throw 'ParsYuva Core Service zaten kurulu.' }

& $hostPath --validate $configurationPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Korumali servis yapilandirmasi gecersiz.' }

$binaryPath = '"{0}" --service "{1}"' -f $hostPath, $configurationPath
& sc.exe create $serviceName "binPath= $binaryPath" 'start= auto' 'obj= LocalSystem' "DisplayName= $displayName" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Windows Service kaydi olusturulamadi.' }
try {
  & sc.exe description $serviceName 'ParsYuva headless Node Core Service yasam dongusu.' | Out-Null
  & sc.exe failure $serviceName 'reset= 86400' 'actions= restart/5000/restart/15000/restart/30000' | Out-Null
  & sc.exe failureflag $serviceName 1 | Out-Null
  & sc.exe start $serviceName | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Windows Service baslatilamadi.' }
} catch {
  & sc.exe delete $serviceName | Out-Null
  throw
}

[ordered]@{ schemaVersion = 1; serviceName = $serviceName; installed = $true; started = $true } |
  ConvertTo-Json -Compress
