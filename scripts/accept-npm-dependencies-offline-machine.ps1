param(
  [string]$Archive = "artifacts/validation/npm-cache-transfer-bundle.zip",
  [string]$Checksum = ""
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($Checksum)) { $Checksum = "$Archive.sha256" }
node scripts/accept-npm-cache-transfer-bundle.mjs --archive $Archive --checksum $Checksum
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
