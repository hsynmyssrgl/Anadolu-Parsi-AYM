param()

$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('parsyuva-service-host-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
  $nodePath = (Get-Command node).Source
  $entrypoint = [IO.Path]::GetFullPath('apps/core-service/dist/main.js')
  if (-not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) { throw 'Core Service dist/main.js bulunamadi.' }
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $tokenBytes = New-Object byte[] 48
    $controlBytes = New-Object byte[] 48
    $keyBytes = New-Object byte[] 32
    $random.GetBytes($tokenBytes)
    $random.GetBytes($controlBytes)
    $random.GetBytes($keyBytes)
    $configuration = [ordered]@{
      schemaVersion = 1
      nodeExecutablePath = $nodePath
      coreServiceEntrypointPath = $entrypoint
      workingDirectory = [IO.Path]::GetFullPath('.')
      localAdminPipeName = 'ppt-core-service-' + [guid]::NewGuid().ToString('N')
      localAdminToken = [Convert]::ToBase64String($tokenBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
      policySigningKeyHex = ([BitConverter]::ToString($keyBytes)).Replace('-', '').ToLowerInvariant()
      policyVersion = 'PPT-PLATFORM-POLICY-2026-08-04-V1'
      policyJournalAuthorityPath = Join-Path $testRoot 'policy-journal.json'
      controlPipeName = 'ppt-core-service-host-control-' + [guid]::NewGuid().ToString('N')
      controlToken = [Convert]::ToBase64String($controlBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
      restartLimit = 3
      restartWindowSeconds = 600
      shutdownTimeoutSeconds = 30
    }
    $json = $configuration | ConvertTo-Json -Compress
  } finally {
    if ($tokenBytes) { [Array]::Clear($tokenBytes, 0, $tokenBytes.Length) }
    if ($controlBytes) { [Array]::Clear($controlBytes, 0, $controlBytes.Length) }
    if ($keyBytes) { [Array]::Clear($keyBytes, 0, $keyBytes.Length) }
    $random.Dispose()
  }

  $hostExecutable = [IO.Path]::GetFullPath('native/windows-core-service-host/bin/ParsYuvaCoreServiceHost.exe')
  $protected = Join-Path $testRoot 'service.pptservice'
  $json | & $hostExecutable --provision $protected
  if ($LASTEXITCODE -ne 0) { throw 'Windows Service Host provision testi basarisiz.' }
  & $hostExecutable --validate $protected
  if ($LASTEXITCODE -ne 0) { throw 'Windows Service Host validate testi basarisiz.' }

  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $json | & $hostExecutable --provision $protected 2>$null
  $secondProvisionExit = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($secondProvisionExit -eq 0) { throw 'Windows Service Host no-overwrite testi basarisiz.' }

  [ordered]@{
    schemaVersion = 1
    roundTrip = 'PASS'
    noOverwrite = 'PASS'
    protectedBytes = (Get-Item -LiteralPath $protected).Length
    actualServiceInstallation = 'NOT_RUN'
  } | ConvertTo-Json -Compress
} finally {
  if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
