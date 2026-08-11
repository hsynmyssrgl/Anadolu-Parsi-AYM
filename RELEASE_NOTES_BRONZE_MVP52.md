# Panthera pardus tulliana — Bronze MVP-52 Release Notları

**Sürüm:** `23.07.2026.52`  
**Milestone:** `B060-M12 — RBAC & Audit Chain Hardening`

## Eklenenler

- `CentralAuthorizationService`
- `EvaluateAuthorizationUseCase`
- `ListObjectPermissionsUseCase`
- `UpsertObjectPermissionUseCase`
- `DeleteObjectPermissionUseCase`
- `VerifyAuditIntegrityUseCase`
- `SqliteObjectPermissionRepository`
- `RepositoryBackedAuthorizationQueryPort` ve `RepositoryBackedAuthorizationUnitOfWork`
- Audit v2 hash hesaplama ve zincir doğrulama çekirdeği
- Migration 7: `authorization_audit_hardening`
- Authorization/audit otomatik doğrulama paketi

## Yetkilendirme davranışı

1. Etkin açık `deny` kayıtları öncelikle uygulanır.
2. Etkin aile yöneticisi rol politikası değerlendirilir.
3. Kayıt sahibi erişimi değerlendirilir.
4. Etkin açık `allow` izinleri değerlendirilir.
5. Son olarak rol tabanlı asgari politika uygulanır.

Yönetici işlemleri yalnızca etkin `family_admin` hesabına açıktır. Süresi başlamamış veya sona ermiş izin kayıtları karar sürecine alınmaz.

## Audit sertleştirmesi

- Her kayıt monoton `sequence_no` taşır.
- Yeni kayıtlar `hash_version=2` ile üretilir.
- Correlation kimliği hash girdisine bağlanır.
- Önceki hash ve sıra bütünlüğü doğrulanır.
- Audit satırları update/delete trigger’larıyla append-only korunur.
- Harici veri değişikliği bütünlük kontrolünde tespit edilir.

## Değiştirilenler

- Nesne izin işlemleri doğrudan SQL yerine application/repository mimarisinden geçiyor.
- Audit repository v2 zincir formatına geçirildi.
- Database migration sayısı `6`dan `7`ye yükseldi.
- Son şema fingerprint’i `4a9221f49849a93c572f0c5a07e924338fabd12722d76a012a910b49733b6411` olarak sabitlendi.
- Workspace temiz derleme sırası bağımlılık grafiğine uygun hâle getirildi.
