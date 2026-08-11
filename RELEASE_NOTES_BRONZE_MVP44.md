# Panthera pardus tulliana — Bronze MVP-44

**Sürüm:** 23.07.2026.44  
**Paket sürümü:** 23.7.2026-44  
**Revizyon:** REVİZYON-060  
**Milestone:** B060-M5 Repository & Outbox Foundation

## Eklenenler

- `SqliteRepository` ortak repository tabanı
- `SqlitePersonRepository`
- `SqliteAuditRepository`
- `SqliteOutboxRepository`
- `0004_transactional_outbox.sql` migration’ı
- `event_outbox` ve `event_handler_receipts` altyapı tabloları
- Outbox pending/aggregate index’leri
- Repository–outbox doğrulama otomasyonu
- Transactional commit/rollback atomiklik testi

## Değiştirilenler

- `FamilyDataStore.createMember`, doğrudan SQL yerine repository katmanına geçirildi.
- Kişi, audit ve domain event yazımı tek `SqliteTransactionExecutor` transaction’ında birleştirildi.
- Electron runtime clock ve correlation provider, data-store katmanına bağlandı.
- Desktop workspace’i yerel `@ppt/repositories` ve `@ppt/events` paketlerine bağlandı.
- Migration kataloğu dört sürüme yükseltildi.
- Şema metadata değeri `REVISION-060-B060-M5` olarak güncellendi.

## Korunan davranışlar

- Renderer doğrudan SQLite, dosya sistemi veya secret store kullanmaz.
- Aile üyesi ekleme ekranının mevcut IPC ve dönüş sözleşmesi değişmemiştir.
- Mevcut 124 IPC kanalı ve preload çağrısı korunmuştur.
- Mevcut veritabanı adı ve yerel `.db` yedekleme davranışı korunmuştur.
- Uygulama kapsamına broker veya otomatik borsa emir bileşeni eklenmemiştir.

## Sonraki sürüm

MVP-45 kapsamında outbox event dispatcher, retry politikası, handler receipt/idempotency ve ilk event handler’lar geliştirilecektir.

Bu sürüm Bronze geliştirme kaynak teslimidir; Silver test veya Gold üretim artifact’i değildir.
