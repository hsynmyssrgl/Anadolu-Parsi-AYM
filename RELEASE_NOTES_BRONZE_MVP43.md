# Panthera pardus tulliana — Bronze MVP-43

**Sürüm:** 23.07.2026.43  
**Paket sürümü:** 23.7.2026-43  
**Revizyon:** REVİZYON-060  
**Milestone:** B060-M4 Database Migration Foundation

## Eklenenler

- Merkezi SQLite connection factory ve başlangıç PRAGMA uygulaması
- Sürümlü, checksum doğrulamalı migration runner
- `schema_migrations` ve `database_metadata` altyapı tabloları
- Bilinen MVP-40/42 legacy schema fingerprint doğrulaması
- Legacy veri için migration öncesi güvenlik yedeği
- Bilinmeyen legacy şemada değişiklik yapmadan güvenli durdurma
- Migration checksum uyuşmazlığında kontrollü açılış engeli
- Transaction executor ve `Result.err` rollback davranışı
- SQLite hata kodlarının merkezi `AppError` modeline eşlenmesi
- WAL, foreign key, quick check ve schema health raporu
- Üç migration dosyası ve uygulama içi migration kataloğu
- Kalıcı aylık sürüm sıra defteri ve otomatik sürüm kapısı
- Database migration, data-store smoke ve Bronze Database Gate otomasyonları

## Değiştirilenler

- `FamilyDataStore` içindeki tek parça `#migrate()` metodu kaldırıldı.
- SQLite açılışı ve PRAGMA ayarları `@ppt/database` paketine taşındı.
- `FamilyDataStore`, merkezi migration runner üzerinden başlatılır hâle getirildi.
- Migration sonuçları structured logging ile kaydedilmeye başladı.
- Masaüstü workspace’i yerel `@ppt/database` paketine bağlandı.

## Korunan davranışlar

- Renderer doğrudan SQLite, dosya sistemi veya secret store kullanmaz.
- Mevcut `panthera-family.db` adı ve kullanıcı verisi korunur.
- Mevcut 124 IPC kanalı ve preload çağrısı değişmeden kalır.
- Aile üyeleri, soy ağacı, zaman tüneli, önemli günler ve yerel `.db` yedeği çalışmaya devam eder.
- Uygulama kapsamına broker veya otomatik borsa emir bileşeni eklenmemiştir.

Bu sürüm Bronze geliştirme kaynak teslimidir; Silver test veya Gold üretim artifact'i değildir.
