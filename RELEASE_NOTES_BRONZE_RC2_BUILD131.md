# Bronze RC2 Build 131 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.131`
- Package Version: `27.7.2026-131`
- Stage: **Bronze RC2 Active Development**
- Build: **131**

## Değişiklikler

- Tam geri yükleme için `restore-transaction.json` dayanıklı işlem günlüğü eklendi.
- İşlem `prepared`, `live-moved`, `staged-installed`, `committed` aşamalarına ayrıldı.
- Günlük ve yeniden giriş işareti atomik geçici dosya, 0600 izin ve `fsync` ile yazılıyor.
- Marker yazılamazsa canlı eski veri seti rollback kopyalarından geri kuruluyor.
- Yarım kalan işlem uygulama açılışında otomatik geri alınıyor veya commit artıkları temizleniyor.
- Staged SQLite dosyası commit öncesinde ve güvenilir cihaz iptalinden sonra bütünlük kontrolünden geçiyor.
- Geri yüklenen veritabanındaki tüm aktif güvenilir cihazlar iptal ediliyor.
- Aynı cihaz kimliği kullanılsa bile eski cihaz güveni MFA atlaması sağlamıyor.
- Commit sonrasında uygulama zorunlu yeniden başlatılıyor.
- DEC-045 ve ADR-016 eklendi.
