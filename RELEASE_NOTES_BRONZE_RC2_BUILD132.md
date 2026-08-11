# Bronze RC2 Build 132 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.132`
- Package Version: `27.7.2026-132`
- Stage: **Bronze RC2 Active Development**
- Build: **132**

## Değişiklikler

- Ana süreçte `app.enableSandbox()` zorunlu hâle getirildi.
- Renderer webPreferences tek güvenli fabrikaya taşındı.
- Veri deposu açılmadan önce `safeStorage` kullanılabilirlik ve şifreleme turu eklendi.
- İlk açılışta OS korumalı `startup-security-sentinel.json` oluşturuluyor.
- Sonraki açılışta sentinel aynı sağlayıcıyla açılıp SHA-256 bütünlüğü doğrulanıyor.
- Sentinel atomik geçici dosya, `fsync` ve `0600` izinleriyle yazılıyor.
- Bozuk veya farklı sağlayıcıya ait sentinel fail-closed reddediliyor.
- `--no-sandbox`, `--single-process`, `--disable-gpu-sandbox`, RendererCodeIntegrity ve AppContainer kapatma seçenekleri normal çalışmada reddediliyor.
- Tanısal güvenlik istisnaları `DIAGNOSTIC_PASS` olarak ayrılıyor.
- Windows launch testi aynı kullanıcı veri diziniyle iki ayrı süreç çalıştıracak şekilde güncellendi.
- İlk süreç `created`, ikinci süreç `verified` DPAPI sentinel durumu vermek zorunda.
- Windows release ve sandbox diagnostic kanıtları sürümü kaynak metadata’dan dinamik çözüyor.
- DEC-046 ve ADR-017 eklendi.
