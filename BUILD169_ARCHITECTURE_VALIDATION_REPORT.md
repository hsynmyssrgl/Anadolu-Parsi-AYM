# Build 169 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.169`
- Package Version: `29.7.2026-169`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 167'nin tek kullanımlık bakım oturumu ve Build 168'in merkezi yetki politikası korunur. Build 169, bakım oturumu oluşturulmadan önce mevcut güçlü kimlik doğrulama portunu kullanarak parola ve etkinse TOTP doğrulaması ekler.

## Mimari sonuç

- Güçlü yeniden doğrulama oturum açılmadan önce uygulanır.
- TOTP gereksinimi hesap durumundan türetilir.
- Ham kimlik bilgileri oturum, günlük, telemetri ve tanı paketinden ayrıdır.
- IPC girdi şeması yalnız parola ve isteğe bağlı kodu, sınırlı uzunlukla kabul eder.
- Renderer işlem sonunda kimlik alanlarını temizler.
- Build 167 ve Build 168 güvenlik sınırları korunur.
- Active stage korunur.
