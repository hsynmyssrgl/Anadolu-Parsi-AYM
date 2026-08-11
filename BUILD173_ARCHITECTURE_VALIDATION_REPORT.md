# Build 173 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.173`
- Package Version: `29.7.2026-173`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 167–172 güvenlik zinciri korunur. Build 173, kilitli bakım yeniden doğrulama durumunu koşulsuz atlamadan, ayrı kalıcı deneme bağlamı ve güçlü kimlik doğrulama ile yetkili kurtarma olanağı sağlar.

## Mimari sonuç

- Kurtarma yalnız birincil bakım yetkisi `REAUTHENTICATION_LOCKED` olduğunda açılır.
- Kurtarma bağlam anahtarı birincil kimlik doğrulama parmak izinden SHA-256 ve alan ayrımıyla türetilir.
- Kurtarma girişimleri mevcut işletim sistemi korumalı durum deposunda ayrı bağlam olarak kalıcı tutulur.
- `family_admin`, geçerli oturum ve güvenilir cihaz koşulları değişmeden korunur.
- Parola ve etkinse TOTP/kurtarma kodu güçlü yeniden doğrulama servisinde doğrulanır.
- Sabit açık onay ifadesi ve yerel işletim sistemi uyarı penceresi birlikte zorunludur.
- Başarılı kurtarma tüm kısa ömürlü bakım oturumlarını iptal eder ve yalnız yeniden doğrulama sayaç/kilit durumunu temizler.
- Aile verileri, adaptif kaynak bütçesi, telemetri ve yedekler değiştirilmez.
- Kimlik bilgileri, ikinci faktör ve onay metni denetim metadatasına taşınmaz.
- Active stage korunur; otomatik Final, Freeze, Silver veya Gold geçişi yapılmaz.
