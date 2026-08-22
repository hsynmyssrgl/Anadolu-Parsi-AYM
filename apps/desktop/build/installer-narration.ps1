param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('tr', 'en')]
  [string]$Language,

  [Parameter(Mandatory = $true)]
  [string]$StopFile
)

$ErrorActionPreference = 'Stop'

try {
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

    if ($voices.Count -eq 0) { exit 0 }

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
    $synthesizer.SelectVoice($selectedVoice.VoiceInfo.Name)

    $text = if ($Language -eq 'tr') {
      'ParsYuva Aile Yaşam Merkezi kurulumuna hoş geldiniz. Ailenizi oluşturmaya sakin ve güvenli bir ilk adımla başlayın. Kurulum çevrimiçi aile hesabı oluşturmaz ve kişisel bilgilerinizi aktarmaz. İleri düğmesine basarak devam edebilirsiniz.'
    } else {
      'Welcome to ParsYuva Family Life Center setup. Begin creating your family with a calm and secure first step. Setup does not create an online family account or transmit your personal information. Press Next to continue.'
    }

    $prompt = $synthesizer.SpeakAsync($text)
    while (-not $prompt.IsCompleted) {
      if (Test-Path -LiteralPath $StopFile) {
        $synthesizer.SpeakAsyncCancelAll()
        break
      }
      Start-Sleep -Milliseconds 100
    }
  } finally {
    $synthesizer.Dispose()
  }
} catch {
  # Narration is assistive. Visible installer text remains complete and the
  # installer must continue when Windows has no same-language speech voice.
  exit 0
}
