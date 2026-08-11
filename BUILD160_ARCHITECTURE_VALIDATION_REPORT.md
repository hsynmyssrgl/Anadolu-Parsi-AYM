# Build 160 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.160`
- Package Version: `29.7.2026-160`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 159 taşıma bağlamı korunur. Build 160 yalnız güvenli biçimde iptal edilebilen
okuma ve ağ kanallarına bounded request lifecycle ekler. Preload aynı kanaldaki
yeni `latest-wins` okumasında önceki isteği iptal eder; süre aşımı, oturum geçişi
ve renderer kapanışı doğrulanmış yan kanallarla ana sürece bildirilir.

Ana süreç sender + rendererSessionId + sessionEpoch + requestId + channel eşleşmesi
olmadan iptal uygulamaz. Mutasyon kanalları otomatik iptal politikasının dışındadır.
Kooperatif uzun işlemler AbortSignal alabilir; güvenli iptal listesi HTTPS
senkronizasyonu sinyali Node HTTPS isteğine kadar taşır.

## Mimari sonuç

- Bounded cancellable request registry: **PASS**
- Latest-wins read cancellation: **PASS**
- Request timeout classification: **PASS**
- Session/window cleanup: **PASS**
- Cross-session cancellation rejection: **PASS**
- Non-cancellable mutation preservation: **PASS**
- Cooperative HTTPS AbortSignal: **PASS**
- Active stage preservation: **PASS**
