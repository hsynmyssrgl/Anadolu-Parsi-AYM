# Bronze RC2 Build 82 Sürüm Notları

- Uygulama: `24.07.2026.82`
- Paket: `24.7.2026-82`
- Aşama: Bronze RC2 Aktif Geliştirme

## Değişiklik

İlk açılışta örnek aile verilerini oluşturan akış `SeedDefaultFamilyUseCase`, `RepositoryBackedBootstrapApplicationUnitOfWork` ve `SqliteBootstrapRepository.seedIfEmpty` sınırlarına taşındı. `FamilyDataStore` içindeki doğrudan aile, kişi, ilişki, konum ve etkinlik SQL kodları ile manuel `BEGIN/COMMIT/ROLLBACK` yönetimi kaldırıldı. Başlangıç verisinin yalnızca boş veritabanında oluşturulması ve `database.seeded` denetim kaydının aynı transaction içinde yazılması davranışı korundu.

## Doğrulama kapsamı

Hedef mimari sınır doğrulaması, sürüm zinciri, manifest ve ZIP bütünlüğü. Tam TypeScript/Electron üretim derlemesi bu pakette çalıştırılmamıştır.
