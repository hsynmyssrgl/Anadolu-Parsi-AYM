# Bronze RC2 Build 81 Sürüm Notları

- Uygulama: `24.07.2026.81`
- Paket: `24.7.2026-81`
- Aşama: Bronze RC2 Aktif Geliştirme

## Değişiklik

Eski denetim kayıtlarının hash zincirini tamamlayan işlem `SqliteAuditRepository.backfillMissingChain` metoduna taşındı. `FamilyDataStore` içindeki doğrudan `SELECT audit_log` ve `UPDATE audit_log` SQL kodu kaldırıldı; işlem `SqliteTransactionExecutor` transaction sınırında çalıştırılıyor. V1 hash üretim davranışı ve yalnızca tamamen hashesiz eski zincirlerin dönüştürülmesi kuralı korundu.

## Doğrulama kapsamı

Hedef mimari sınır doğrulaması, sürüm zinciri, manifest ve ZIP bütünlüğü. Tam TypeScript/Electron üretim derlemesi bu pakette çalıştırılmamıştır.
