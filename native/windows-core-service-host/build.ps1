param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'bin')
)

$ErrorActionPreference = 'Stop'
$dotnet = (Get-Command dotnet -ErrorAction Stop).Source
$sdkVersion = (& $dotnet --version).Trim()
$roslynCompiler = Join-Path (Split-Path $dotnet) ('sdk\' + $sdkVersion + '\Roslyn\bincore\csc.dll')
if (-not (Test-Path -LiteralPath $roslynCompiler -PathType Leaf)) { throw 'Deterministik Roslyn C# compiler bulunamadi.' }
$frameworkCandidates = @(
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'),
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319')
)
$framework = $frameworkCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'mscorlib.dll') -PathType Leaf } |
  Select-Object -First 1
if (-not $framework) { throw 'Windows .NET Framework reference assembly dizini bulunamadi.' }

$source = Join-Path $PSScriptRoot 'ParsYuvaCoreServiceHost.cs'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Windows Service Host kaynagi bulunamadi.' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = Join-Path $OutputDirectory 'ParsYuvaCoreServiceHost.exe'

$references = @('mscorlib.dll', 'System.dll', 'System.Core.dll', 'System.Security.dll',
  'System.ServiceProcess.dll', 'System.Web.Extensions.dll') | ForEach-Object {
    '/reference:' + (Join-Path $framework $_)
  }
& $dotnet $roslynCompiler /nologo /noconfig /nostdlib+ /checked+ /optimize+ /deterministic+ `
  /target:exe /platform:anycpu /out:$output $references $source
if ($LASTEXITCODE -ne 0) { throw "Windows Service Host derlemesi basarisiz: $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw 'Windows Service Host cikti dosyasi olusmadi.' }

$stream = [IO.File]::OpenRead($output)
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
  $hash = ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
} finally {
  $stream.Dispose()
  $sha256.Dispose()
}
[ordered]@{
  schemaVersion = 1
  output = $output
  sha256 = $hash
  deterministic = $true
  signed = $false
  windowsServiceLifecycleVerified = $false
} | ConvertTo-Json -Compress
