# Sürüm Notları — Bronze RC2 Build 128

## İşletim sistemi korumalı cihaz kimliği

Build 128, güvenilir cihaz kimliğinin Ed25519 özel anahtarını açık JSON dosyasından
işletim sistemi korumalı şifreli zarfa taşır.

### Güvenlik değişiklikleri

- Electron `safeStorage` adaptörü eklendi.
- Windows ve paketli çalışma zamanında güvenli depolama zorunlu hâle getirildi.
- Windows üzerinde DPAPI destekli koruma kullanılır.
- `basic_text` arka ucu güvenli depolama sayılmaz.
- Eski cihaz kimliği dosyası cihaz kimliği değişmeden atomik olarak dönüştürülür.
- Başarısız migration geri alınır; başarılı geçişte açık yedek kaldırılır.
- Şifreli zarf yalnız açık metadata ve şifreli özel anahtar yükü taşır.
- Özel/açık anahtar eşleşmesi her yüklemede kriptografik olarak doğrulanır.
- Koruma kullanılamıyorsa zorunlu ortamlarda sistem fail-closed davranır.

### Belge etkisi

- Ana Karar Kaydı `DEC-042`
- `ADR-013-os-protected-device-identity-secret.md`
- Güvenlik başlangıç çizgisi ve uzmanlık standardı
- Bronze gereksinim izlenebilirliği ve açık Windows doğrulama maddeleri

Bu build gerçek Windows DPAPI açılış/yeniden açılış/migration kanıtını henüz
üretmez; bu kapı `NOT_RUN` olarak korunur.
