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
$diagnosticMode = -not [string]::IsNullOrWhiteSpace($EvidencePath) -or -not [string]::IsNullOrWhiteSpace($WaveOutputPath)
$diagnosticRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) 'ParsYuvaInstallerEvidence'))
$evidenceTarget = $null
$waveTarget = $null
$evidence = [ordered]@{
  schemaVersion = 1
  status = 'STARTED'
  language = $Language
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
}

function Resolve-NarrationDiagnosticPath {
  param([string]$Path, [string]$Extension)
  $target = [IO.Path]::GetFullPath($Path)
  $prefix = $diagnosticRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Narration diagnostic output must remain under the approved temporary root.' }
  if (-not [IO.Path]::GetExtension($target).Equals($Extension, [StringComparison]::OrdinalIgnoreCase)) { throw "Narration diagnostic output must use the $Extension extension." }
  if (Test-Path -LiteralPath $target) { throw 'Narration diagnostic output already exists.' }
  $directory = [IO.Path]::GetDirectoryName($target)
  if (-not [string]::IsNullOrWhiteSpace($directory)) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
  return $target
}

function Write-NarrationEvidence {
  if ([string]::IsNullOrWhiteSpace($evidenceTarget)) { return }
  $json = $evidence | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText($evidenceTarget, "$json`n", [Text.UTF8Encoding]::new($false))
}

function Remove-PartialWave {
  if (-not [string]::IsNullOrWhiteSpace($waveTarget) -and (Test-Path -LiteralPath $waveTarget)) {
    Remove-Item -LiteralPath $waveTarget -Force
  }
}

function Get-VerifiedWaveEvidence {
  $bytes = [IO.File]::ReadAllBytes($waveTarget)
  if ($bytes.Length -le 44) { throw 'Narration wave output is empty.' }
  if ([Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF' -or [Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne 'WAVE') { throw 'Narration wave output has an invalid RIFF/WAVE signature.' }
  if ([BitConverter]::ToUInt32($bytes, 4) -ne ($bytes.Length - 8)) { throw 'Narration wave output has an invalid RIFF length.' }
  $offset = 12
  $dataBytes = 0
  while ($offset + 8 -le $bytes.Length) {
    $chunkId = [Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
    $chunkSize = [BitConverter]::ToUInt32($bytes, $offset + 4)
    $chunkStart = $offset + 8
    if ($chunkStart + $chunkSize -gt $bytes.Length) { throw 'Narration wave output contains an invalid chunk boundary.' }
    if ($chunkId -eq 'data') { $dataBytes += $chunkSize }
    $offset = $chunkStart + $chunkSize + ($chunkSize % 2)
  }
  if ($dataBytes -le 0) { throw 'Narration wave output has no audio data chunk.' }
  return [ordered]@{
    path = $waveTarget
    sizeBytes = $bytes.Length
    dataBytes = $dataBytes
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $waveTarget).Hash.ToLowerInvariant()
    riffValidated = $true
  }
}

try {
  if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) { $evidenceTarget = Resolve-NarrationDiagnosticPath -Path $EvidencePath -Extension '.json' }
  if (-not [string]::IsNullOrWhiteSpace($WaveOutputPath)) { $waveTarget = Resolve-NarrationDiagnosticPath -Path $WaveOutputPath -Extension '.wav' }
  if ($waveTarget -and [IO.Path]::GetFullPath($StopFile).Equals($waveTarget, [StringComparison]::OrdinalIgnoreCase)) { throw 'Narration stop and wave output paths must differ.' }
  Add-Type -AssemblyName System.Speech
  $synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  try {
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

    if ($voices.Count -eq 0) {
      $evidence.status = 'NO_SAME_LANGUAGE_VOICE'
      $evidence.failureCode = 'NO_SAME_LANGUAGE_VOICE'
      $evidence.completedAt = [DateTime]::UtcNow.ToString('o')
      Write-NarrationEvidence
      if ($diagnosticMode) { exit 2 }
      exit 0
    }

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

    $text = if ($Language -eq 'tr') {
      'ParsYuva Aile Yaşam Merkezi kurulumuna hoş geldiniz. Ailenizi oluşturmaya sakin ve güvenli bir ilk adımla başlayın. Kurulum çevrimiçi aile hesabı oluşturmaz ve kişisel bilgilerinizi aktarmaz. İleri düğmesine basarak devam edebilirsiniz.'
    } else {
      'Welcome to ParsYuva Family Life Center setup. Begin creating your family with a calm and secure first step. Setup does not create an online family account or transmit your personal information. Press Next to continue.'
    }

    if ($waveTarget) {
      $synthesizer.SetOutputToWaveFile($waveTarget)
    }

    if (Test-Path -LiteralPath $StopFile) {
      $evidence.status = 'CANCELLED_BEFORE_START'
      $evidence.promptCancelled = $true
      $evidence.stopFileObserved = $true
    } else {
      $prompt = $synthesizer.SpeakAsync($text)
      $timer = [Diagnostics.Stopwatch]::StartNew()
      while (-not $prompt.IsCompleted) {
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
        while (-not $prompt.IsCompleted -and $cancelTimer.Elapsed.TotalSeconds -lt 5) { Start-Sleep -Milliseconds 50 }
        if (-not $prompt.IsCompleted) {
          $evidence.status = 'FAIL'
          $evidence.failureCode = 'NARRATION_CANCEL_TIMEOUT'
        }
      }
      if ($evidence.status -eq 'STARTED') {
        $evidence.status = 'PASS'
        $evidence.promptCompleted = $true
      }
    }
  } finally {
    $synthesizer.Dispose()
  }

  if ($waveTarget -and $evidence.status -eq 'PASS') { $evidence.wave = Get-VerifiedWaveEvidence }
  if ($waveTarget -and $evidence.status -ne 'PASS') { Remove-PartialWave }
  $evidence.completedAt = [DateTime]::UtcNow.ToString('o')
  Write-NarrationEvidence
  if ($diagnosticMode -and $evidence.status -ne 'PASS') { exit 3 }
} catch {
  Remove-PartialWave
  $evidence.status = 'FAIL'
  $evidence.failureCode = $_.Exception.GetType().Name
  $evidence.completedAt = [DateTime]::UtcNow.ToString('o')
  try { Write-NarrationEvidence } catch { }
  # Narration is assistive. Visible installer text remains complete and the
  # installer must continue when Windows has no same-language speech voice.
  if ($diagnosticMode) { exit 1 }
  exit 0
}
