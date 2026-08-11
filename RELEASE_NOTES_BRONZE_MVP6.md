# Bronze MVP-6 — 21.07.2026.6

## Eklenenler
- `.pptbackup` tam yedekten geri yükleme.
- Geri yükleme öncesi otomatik tam güvenlik yedeği.
- SQLite başlığı ve `PRAGMA integrity_check` doğrulaması.
- 32 bayt dijital kasa anahtarı doğrulaması.
- Her şifreli arşiv zarfının geri yükleme öncesi çözülerek doğrulanması.
- Güvenli olmayan arşiv dosya adlarının reddedilmesi.
- Aşamalı dosya değişimi ve hata halinde önceki veriye geri dönme.
- Geri yükleme sonrası oturumun silinmesi, uygulamanın yeniden başlatılması ve yeniden giriş zorunluluğu.
- Arşiv boşken tam yedek alınamaması hatasının düzeltilmesi.

## Doğrulama
- TypeScript: başarılı
- Otomatik testler: 12/12 başarılı
- Electron ana süreç derlemesi: başarılı
- React/Vite üretim derlemesi: başarılı
