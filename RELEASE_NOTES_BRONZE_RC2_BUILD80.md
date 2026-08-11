# Bronze RC2 Build 80 Sürüm Notları

- Uygulama: `24.07.2026.80`
- Paket: `24.7.2026-80`
- Aşama: Bronze RC2 Aktif Geliştirme

## Değişiklik

Uygulama açılışında en az bir `family_admin` hesabı bulunmasını sağlayan bütünlük onarımı `SqliteAccountRepository.ensureFamilyAdminExists` metoduna taşındı. `FamilyDataStore` içindeki doğrudan `UPDATE accounts` SQL'i kaldırıldı ve işlem `SqliteTransactionExecutor` sınırında yürütüldü.

## Doğrulama kapsamı

Hedef mimari sınır doğrulaması, sürüm zinciri, manifest ve ZIP bütünlüğü. Tam TypeScript/Electron üretim derlemesi bu pakette çalıştırılmamıştır.
