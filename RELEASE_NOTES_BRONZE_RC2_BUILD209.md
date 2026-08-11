# Release Notes — Bronze RC2 Build 209

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.209`
- Package Version: `1.8.2026-209`
- Stage: **Bronze RC2 Active Development**
- Build: **209**

## Yeni

- Anadolu Parsı markalı ilk çalıştırma tanıtımı, Türkçe sesli anlatım, altyazı, sessize alma, geçme ve tekrar oynatma.
- İlk hesap kurulumundan sonra ana uygulamaya geçmeden zorunlu TOTP + kurtarma kodu güvenlik adımı.
- Apple, Google ve Microsoft dış kimlik sağlayıcılarının ortak OIDC mimari yüzeyi; gerçek canlı bağlantı sağlayıcı kayıtları tamamlanana kadar PENDING.
- `UserDataVault`: kalıcı kullanıcı verisi için AES-256-GCM şifreli kasa, scrypt parola türetimi ve Windows safeStorage/DPAPI cihaz bağı.
- Girişten önce SQLite açılmaması; logout, süre dolumu ve kapanışta yeniden mühürleme ve geçici çalışma alanı temizliği.
- Parola değişiminde kasa anahtar zarfının döndürülmesi; eski parolanın kasa erişimini kaybetmesi.
- Arşiv belgeleri için yalnız uygulama içi güvenli önizleme; haricî `shell.openPath` kaldırıldı.
- Kalıcı Library yolu: `/Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi`.

## Güvenlik sınırı

Aktif oturum sayfa şifreleme (`OPEN-021`) ve hassas yan artifact kapanışı (`OPEN-022`) Bronze Final blokajıdır. Aynı-kullanıcı malware/yöneticiye karşı mutlak garanti verilmez.
