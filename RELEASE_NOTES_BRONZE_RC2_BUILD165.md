# Bronze RC2 Build 165 Sürüm Notları

- Application Version: `29.07.2026.165`
- Package Version: `29.7.2026-165`
- Stage: **Bronze RC2 Active Development**

## Değişiklikler

- Adaptif IPC bütçeleri `userData/runtime-state` altında kalıcı hâle getirildi.
- Atomik JSON durum dosyası ve SHA-256 zincirli JSONL karar günlüğü eklendi.
- Durum uygulama sürümü ve adaptif politika parmak izine bağlandı.
- Son doğrulanmış karar için 15 dakikalık tazelik sınırı uygulandı.
- Durum dosyası kaybolduğunda geçerli günlükten kurtarma eklendi.
- Bozuk, eski veya farklı sürüm/politika durumu karantinaya alınarak baseline moda dönülüyor.
- Günlük girdi ve byte sınırlarıyla kontrol altında tutuluyor.
- Sistem Sağlığı ekranına kalıcılık durumu eklendi.

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
