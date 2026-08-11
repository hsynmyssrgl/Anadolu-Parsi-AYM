# Sürüm Notları — Bronze RC2 Build 129

## İşletim sistemi korumalı TOTP MFA sırrı

Build 129, TOTP üretiminde kullanılan paylaşılan sırrın açık SQLite metni olarak
saklanmasını kaldırır ve işletim sistemi korumalı sürümlü zarf kullanır.

### Güvenlik değişiklikleri

- Yeni ve bekleyen TOTP sırları `safeStorage` ile korunur.
- Windows ve paketli uygulamada DPAPI destekli koruma zorunludur.
- Şifreli zarf amaç, şema, koruma sağlayıcısı ve Base64 şifreli yük taşır.
- Zarf içinde veya veritabanında açık TOTP sırrı bulunmaz.
- Legacy açık sırlar transaction içinde atomik compare-and-swap güncellemesiyle taşınır.
- Koruma sağlayıcısı yoksa, zarf bozuksa veya çözme başarısızsa sistem fail-closed davranır.
- Mevcut MFA doğrulama, kurtarma kodu tüketimi ve güvenilir cihaz davranışı korunur.

### Belge etkisi

- Ana Karar Kaydı `DEC-043`
- `ADR-014-os-protected-mfa-secret.md`
- Güvenlik başlangıç çizgisi ve uzmanlık standardı
- Bronze gereksinim izlenebilirliği ve gerçek Windows doğrulama maddeleri

Gerçek Windows DPAPI oluşturma, yeniden açma ve legacy migration kanıtı henüz
üretilmemiştir; bu promotion kapısı `NOT_RUN` olarak korunur.
