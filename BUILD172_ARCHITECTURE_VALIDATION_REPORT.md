# Build 172 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.172`
- Package Version: `29.7.2026-172`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 167–171 güvenlik zinciri korunur. Build 172, işletim sistemi korumalı bakım yeniden doğrulama durumunun cihaz bağlama, koruma kesintisi, eski şema yükseltme ve güvenli silme yaşam döngüsünü tamamlar.

## Mimari sonuç

- Yeni korunan zarf şema 2 kullanır ve yalnız SHA-256 cihaz bağlama özeti taşır.
- Ham cihaz kimliği, açık anahtar parmak izi, parola, TOTP, oturum belirteci ve IPC payload'ı kalıcı zarfa yazılmaz.
- Aynı cihaz bağlama özeti ve aynı işletim sistemi koruma sağlayıcısı doğrulanmadan payload açılmaz.
- Geçici koruma kullanılamazlığı geçerli dosyayı silmez, değiştirmez veya karantinaya taşımaz; bakım işlemleri fail-closed tutulur.
- Farklı cihaz, sağlayıcı değişikliği, çözme hatası, bütünlük hatası ve şema hatası ayrı sınıflandırılır.
- Build 171 şema 1 kayıtları başarılı yükleme sonrasında şema 2'ye yeniden sarılır.
- Aktif durum temizliği ve karantina budaması boyutla sınırlı rastgele üzerine yazma, `fsync` ve kaldırma adımlarını uygular.
- SSD veya dosya sistemi düzeyinde fiziksel yok etme iddiası yapılmaz; işletim sistemi kriptografik koruması ana gizlilik sınırıdır.
- Active stage korunur; otomatik Final, Freeze, Silver veya Gold geçişi yapılmaz.
