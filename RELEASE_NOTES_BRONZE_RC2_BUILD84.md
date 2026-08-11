# Bronze RC2 Build 84 Sürüm Notları

Sürüm: 24.07.2026.84
Durum: Bronze RC2 Aktif Geliştirme

- Bağımsız denetim kaydı yazma akışı application use-case sınırına taşındı.
- `AppendAuditEntryUseCase`, `AuditWriteCommandPort` ve `RepositoryBackedAuditWriteCommandPort` eklendi.
- `FamilyDataStore.#writeAudit()` içindeki doğrudan son kayıt sorgusu ve `INSERT INTO audit_log` kaldırıldı.
- Hash zinciri üretimi `SqliteAuditRepository.append()` içinde ve transaction sınırında korunuyor.
- RC2 Final veya Code Freeze uygulanmadı.
