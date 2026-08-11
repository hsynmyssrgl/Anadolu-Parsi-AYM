# Panthera pardus tulliana Aile — Bronze RC2 Build 83

Sürüm: 24.07.2026.83  
Paket: 24.7.2026-83  
Durum: Bronze RC2 Aktif Geliştirme

## Değişiklik

Ana ekran anlık görüntüsündeki `lastUpdatedAt` sorgusu `FamilyDataStore` doğrudan SQL sınırından çıkarıldı. `GetLatestAuditOccurredAtUseCase`, `AuditReadQueryPort`, `RepositoryBackedAuditReadQueryPort` ve `SqliteAuditRepository.latestOccurredAt()` üzerinden transaction kontrollü okuma sağlandı.

RC2 Final ve Code Freeze etkin değildir.
