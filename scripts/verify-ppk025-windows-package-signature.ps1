param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [string]$ApplicationExecutablePath = "",
  [ValidateSet("FINAL_PAIR", "INSTALLER_PREINSTALL")][string]$Mode = "FINAL_PAIR",
  [string]$PolicyPath = "config\32-u-ppk-025-signing-trust-policy.json",
  [string]$EvidencePath = "artifacts\validation\32-U-ppk-025-windows-signature.json",
  [switch]$TestFixture
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Add-Type -AssemblyName System.Security

function Resolve-ProjectPath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return [System.IO.Path]::GetFullPath($Path) }
  return [System.IO.Path]::GetFullPath((Join-Path $root $Path))
}

function Assert-SafeEvidencePath {
  param([string]$Path)
  $full = Resolve-ProjectPath $Path
  $validationRoot = [System.IO.Path]::GetFullPath((Join-Path $root "artifacts\validation"))
  if (-not $full.StartsWith($validationRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Evidence path must remain under artifacts/validation."
  }
  return $full
}

function Normalize-Thumbprint {
  param([string]$Value)
  return ($Value -replace '[^A-Fa-f0-9]', '').ToUpperInvariant()
}

function Test-ByteArraysEqual {
  param([byte[]]$Left, [byte[]]$Right)
  if ($null -eq $Left -or $null -eq $Right -or $Left.Length -ne $Right.Length) { return $false }
  $difference = 0
  for ($index = 0; $index -lt $Left.Length; $index += 1) {
    $difference = $difference -bor ($Left[$index] -bxor $Right[$index])
  }
  return $difference -eq 0
}

function Read-DerElement {
  param([byte[]]$Bytes, [ref]$Offset)
  if ($Offset.Value -ge $Bytes.Length) { throw "DER element is truncated before tag." }
  $tag = [int]$Bytes[$Offset.Value]
  $Offset.Value += 1
  if ($Offset.Value -ge $Bytes.Length) { throw "DER element is truncated before length." }
  $firstLength = [int]$Bytes[$Offset.Value]
  $Offset.Value += 1
  if (($firstLength -band 0x80) -eq 0) {
    $length = $firstLength
  } else {
    $lengthBytes = $firstLength -band 0x7F
    if ($lengthBytes -eq 0 -or $lengthBytes -gt 4 -or $Offset.Value + $lengthBytes -gt $Bytes.Length) {
      throw "DER length encoding is invalid."
    }
    $length = 0
    for ($index = 0; $index -lt $lengthBytes; $index += 1) {
      $length = ($length -shl 8) -bor [int]$Bytes[$Offset.Value]
      $Offset.Value += 1
    }
  }
  if ($length -lt 0 -or $Offset.Value + $length -gt $Bytes.Length) { throw "DER element value is truncated." }
  [byte[]]$value = @()
  if ($length -gt 0) { $value = [byte[]]$Bytes[$Offset.Value..($Offset.Value + $length - 1)] }
  $Offset.Value += $length
  return [pscustomobject]@{ Tag = $tag; Length = $length; Value = $value }
}

function Convert-DerOidToString {
  param([byte[]]$Bytes)
  if ($Bytes.Length -eq 0) { throw "DER OID is empty." }
  $first = [int]$Bytes[0]
  if ($first -lt 80) {
    $parts = @([int][math]::Floor($first / 40), ($first % 40))
  } else {
    $parts = @(2, ($first - 80))
  }
  [long]$value = 0
  for ($index = 1; $index -lt $Bytes.Length; $index += 1) {
    $value = ($value -shl 7) -bor ([int]$Bytes[$index] -band 0x7F)
    if (([int]$Bytes[$index] -band 0x80) -eq 0) {
      $parts += $value
      $value = 0
    }
  }
  if ($value -ne 0) { throw "DER OID continuation is truncated." }
  return ($parts -join '.')
}

function Convert-GeneralizedTimeToUtc {
  param([byte[]]$Bytes)
  $text = [System.Text.Encoding]::ASCII.GetString($Bytes)
  $formats = @(
    'yyyyMMddHHmmssZ',
    'yyyyMMddHHmmss.fZ',
    'yyyyMMddHHmmss.ffZ',
    'yyyyMMddHHmmss.fffZ',
    'yyyyMMddHHmmss.ffffZ',
    'yyyyMMddHHmmss.fffffZ',
    'yyyyMMddHHmmss.ffffffZ',
    'yyyyMMddHHmmss.fffffffZ'
  )
  foreach ($format in $formats) {
    $parsed = [DateTimeOffset]::MinValue
    if ([DateTimeOffset]::TryParseExact(
      $text,
      $format,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal,
      [ref]$parsed
    )) { return $parsed.ToUniversalTime() }
  }
  throw "RFC3161 generalized time is invalid: $text"
}

function Get-HashForOid {
  param([string]$Oid, [byte[]]$Bytes)
  $algorithm = switch ($Oid) {
    '1.3.14.3.2.26' { [System.Security.Cryptography.SHA1]::Create(); break }
    '2.16.840.1.101.3.4.2.1' { [System.Security.Cryptography.SHA256]::Create(); break }
    '2.16.840.1.101.3.4.2.2' { [System.Security.Cryptography.SHA384]::Create(); break }
    '2.16.840.1.101.3.4.2.3' { [System.Security.Cryptography.SHA512]::Create(); break }
    default { throw "Unsupported RFC3161 message-imprint algorithm: $Oid" }
  }
  try { return [byte[]]$algorithm.ComputeHash($Bytes) }
  finally { $algorithm.Dispose() }
}

function Read-Rfc3161TstInfo {
  param([byte[]]$Bytes)
  $outerOffset = 0
  $outer = Read-DerElement -Bytes $Bytes -Offset ([ref]$outerOffset)
  if ($outer.Tag -ne 0x30 -or $outerOffset -ne $Bytes.Length) { throw "RFC3161 TSTInfo outer sequence is invalid." }
  $offset = 0
  $version = Read-DerElement -Bytes $outer.Value -Offset ([ref]$offset)
  $policy = Read-DerElement -Bytes $outer.Value -Offset ([ref]$offset)
  $messageImprint = Read-DerElement -Bytes $outer.Value -Offset ([ref]$offset)
  $serialNumber = Read-DerElement -Bytes $outer.Value -Offset ([ref]$offset)
  $generalizedTime = Read-DerElement -Bytes $outer.Value -Offset ([ref]$offset)
  if ($version.Tag -ne 0x02 -or $policy.Tag -ne 0x06 -or $messageImprint.Tag -ne 0x30 -or $serialNumber.Tag -ne 0x02 -or $generalizedTime.Tag -ne 0x18) {
    throw "RFC3161 TSTInfo mandatory fields are invalid."
  }
  $imprintOffset = 0
  $algorithmIdentifier = Read-DerElement -Bytes $messageImprint.Value -Offset ([ref]$imprintOffset)
  $hashedMessage = Read-DerElement -Bytes $messageImprint.Value -Offset ([ref]$imprintOffset)
  if ($algorithmIdentifier.Tag -ne 0x30 -or $hashedMessage.Tag -ne 0x04) { throw "RFC3161 message imprint is invalid." }
  $algorithmOffset = 0
  $algorithmOid = Read-DerElement -Bytes $algorithmIdentifier.Value -Offset ([ref]$algorithmOffset)
  if ($algorithmOid.Tag -ne 0x06) { throw "RFC3161 message-imprint algorithm is invalid." }
  return [pscustomobject]@{
    HashAlgorithmOid = Convert-DerOidToString -Bytes $algorithmOid.Value
    HashedMessage = [byte[]]$hashedMessage.Value
    TimestampTimeUtc = Convert-GeneralizedTimeToUtc -Bytes $generalizedTime.Value
  }
}

function Get-AuthenticodeTimestampEvidence {
  param([System.Security.Cryptography.Pkcs.SignerInfo]$PrimarySigner)
  foreach ($counterSigner in $PrimarySigner.CounterSignerInfos) {
    try {
      $counterSigner.CheckSignature($true)
      foreach ($attribute in $counterSigner.SignedAttributes) {
        if ($attribute.Oid.Value -eq '1.2.840.113549.1.9.5' -and $attribute.Values.Count -eq 1) {
          $signingTime = New-Object System.Security.Cryptography.Pkcs.Pkcs9SigningTime -ArgumentList (, $attribute.Values[0].RawData)
          return [pscustomobject]@{
            Present = $true
            Type = 'AUTHENTICODE_COUNTERSIGNATURE'
            TimestampTimeUtc = [DateTimeOffset]$signingTime.SigningTime.ToUniversalTime()
            Certificate = $counterSigner.Certificate
            CryptographicallyValid = $true
            MessageImprintValid = $true
            Failure = $null
          }
        }
      }
    } catch {
      return [pscustomobject]@{ Present = $true; Type = 'AUTHENTICODE_COUNTERSIGNATURE'; TimestampTimeUtc = $null; Certificate = $counterSigner.Certificate; CryptographicallyValid = $false; MessageImprintValid = $false; Failure = $_.Exception.Message }
    }
  }

  foreach ($attribute in $PrimarySigner.UnsignedAttributes) {
    if ($attribute.Oid.Value -ne '1.3.6.1.4.1.311.3.3.1') { continue }
    foreach ($encodedValue in $attribute.Values) {
      try {
        $timestampCms = New-Object System.Security.Cryptography.Pkcs.SignedCms
        $timestampCms.Decode($encodedValue.RawData)
        $timestampCms.CheckSignature($true)
        if ($timestampCms.SignerInfos.Count -ne 1) { throw "RFC3161 timestamp must contain exactly one signer." }
        $tstInfo = Read-Rfc3161TstInfo -Bytes $timestampCms.ContentInfo.Content
        $actualImprint = Get-HashForOid -Oid $tstInfo.HashAlgorithmOid -Bytes $PrimarySigner.GetSignature()
        $imprintValid = Test-ByteArraysEqual -Left $actualImprint -Right $tstInfo.HashedMessage
        return [pscustomobject]@{
          Present = $true
          Type = 'RFC3161'
          TimestampTimeUtc = $tstInfo.TimestampTimeUtc
          Certificate = $timestampCms.SignerInfos[0].Certificate
          CryptographicallyValid = $true
          MessageImprintValid = $imprintValid
          Failure = if ($imprintValid) { $null } else { 'RFC3161_MESSAGE_IMPRINT_MISMATCH' }
        }
      } catch {
        return [pscustomobject]@{ Present = $true; Type = 'RFC3161'; TimestampTimeUtc = $null; Certificate = $null; CryptographicallyValid = $false; MessageImprintValid = $false; Failure = $_.Exception.Message }
      }
    }
  }
  return [pscustomobject]@{ Present = $false; Type = 'NONE'; TimestampTimeUtc = $null; Certificate = $null; CryptographicallyValid = $false; MessageImprintValid = $false; Failure = 'TIMESTAMP_NOT_FOUND' }
}

function Get-PrimaryAuthenticodeSigner {
  param([string]$Path)
  [byte[]]$bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 256 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { throw "Artifact is not a valid PE file." }
  $peOffset = [System.BitConverter]::ToInt32($bytes, 0x3C)
  if ($peOffset -lt 0 -or $peOffset + 168 -gt $bytes.Length) { throw "PE header offset is invalid." }
  if ($bytes[$peOffset] -ne 0x50 -or $bytes[$peOffset + 1] -ne 0x45 -or $bytes[$peOffset + 2] -ne 0 -or $bytes[$peOffset + 3] -ne 0) { throw "PE signature is invalid." }
  $optionalHeaderOffset = $peOffset + 24
  $magic = [System.BitConverter]::ToUInt16($bytes, $optionalHeaderOffset)
  $securityDirectoryOffset = if ($magic -eq 0x10B) { $optionalHeaderOffset + 128 } elseif ($magic -eq 0x20B) { $optionalHeaderOffset + 144 } else { throw "PE optional-header magic is unsupported." }
  if ($securityDirectoryOffset + 8 -gt $bytes.Length) { throw "PE security directory is truncated." }
  $certificateTableOffset = [int][System.BitConverter]::ToUInt32($bytes, $securityDirectoryOffset)
  $certificateTableSize = [int][System.BitConverter]::ToUInt32($bytes, $securityDirectoryOffset + 4)
  if ($certificateTableOffset -le 0 -or $certificateTableSize -lt 8 -or $certificateTableOffset + $certificateTableSize -gt $bytes.Length) { throw "PE Authenticode certificate table is missing or invalid." }
  $cursor = $certificateTableOffset
  $end = $certificateTableOffset + $certificateTableSize
  while ($cursor + 8 -le $end) {
    $length = [int][System.BitConverter]::ToUInt32($bytes, $cursor)
    $certificateType = [System.BitConverter]::ToUInt16($bytes, $cursor + 6)
    if ($length -lt 8 -or $cursor + $length -gt $end) { throw "WIN_CERTIFICATE entry is malformed." }
    if ($certificateType -eq 0x0002) {
      [byte[]]$pkcs7 = $bytes[($cursor + 8)..($cursor + $length - 1)]
      $cms = New-Object System.Security.Cryptography.Pkcs.SignedCms
      $cms.Decode($pkcs7)
      $cms.CheckSignature($true)
      if ($cms.SignerInfos.Count -ne 1) { throw "Authenticode signature must contain exactly one primary signer." }
      return $cms.SignerInfos[0]
    }
    $cursor += (($length + 7) -band (-bnot 7))
  }
  throw "PKCS#7 Authenticode signature is missing."
}

function Test-CertificateChainAtTime {
  param([System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate, [DateTimeOffset]$VerificationTime)
  if ($null -eq $Certificate) { return [pscustomobject]@{ Trusted = $false; Status = @('CERTIFICATE_MISSING') } }
  $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
  try {
    $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
    $chain.ChainPolicy.RevocationFlag = [System.Security.Cryptography.X509Certificates.X509RevocationFlag]::ExcludeRoot
    $chain.ChainPolicy.VerificationFlags = [System.Security.Cryptography.X509Certificates.X509VerificationFlags]::NoFlag
    $chain.ChainPolicy.VerificationTime = $VerificationTime.UtcDateTime
    $chain.ChainPolicy.UrlRetrievalTimeout = [TimeSpan]::FromSeconds(20)
    $trusted = $chain.Build($Certificate)
    $statuses = @($chain.ChainStatus | ForEach-Object { $_.Status.ToString() } | Where-Object { $_ -ne 'NoError' } | Sort-Object -Unique)
    if ($statuses.Count -eq 0) { $statuses = @('NO_ERROR') }
    return [pscustomobject]@{ Trusted = $trusted -and $statuses.Count -eq 1 -and $statuses[0] -eq 'NO_ERROR'; Status = $statuses }
  } finally {
    $chain.Dispose()
  }
}

function Get-PeSignatureEvidence {
  param([string]$Id, [string]$Path, [object]$Policy)
  $fullPath = Resolve-ProjectPath $Path
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    return [ordered]@{ id = $Id; status = "FAIL"; reason = "ARTIFACT_MISSING"; path = $fullPath; checks = [ordered]@{ artifactPresent = $false }; failedChecks = @('artifactPresent') }
  }
  $file = Get-Item -LiteralPath $fullPath
  $signature = Get-AuthenticodeSignature -LiteralPath $fullPath
  $certificate = $signature.SignerCertificate
  $thumbprint = if ($certificate) { Normalize-Thumbprint ([string]$certificate.Thumbprint) } else { "" }
  $subject = if ($certificate) { [string]$certificate.Subject } else { "" }
  $certificateSha256 = if ($certificate) {
    $certificateBytes = $certificate.GetRawCertData()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try { ([System.BitConverter]::ToString($sha256.ComputeHash($certificateBytes)) -replace '-', '').ToLowerInvariant() }
    finally { $sha256.Dispose() }
  } else { "" }
  $selfSigned = $null -ne $certificate -and [string]$certificate.Subject -eq [string]$certificate.Issuer
  $eku = if ($certificate) {
    @($certificate.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.37" } | ForEach-Object { $_.Format($false) }) -join "; "
  } else { "" }
  $expectedThumbprints = @($Policy.production.allowedLeafCertificateThumbprints | ForEach-Object { Normalize-Thumbprint ([string]$_) })
  $expectedCertificateSha256 = @($Policy.production.allowedLeafCertificateSha256 | ForEach-Object { ([string]$_).ToLowerInvariant() })
  $expectedSubject = [string]$Policy.production.expectedPublisherSubject
  $signatureStatus = $signature.Status.ToString()
  $hash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()

  $timestamp = [pscustomobject]@{ Present = $false; Type = 'NONE'; TimestampTimeUtc = $null; Certificate = $null; CryptographicallyValid = $false; MessageImprintValid = $false; Failure = 'PRIMARY_SIGNATURE_UNAVAILABLE' }
  try {
    $primarySigner = Get-PrimaryAuthenticodeSigner -Path $fullPath
    $timestamp = Get-AuthenticodeTimestampEvidence -PrimarySigner $primarySigner
  } catch {
    $timestamp = [pscustomobject]@{ Present = $false; Type = 'NONE'; TimestampTimeUtc = $null; Certificate = $null; CryptographicallyValid = $false; MessageImprintValid = $false; Failure = $_.Exception.Message }
  }

  $timestampTimeUtc = $timestamp.TimestampTimeUtc
  $timestampCertificate = if ($timestamp.Certificate) { $timestamp.Certificate } else { $signature.TimeStamperCertificate }
  $timestampCertificatePresent = $timestamp.Present -and $null -ne $timestampCertificate -and $null -ne $timestampTimeUtc
  $certificateValidAtSigningTime = $false
  $timestampCertificateValidAtTimestampTime = $false
  $signerChain = [pscustomobject]@{ Trusted = $false; Status = @('SIGNING_TIME_UNAVAILABLE') }
  $timestampChain = [pscustomobject]@{ Trusted = $false; Status = @('TIMESTAMP_UNAVAILABLE') }
  if ($timestampCertificatePresent -and $certificate) {
    $certificateValidAtSigningTime = $timestampTimeUtc.UtcDateTime -ge $certificate.NotBefore.ToUniversalTime() -and $timestampTimeUtc.UtcDateTime -le $certificate.NotAfter.ToUniversalTime()
    $timestampCertificateValidAtTimestampTime = $timestampTimeUtc.UtcDateTime -ge $timestampCertificate.NotBefore.ToUniversalTime() -and $timestampTimeUtc.UtcDateTime -le $timestampCertificate.NotAfter.ToUniversalTime()
    $signerChain = Test-CertificateChainAtTime -Certificate $certificate -VerificationTime $timestampTimeUtc
    $timestampChain = Test-CertificateChainAtTime -Certificate $timestampCertificate -VerificationTime $timestampTimeUtc
  }
  $timestampChainTrusted = $timestampCertificatePresent -and $timestamp.CryptographicallyValid -and $timestamp.MessageImprintValid -and $timestampCertificateValidAtTimestampTime -and $timestampChain.Trusted
  $trustedTimestampPresent = $timestampCertificatePresent -and $timestampChainTrusted
  $checks = [ordered]@{
    artifactPresent = $true
    artifactNotEmpty = $file.Length -gt 0
    statusValid = $signatureStatus -eq "Valid"
    signerCertificatePresent = $null -ne $certificate
    publisherSubjectExact = $expectedSubject.Length -gt 0 -and $subject -eq $expectedSubject
    leafThumbprintAllowlisted = $expectedThumbprints.Count -gt 0 -and $expectedThumbprints -contains $thumbprint
    certificateSha256Allowlisted = $expectedCertificateSha256.Count -gt 0 -and $expectedCertificateSha256 -contains $certificateSha256
    codeSigningEkuPresent = $eku -match "1\.3\.6\.1\.5\.5\.7\.3\.3|Code Signing"
    timestampCertificatePresent = $timestampCertificatePresent
    timestampSignatureValid = $timestamp.CryptographicallyValid
    timestampMessageImprintValid = $timestamp.MessageImprintValid
    timestampChainTrusted = $timestampChainTrusted
    certificateValidAtSigningTime = $certificateValidAtSigningTime
    signerChainTrustedAtSigningTime = $signerChain.Trusted
    trustedTimestampPresent = $trustedTimestampPresent
    selfSignedCertificateRejected = -not $selfSigned
    sha256DigestRecorded = $hash -match '^[a-f0-9]{64}$'
    testFixtureNotProduction = -not $TestFixture
  }
  $failedChecks = @($checks.Keys | Where-Object { -not [bool]$checks[$_] })
  return [ordered]@{
    id = $Id
    status = if ($failedChecks.Count -eq 0) { "PASS" } else { "FAIL" }
    reason = if ($failedChecks.Count -eq 0) { "VALID_TRUSTED_AUTHENTICODE" } else { "SIGNATURE_POLICY_DENIED" }
    path = $fullPath
    sizeBytes = $file.Length
    sha256 = $hash
    authenticodeStatus = $signatureStatus
    statusMessage = [string]$signature.StatusMessage
    signerSubject = $subject
    signerThumbprint = $thumbprint
    signerCertificateSha256 = $certificateSha256
    selfSigned = $selfSigned
    signerNotBefore = if ($certificate) { $certificate.NotBefore.ToUniversalTime().ToString("O") } else { $null }
    signerNotAfter = if ($certificate) { $certificate.NotAfter.ToUniversalTime().ToString("O") } else { $null }
    codeSigningEku = $eku
    timestampType = $timestamp.Type
    timestampTimeUtc = if ($timestampTimeUtc) { $timestampTimeUtc.ToString("O") } else { $null }
    timestampSubject = if ($timestampCertificate) { [string]$timestampCertificate.Subject } else { $null }
    timestampThumbprint = if ($timestampCertificate) { Normalize-Thumbprint ([string]$timestampCertificate.Thumbprint) } else { $null }
    timestampFailure = $timestamp.Failure
    signerChainStatus = @($signerChain.Status)
    timestampChainStatus = @($timestampChain.Status)
    checks = $checks
    failedChecks = $failedChecks
  }
}

$policyFullPath = Resolve-ProjectPath $PolicyPath
$policy = Get-Content -LiteralPath $policyFullPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($policy.schemaVersion -ne 1 -or $policy.privateSigningMaterialInRepositoryAllowed -ne $false) {
  throw "PPK-025 signing trust policy is malformed."
}
if ($Mode -eq 'FINAL_PAIR' -and [string]::IsNullOrWhiteSpace($ApplicationExecutablePath)) {
  throw "ApplicationExecutablePath is mandatory in FINAL_PAIR mode."
}
$evidenceFullPath = Assert-SafeEvidencePath $EvidencePath
$installer = Get-PeSignatureEvidence -Id "installer" -Path $InstallerPath -Policy $policy
$application = if ($Mode -eq 'FINAL_PAIR') {
  Get-PeSignatureEvidence -Id "installed-main-executable" -Path $ApplicationExecutablePath -Policy $policy
} else { $null }
$productionConfigurationReady =
  [string]$policy.production.expectedPublisherSubject -ne "" -and
  @($policy.production.allowedLeafCertificateThumbprints).Count -gt 0 -and
  @($policy.production.allowedLeafCertificateSha256).Count -gt 0 -and
  $policy.production.codeSigningCertificateProvisionedExternally -eq $true
$status = if ($Mode -eq 'INSTALLER_PREINSTALL') {
  if ($productionConfigurationReady -and $installer.status -eq "PASS") { "PASS" } else { "BLOCKED" }
} else {
  if ($productionConfigurationReady -and $installer.status -eq "PASS" -and $application.status -eq "PASS") { "PASS" } else { "BLOCKED" }
}
$report = [ordered]@{
  schemaVersion = 1
  step = "32-U"
  requirement = "PPK-025"
  mode = $Mode
  status = $status
  releaseEligible = $Mode -eq 'FINAL_PAIR' -and $status -eq "PASS"
  productionConfigurationReady = $productionConfigurationReady
  testFixture = [bool]$TestFixture
  policyPath = $PolicyPath -replace '\\', '/'
  installer = $installer
  applicationExecutable = $application
  privateSigningMaterialRead = $false
  generatedAt = [DateTimeOffset]::UtcNow.ToString("O")
}
$evidenceDirectory = Split-Path -Parent $evidenceFullPath
New-Item -ItemType Directory -Force -Path $evidenceDirectory | Out-Null
$json = $report | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText($evidenceFullPath, "$json`n", [System.Text.UTF8Encoding]::new($false))
if ($status -ne "PASS") {
  Write-Error "PPK-025 Windows Authenticode gate: BLOCKED. Production certificate/trust policy and required final PE signatures must be Valid."
  exit 1
}
if ($Mode -eq 'INSTALLER_PREINSTALL') {
  Write-Host "PPK-025 Windows Authenticode preinstall gate: PASS (installer verified; no release authority granted)."
} else {
  Write-Host "PPK-025 Windows Authenticode gate: PASS (installer + installed main executable)."
}
