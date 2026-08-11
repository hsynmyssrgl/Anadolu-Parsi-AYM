$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root 'scripts\windows-real-launch-test.mjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
& $node $runner
if ($LASTEXITCODE -ne 0) {
  throw "Windows real launch test failed with exit code $LASTEXITCODE."
}
