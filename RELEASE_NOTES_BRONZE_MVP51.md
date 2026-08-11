# Panthera pardus tulliana — Bronze MVP-51 Release Notları

**Sürüm:** `23.07.2026.51`  
**Milestone:** `B060-M11 — MFA Recovery & Trusted Device Identity`

## Eklenenler

- TOTP base32 kodlama ve doğrulama primitive’leri
- Kurtarma kodu üretme, hash’leme ve tek kullanımlık tüketim
- Ed25519 cihaz anahtar çifti, fingerprint ve imza doğrulama
- `FileDeviceIdentityProvider`
- `SqliteTrustedDeviceRepository`
- `BeginTwoFactorSetupUseCase`
- `EnableTwoFactorUseCase`
- `DisableTwoFactorUseCase`
- `TrustCurrentDeviceUseCase`
- `ListTrustedDevicesUseCase`
- `RevokeTrustedDeviceUseCase`
- Migration 6: `trusted_devices`
- Üç cihaz yönetimi IPC kanalı
- MFA ve güvenilir cihaz otomatik doğrulama paketi

## Değiştirilenler

- Login use-case’i TOTP, recovery code ve güvenilir cihaz kanıtını değerlendiriyor.
- Auth state mevcut cihaz kimliği, güven durumu ve kalan recovery code sayısını taşıyor.
- Hesap repository’si bekleyen/aktif TOTP ve recovery hash alanlarını yönetiyor.
- Runtime config içine bağımsız `secrets` yolu eklendi.
- IPC sayısı `125`ten `128`e yükseldi.
- Database migration sayısı `5`ten `6`ya yükseldi.
- Son uygulama şeması fingerprint’i sürüm kapısına bağlandı.

## Güvenlik davranışı

- TOTP: SHA-1/HMAC, 30 saniye periyot, 6 hane ve ±1 zaman penceresi.
- Kurtarma kodları açık metin olarak veritabanına yazılmaz.
- Kullanılmış kurtarma kodu yeniden kabul edilmez.
- Güvenilir cihaz yalnızca kayıtlı Ed25519 açık anahtarıyla doğrulanan imza sonrasında kabul edilir.
- İptal edilmiş cihaz bir sonraki girişte yeniden MFA ister.
- Yeni kurulum farklı cihaz kimliği üretir ve mevcut güveni devralmaz.
- MFA kapatılması bütün aktif cihaz güvenlerini iptal eder.
