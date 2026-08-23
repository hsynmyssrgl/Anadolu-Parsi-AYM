param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('tr', 'en')]
  [string]$Language,

  [Parameter(Mandatory = $true)]
  [string]$StopFile,

  [string]$EvidencePath = '',

  [string]$WaveOutputPath = '',

  [ValidateRange(5, 300)]
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$hasEvidence = -not [string]::IsNullOrWhiteSpace($EvidencePath)
$hasWave = -not [string]::IsNullOrWhiteSpace($WaveOutputPath)
$diagnosticMode = $hasEvidence -or $hasWave
if ($hasWave -and -not $hasEvidence) { throw 'WaveOutputPath requires EvidencePath so every wave remains receipt-bound.' }
$diagnosticRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'ParsYuvaInstallerEvidence'))
$evidenceTarget = $null
$waveTarget = $null
$waveWorkingPath = $null
$waveWorkingOwned = $false
$waveCommittedByThisRun = $false
$evidenceTemporaryPath = $null
$evidenceCommittedByThisRun = $false
$completionSourceIdentifier = $null
$completionSubscription = $null
$prompt = $null
$completion = [ordered]@{
  eventObserved = $false
  cancelled = $false
  errorType = $null
  errorMessage = $null
  promptIsCompleted = $false
}
$evidence = [ordered]@{
  schemaVersion = 1
  status = 'STARTED'
  language = $Language
  engine = $null
  outputMode = if ([string]::IsNullOrWhiteSpace($WaveOutputPath)) { 'DEFAULT_AUDIO_DEVICE' } else { 'WAVE_CAPTURE' }
  voiceInventory = @()
  selectedVoice = $null
  selectionReason = $null
  promptCompleted = $false
  promptCancelled = $false
  stopFileObserved = $false
  wave = $null
  startedAt = [DateTime]::UtcNow.ToString('o')
  completedAt = $null
  failureCode = $null
  failureMessage = $null
  completion = $completion
  source = $null
  claimBoundary = if ($hasWave) { 'OFFLINE_WAVE_SYNTHESIS_ONLY_NOT_AUDIBLE_OUTPUT' } else { 'SYNTHESIS_API_COMPLETION_ONLY_NOT_HUMAN_AUDIBILITY' }
}

function Test-StrictNarrationDescendantPath {
  param([string]$Candidate, [string]$Parent)
  $prefix = $Parent.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  return $Candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Convert-NarrationBytesToLowerHex {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  return ([BitConverter]::ToString($Bytes)).Replace('-', '').ToLowerInvariant()
}

function Get-NarrationFileSha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { return Convert-NarrationBytesToLowerHex -Bytes ($hasher.ComputeHash($stream)) }
  finally { $hasher.Dispose(); $stream.Dispose() }
}

function Get-NarrationRelativePath {
  param([string]$Candidate, [string]$Parent)
  $candidateFullPath = [IO.Path]::GetFullPath($Candidate)
  $parentFullPath = [IO.Path]::GetFullPath($Parent).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if ($candidateFullPath.Equals($parentFullPath, [StringComparison]::OrdinalIgnoreCase)) { return '.' }
  if (-not (Test-StrictNarrationDescendantPath -Candidate $candidateFullPath -Parent $parentFullPath)) {
    throw 'Narration relative path escapes its approved parent.'
  }
  return $candidateFullPath.Substring($parentFullPath.Length).TrimStart([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Assert-NarrationNoReparseAncestors {
  param([string]$Candidate, [string]$Boundary)
  $candidateFullPath = [IO.Path]::GetFullPath($Candidate)
  $boundaryFullPath = [IO.Path]::GetFullPath($Boundary)
  if ($candidateFullPath -ne $boundaryFullPath -and
    -not (Test-StrictNarrationDescendantPath -Candidate $candidateFullPath -Parent $boundaryFullPath)) {
    throw 'Narration diagnostic path escapes the approved temporary root.'
  }
  $relativePath = Get-NarrationRelativePath -Candidate $candidateFullPath -Parent $boundaryFullPath
  $currentPath = $boundaryFullPath
  $segments = if ($relativePath -eq '.') { @() } else { @($relativePath -split '[\\/]') }
  foreach ($segment in @('.') + $segments) {
    if ($segment -ne '.') { $currentPath = Join-Path $currentPath $segment }
    if (-not (Test-Path -LiteralPath $currentPath)) { break }
    $item = Get-Item -LiteralPath $currentPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Narration diagnostic path contains a reparse ancestor: $currentPath"
    }
  }
}

function Resolve-NarrationDiagnosticPath {
  param([string]$Path, [string]$Extension)
  $target = [IO.Path]::GetFullPath($Path)
  $prefix = $diagnosticRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Narration diagnostic output must remain under the approved temporary root.' }
  if (-not [IO.Path]::GetExtension($target).Equals($Extension, [StringComparison]::OrdinalIgnoreCase)) { throw "Narration diagnostic output must use the $Extension extension." }
  if (Test-Path -LiteralPath $target) { throw 'Narration diagnostic output already exists.' }
  $directory = [IO.Path]::GetDirectoryName($target)
  if (-not [string]::IsNullOrWhiteSpace($directory)) {
    Assert-NarrationNoReparseAncestors -Candidate $directory -Boundary $diagnosticRoot
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    Assert-NarrationNoReparseAncestors -Candidate $directory -Boundary $diagnosticRoot
  }
  return $target
}

function Write-NarrationEvidence {
  if ([string]::IsNullOrWhiteSpace($evidenceTarget)) { return }
  if ($script:evidenceCommittedByThisRun) { return }
  $directory = [IO.Path]::GetDirectoryName($evidenceTarget)
  Assert-NarrationNoReparseAncestors -Candidate $directory -Boundary $diagnosticRoot
  if (Test-Path -LiteralPath $evidenceTarget) { throw 'Narration evidence target already exists.' }
  $script:evidenceTemporaryPath = Join-Path $directory ".$([IO.Path]::GetFileName($evidenceTarget)).$PID.$([guid]::NewGuid().ToString('N')).partial"
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes((($evidence | ConvertTo-Json -Depth 10) + "`n"))
  $stream = [IO.FileStream]::new(
    $script:evidenceTemporaryPath,
    [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,
    [IO.FileShare]::None,
    4096,
    [IO.FileOptions]::WriteThrough
  )
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }
  Assert-NarrationNoReparseAncestors -Candidate $directory -Boundary $diagnosticRoot
  if (Test-Path -LiteralPath $evidenceTarget) { throw 'Narration evidence target appeared before atomic commit.' }
  [IO.File]::Move($script:evidenceTemporaryPath, $evidenceTarget)
  $script:evidenceTemporaryPath = $null
  $script:evidenceCommittedByThisRun = $true
}

function Remove-PartialWave {
  if ($script:waveWorkingOwned -and -not [string]::IsNullOrWhiteSpace($script:waveWorkingPath) -and
    (Test-Path -LiteralPath $script:waveWorkingPath)) {
    $directory = [IO.Path]::GetDirectoryName($script:waveWorkingPath)
    Assert-NarrationNoReparseAncestors -Candidate $directory -Boundary $diagnosticRoot
    Remove-Item -LiteralPath $script:waveWorkingPath -Force
  }
  $script:waveWorkingOwned = $false
}

function Get-VerifiedWaveEvidence {
  param([Parameter(Mandatory = $true)][string]$Path)
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -le 44) { throw 'Narration wave output is empty.' }
  if ([Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF' -or [Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne 'WAVE') { throw 'Narration wave output has an invalid RIFF/WAVE signature.' }
  if ([BitConverter]::ToUInt32($bytes, 4) -ne ($bytes.Length - 8)) { throw 'Narration wave output has an invalid RIFF length.' }
  [long]$offset = 12
  [long]$dataBytes = 0
  $formatCount = 0
  $dataCount = 0
  $formatTag = 0
  $channels = 0
  [long]$sampleRate = 0
  [long]$byteRate = 0
  $blockAlign = 0
  $bitsPerSample = 0
  while ($offset -lt $bytes.Length) {
    if ($offset + 8 -gt $bytes.Length) { throw 'Narration wave output has trailing bytes without a complete chunk header.' }
    $chunkId = [Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    [long]$chunkSize = [BitConverter]::ToUInt32($bytes, $offset + 4)
    [long]$chunkStart = $offset + 8
    [long]$chunkEnd = $chunkStart + $chunkSize
    if ($chunkEnd -gt $bytes.Length) { throw 'Narration wave output contains an invalid chunk boundary.' }
    if ($chunkId -eq 'fmt ') {
      $formatCount += 1
      if ($chunkSize -lt 16) { throw 'Narration wave output has an undersized fmt chunk.' }
      $formatTag = [BitConverter]::ToUInt16($bytes, $chunkStart)
      $channels = [BitConverter]::ToUInt16($bytes, $chunkStart + 2)
      $sampleRate = [BitConverter]::ToUInt32($bytes, $chunkStart + 4)
      $byteRate = [BitConverter]::ToUInt32($bytes, $chunkStart + 8)
      $blockAlign = [BitConverter]::ToUInt16($bytes, $chunkStart + 12)
      $bitsPerSample = [BitConverter]::ToUInt16($bytes, $chunkStart + 14)
      if ($formatTag -ne 1 -or $channels -le 0 -or $sampleRate -le 0 -or $blockAlign -le 0 -or
        $bitsPerSample -notin @(8, 16, 24, 32)) { throw 'Narration wave output has invalid PCM format metadata.' }
      if ($blockAlign -ne ($channels * $bitsPerSample / 8) -or $byteRate -ne ($sampleRate * $blockAlign)) {
        throw 'Narration wave PCM rate/alignment metadata is inconsistent.'
      }
    }
    if ($chunkId -eq 'data') { $dataCount += 1; $dataBytes += $chunkSize }
    $offset = $chunkEnd
    if (($chunkSize % 2) -eq 1) {
      if ($offset -ge $bytes.Length) { throw 'Narration wave chunk padding is missing.' }
      if ($bytes[$offset] -ne 0) { throw 'Narration wave chunk padding byte is not zero.' }
      $offset += 1
    }
  }
  if ($offset -ne $bytes.Length) { throw 'Narration wave parser did not consume the complete RIFF payload.' }
  if ($formatCount -ne 1 -or $dataCount -ne 1 -or $dataBytes -le 0) { throw 'Narration wave requires exactly one fmt and one non-empty data chunk.' }
  if (($dataBytes % $blockAlign) -ne 0) { throw 'Narration wave data is not aligned to PCM frames.' }
  return [ordered]@{
    path = $Path
    sizeBytes = $bytes.Length
    dataBytes = $dataBytes
    sha256 = Get-NarrationFileSha256 -Path $Path
    riffValidated = $true
    formatTag = $formatTag
    channels = $channels
    sampleRate = $sampleRate
    byteRate = $byteRate
    blockAlign = $blockAlign
    bitsPerSample = $bitsPerSample
    durationMs = [Math]::Round(($dataBytes / $byteRate) * 1000, 0)
    finalOffset = $offset
    completeFileConsumed = $offset -eq $bytes.Length
  }
}

function Receive-NarrationCompletionEvent {
  if ([string]::IsNullOrWhiteSpace($script:completionSourceIdentifier)) { return $false }
  $events = @(Get-Event -SourceIdentifier $script:completionSourceIdentifier -ErrorAction SilentlyContinue)
  if ($events.Count -eq 0) { return $false }
  foreach ($eventRecord in $events) {
    $eventArgs = $eventRecord.SourceEventArgs
    $script:completion.eventObserved = $true
    $script:completion.cancelled = [bool]$eventArgs.Cancelled
    if ($null -ne $eventArgs.Error) {
      $script:completion.errorType = $eventArgs.Error.GetType().FullName
      $script:completion.errorMessage = $eventArgs.Error.Message
    }
    Remove-Event -EventIdentifier $eventRecord.EventIdentifier -ErrorAction SilentlyContinue
  }
  return $true
}

function Await-WinRtNarrationOperation {
  param(
    [Parameter(Mandatory = $true)]$Operation,
    [Parameter(Mandatory = $true)][Type]$ResultType
  )
  $asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } |
    Select-Object -First 1
  if ($null -eq $asTaskMethod) { throw 'WinRT narration task bridge is unavailable.' }
  $task = $asTaskMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  if (-not $task.Wait($TimeoutSeconds * 1000)) { throw [TimeoutException]::new('WinRT narration synthesis timed out.') }
  return $task.Result
}

function Invoke-WinRtNarration {
  param([Parameter(Mandatory = $true)][string]$Text)
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
  $languagePrefix = "$Language-"
  $voices = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object {
    $_.Language.StartsWith($languagePrefix, [StringComparison]::OrdinalIgnoreCase)
  })
  $evidence.voiceInventory = @($voices | ForEach-Object {
    [ordered]@{ name = $_.DisplayName; culture = $_.Language; gender = $_.Gender.ToString(); enabled = $true }
  })
  if ($voices.Count -eq 0) {
    $evidence.status = 'NO_SAME_LANGUAGE_VOICE'
    $evidence.failureCode = 'NO_SAME_LANGUAGE_VOICE'
    return
  }
  $femaleVoice = @($voices | Where-Object { $_.Gender.ToString() -eq 'Female' }) | Select-Object -First 1
  $maleVoice = @($voices | Where-Object { $_.Gender.ToString() -eq 'Male' }) | Select-Object -First 1
  $selectedVoice = if ($femaleVoice) { $femaleVoice } elseif ($maleVoice) { $maleVoice } else { $voices[0] }
  $evidence.engine = 'WINRT_ONECORE'
  $evidence.selectionReason = if ($femaleVoice) { 'SAME_LANGUAGE_FEMALE_PREFERRED' } elseif ($maleVoice) { 'SAME_LANGUAGE_MALE_FALLBACK' } else { 'SAME_LANGUAGE_FIRST_VOICE_FALLBACK' }
  $evidence.selectedVoice = [ordered]@{
    name = $selectedVoice.DisplayName
    culture = $selectedVoice.Language
    gender = $selectedVoice.Gender.ToString()
  }
  if (Test-Path -LiteralPath $StopFile) {
    $evidence.status = 'CANCELLED_BEFORE_START'
    $evidence.promptCancelled = $true
    $evidence.stopFileObserved = $true
    return
  }
  [IO.Directory]::CreateDirectory($diagnosticRoot) | Out-Null
  Assert-NarrationNoReparseAncestors -Candidate $diagnosticRoot -Boundary $diagnosticRoot
  $workingDirectory = if ($waveTarget) { [IO.Path]::GetDirectoryName($waveTarget) } else { $diagnosticRoot }
  Assert-NarrationNoReparseAncestors -Candidate $workingDirectory -Boundary $diagnosticRoot
  $script:waveWorkingPath = Join-Path $workingDirectory ".parsyuva-winrt-narration.$PID.$([guid]::NewGuid().ToString('N')).partial.wav"
  $script:waveWorkingOwned = $true
  $winRtSynthesizer = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  try {
    $winRtSynthesizer.Voice = $selectedVoice
    $speechStream = Await-WinRtNarrationOperation -Operation $winRtSynthesizer.SynthesizeTextToStreamAsync($Text) -ResultType ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    try {
      $readStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($speechStream)
      try {
        $fileStream = [IO.FileStream]::new($script:waveWorkingPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None, 4096, [IO.FileOptions]::WriteThrough)
        try { $readStream.CopyTo($fileStream); $fileStream.Flush($true) } finally { $fileStream.Dispose() }
      } finally { $readStream.Dispose() }
    } finally { $speechStream.Dispose() }
  } finally { $winRtSynthesizer.Dispose() }
  $completion.eventObserved = $true
  $completion.promptIsCompleted = $true
  if (Test-Path -LiteralPath $StopFile) {
    $evidence.status = 'CANCELLED_BY_STOP_FILE'
    $evidence.promptCancelled = $true
    $evidence.stopFileObserved = $true
    Remove-PartialWave
    return
  }
  $verifiedWave = Get-VerifiedWaveEvidence -Path $script:waveWorkingPath
  if ($waveTarget) {
    $evidence.status = 'PASS'
    $evidence.promptCompleted = $true
    return
  }
  $player = New-Object System.Media.SoundPlayer($script:waveWorkingPath)
  try {
    $player.Load()
    $player.Play()
    $playbackTimer = [Diagnostics.Stopwatch]::StartNew()
    $playbackLimitMs = [Math]::Min(($TimeoutSeconds * 1000), ([double]$verifiedWave.durationMs + 750))
    while ($playbackTimer.ElapsedMilliseconds -lt $playbackLimitMs) {
      if (Test-Path -LiteralPath $StopFile) {
        $player.Stop()
        $evidence.status = 'CANCELLED_BY_STOP_FILE'
        $evidence.promptCancelled = $true
        $evidence.stopFileObserved = $true
        break
      }
      Start-Sleep -Milliseconds 100
    }
    if ($evidence.status -eq 'STARTED') {
      $evidence.status = 'PASS'
      $evidence.promptCompleted = $true
    }
  } finally {
    $player.Stop()
    $player.Dispose()
    Remove-PartialWave
  }
}

try {
  if ($diagnosticMode) {
    [IO.Directory]::CreateDirectory($diagnosticRoot) | Out-Null
    Assert-NarrationNoReparseAncestors -Candidate $diagnosticRoot -Boundary $diagnosticRoot
  }
  if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) { $evidenceTarget = Resolve-NarrationDiagnosticPath -Path $EvidencePath -Extension '.json' }
  if (-not [string]::IsNullOrWhiteSpace($WaveOutputPath)) { $waveTarget = Resolve-NarrationDiagnosticPath -Path $WaveOutputPath -Extension '.wav' }
  if ($waveTarget -and [IO.Path]::GetFullPath($StopFile).Equals($waveTarget, [StringComparison]::OrdinalIgnoreCase)) { throw 'Narration stop and wave output paths must differ.' }
  if ($diagnosticMode) {
    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
    $desktopPackagePath = Join-Path $repositoryRoot 'apps\desktop\package.json'
    $appMetaPath = Join-Path $repositoryRoot 'packages\domain\src\app-meta.ts'
    $desktopPackage = Get-Content -LiteralPath $desktopPackagePath -Raw | ConvertFrom-Json
    $appMetaSource = Get-Content -LiteralPath $appMetaPath -Raw
    $applicationVersionMatch = [regex]::Match($appMetaSource, "version: '([^']+)'")
    $packageVersionMatch = [regex]::Match($appMetaSource, "packageVersion: '([^']+)'")
    if (-not $applicationVersionMatch.Success -or -not $packageVersionMatch.Success -or
      [string]$desktopPackage.version -ne $packageVersionMatch.Groups[1].Value) {
      throw 'Application version could not be resolved consistently for narration evidence.'
    }
    $evidence.source = [ordered]@{
      scriptPath = (Get-NarrationRelativePath -Candidate $PSCommandPath -Parent $repositoryRoot).Replace('\', '/')
      scriptSha256 = Get-NarrationFileSha256 -Path $PSCommandPath
      applicationVersion = $applicationVersionMatch.Groups[1].Value
      packageVersion = [string]$desktopPackage.version
      narrationTextSha256 = $null
    }
  }
  $text = if ($Language -eq 'tr') {
    'ParsYuva Aile Yaşam Merkezi kurulumuna hoş geldiniz. Ailenizi oluşturmaya sakin ve güvenli bir ilk adımla başlayın. Kurulum çevrimiçi aile hesabı oluşturmaz ve kişisel bilgilerinizi aktarmaz. İleri düğmesine basarak devam edebilirsiniz.'
  } else {
    'Welcome to ParsYuva Family Life Center setup. Begin creating your family with a calm and secure first step. Setup does not create an online family account or transmit your personal information. Press Next to continue.'
  }
  if ($diagnosticMode) {
    $textBytes = [Text.Encoding]::UTF8.GetBytes($text)
    $textHasher = [Security.Cryptography.SHA256]::Create()
    try { $evidence.source.narrationTextSha256 = Convert-NarrationBytesToLowerHex -Bytes ($textHasher.ComputeHash($textBytes)) }
    finally { $textHasher.Dispose() }
  }
  $useWinRtFallback = $false
  Add-Type -AssemblyName System.Speech
  $synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  try {
    $completionSourceIdentifier = "ParsYuvaInstallerNarration.$PID.$([guid]::NewGuid().ToString('N'))"
    $completionSubscription = Register-ObjectEvent -InputObject $synthesizer -EventName SpeakCompleted -SourceIdentifier $completionSourceIdentifier
    $languagePrefix = "$Language-"
    $voices = @(
      $synthesizer.GetInstalledVoices() |
        Where-Object {
          $_.Enabled -and
          $_.VoiceInfo.Culture.Name.StartsWith(
            $languagePrefix,
            [System.StringComparison]::OrdinalIgnoreCase
          )
        }
    )

    $evidence.voiceInventory = @($voices | ForEach-Object {
      [ordered]@{
        name = $_.VoiceInfo.Name
        culture = $_.VoiceInfo.Culture.Name
        gender = $_.VoiceInfo.Gender.ToString()
        enabled = $_.Enabled
      }
    })

    $useWinRtFallback = $voices.Count -eq 0

    if (-not $useWinRtFallback) {
    $evidence.engine = 'SYSTEM_SPEECH'
    $femaleVoice = @(
      $voices | Where-Object {
        $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female
      }
    ) | Select-Object -First 1
    $maleVoice = @(
      $voices | Where-Object {
        $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Male
      }
    ) | Select-Object -First 1
    $selectedVoice = if ($femaleVoice) { $femaleVoice } elseif ($maleVoice) { $maleVoice } else { $voices[0] }
    $evidence.selectionReason = if ($femaleVoice) { 'SAME_LANGUAGE_FEMALE_PREFERRED' } elseif ($maleVoice) { 'SAME_LANGUAGE_MALE_FALLBACK' } else { 'SAME_LANGUAGE_FIRST_VOICE_FALLBACK' }
    $evidence.selectedVoice = [ordered]@{
      name = $selectedVoice.VoiceInfo.Name
      culture = $selectedVoice.VoiceInfo.Culture.Name
      gender = $selectedVoice.VoiceInfo.Gender.ToString()
    }
    $synthesizer.SelectVoice($selectedVoice.VoiceInfo.Name)

    if ($waveTarget) {
      $waveWorkingPath = Join-Path ([IO.Path]::GetDirectoryName($waveTarget)) ".$([IO.Path]::GetFileName($waveTarget)).$PID.$([guid]::NewGuid().ToString('N')).partial.wav"
      $waveWorkingOwned = $true
      $synthesizer.SetOutputToWaveFile($waveWorkingPath)
    }

    if (Test-Path -LiteralPath $StopFile) {
      $evidence.status = 'CANCELLED_BEFORE_START'
      $evidence.promptCancelled = $true
      $evidence.stopFileObserved = $true
    } else {
      $prompt = $synthesizer.SpeakAsync($text)
      $timer = [Diagnostics.Stopwatch]::StartNew()
      while (-not $prompt.IsCompleted) {
        [void](Receive-NarrationCompletionEvent)
        if (Test-Path -LiteralPath $StopFile) {
          $synthesizer.SpeakAsyncCancel($prompt)
          $evidence.status = 'CANCELLED_BY_STOP_FILE'
          $evidence.promptCancelled = $true
          $evidence.stopFileObserved = $true
          break
        }
        if ($timer.Elapsed.TotalSeconds -ge $TimeoutSeconds) {
          $synthesizer.SpeakAsyncCancel($prompt)
          $evidence.status = 'TIMEOUT'
          $evidence.promptCancelled = $true
          $evidence.failureCode = 'NARRATION_TIMEOUT'
          break
        }
        Start-Sleep -Milliseconds 100
      }
      if ($evidence.promptCancelled) {
        $cancelTimer = [Diagnostics.Stopwatch]::StartNew()
        while ((-not $prompt.IsCompleted -or -not $completion.eventObserved) -and $cancelTimer.Elapsed.TotalSeconds -lt 5) {
          [void](Receive-NarrationCompletionEvent)
          Start-Sleep -Milliseconds 50
        }
        if (-not $prompt.IsCompleted) {
          $evidence.status = 'FAIL'
          $evidence.failureCode = 'NARRATION_CANCEL_TIMEOUT'
        }
      }
      if ($evidence.status -eq 'STARTED') {
        $completionTimer = [Diagnostics.Stopwatch]::StartNew()
        while (-not $completion.eventObserved -and $completionTimer.Elapsed.TotalSeconds -lt 2) {
          [void](Receive-NarrationCompletionEvent)
          Start-Sleep -Milliseconds 25
        }
        if (-not $completion.eventObserved) {
          $evidence.status = 'FAIL'
          $evidence.failureCode = 'NARRATION_COMPLETION_EVENT_MISSING'
        } elseif ($null -ne $completion.errorType) {
          $evidence.status = 'FAIL'
          $evidence.failureCode = 'NARRATION_ASYNC_ERROR'
        } elseif ($completion.cancelled) {
          $evidence.status = 'FAIL'
          $evidence.failureCode = 'NARRATION_UNEXPECTED_CANCELLATION'
        } elseif (-not $prompt.IsCompleted) {
          $evidence.status = 'FAIL'
          $evidence.failureCode = 'NARRATION_PROMPT_NOT_COMPLETED'
        } else {
          $evidence.status = 'PASS'
          $evidence.promptCompleted = $true
        }
      }
      $completion.promptIsCompleted = $prompt.IsCompleted
    }
    }
  } finally {
    if ($null -ne $completionSubscription) {
      Unregister-Event -SourceIdentifier $completionSourceIdentifier -ErrorAction SilentlyContinue
      Get-Event -SourceIdentifier $completionSourceIdentifier -ErrorAction SilentlyContinue | Remove-Event -ErrorAction SilentlyContinue
    }
    $synthesizer.Dispose()
  }
  if ($useWinRtFallback) { Invoke-WinRtNarration -Text $text }

  if ($waveTarget -and $evidence.status -eq 'PASS') {
    $evidence.wave = Get-VerifiedWaveEvidence -Path $waveWorkingPath
    Assert-NarrationNoReparseAncestors -Candidate ([IO.Path]::GetDirectoryName($waveTarget)) -Boundary $diagnosticRoot
    if (Test-Path -LiteralPath $waveTarget) { throw 'Narration wave target appeared before atomic commit.' }
    [IO.File]::Move($waveWorkingPath, $waveTarget)
    $waveWorkingOwned = $false
    $waveCommittedByThisRun = $true
    $evidence.wave.path = $waveTarget
    $evidence.wave.sha256 = Get-NarrationFileSha256 -Path $waveTarget
  }
  if ($waveTarget -and $evidence.status -ne 'PASS') { Remove-PartialWave }
  $evidence.completedAt = [DateTime]::UtcNow.ToString('o')
  Write-NarrationEvidence
  if ($diagnosticMode -and $evidence.status -ne 'PASS') { [Environment]::Exit(3) }
} catch {
  Remove-PartialWave
  $evidence.status = 'FAIL'
  $evidence.failureCode = $_.Exception.GetType().Name
  $evidence.failureMessage = $_.Exception.Message
  $evidence.completedAt = [DateTime]::UtcNow.ToString('o')
  try { Write-NarrationEvidence } catch { }
  if (-not [string]::IsNullOrWhiteSpace($evidenceTemporaryPath) -and (Test-Path -LiteralPath $evidenceTemporaryPath)) {
    try {
      Assert-NarrationNoReparseAncestors -Candidate ([IO.Path]::GetDirectoryName($evidenceTemporaryPath)) -Boundary $diagnosticRoot
      Remove-Item -LiteralPath $evidenceTemporaryPath -Force
    } catch { }
  }
  # Narration is assistive. Visible installer text remains complete and the
  # installer must continue when Windows has no same-language speech voice.
  if ($diagnosticMode) { [Environment]::Exit(1) }
  [Environment]::Exit(0)
}
[Environment]::Exit(0)
