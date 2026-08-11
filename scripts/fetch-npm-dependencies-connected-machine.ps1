param(
  [string]$Output = "artifacts/validation/npm-cache-transfer-bundle.zip",
  [string]$Staging = "artifacts/npm-dependency-acquisition-staging"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
node scripts/create-npm-dependency-acquisition-plan.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/fetch-npm-dependency-acquisition-bundle.mjs --output $Output --staging $Staging
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/verify-npm-cache-transfer-bundle.mjs --archive $Output
exit $LASTEXITCODE
