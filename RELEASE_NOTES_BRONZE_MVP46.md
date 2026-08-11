# Panthera pardus tulliana — Bronze MVP-46 Release Notları

**Sürüm:** `23.07.2026.46`  
**Milestone:** `B060-M6 — Family Application Use Cases`

## Yeni

- Aile grafiğini repository katmanından okuyan `GetFamilyGraphUseCase` eklendi.
- Aile üyesi oluşturma için doğrulama, transaction, audit ve outbox koordinasyonu yapan `CreateFamilyMemberUseCase` eklendi.
- Aile ilişkisi oluşturma için kişi/aile doğrulaması, duplicate kontrolü, audit ve outbox koordinasyonu yapan `CreateFamilyRelationUseCase` eklendi.
- Family application unit-of-work ve read-query portları eklendi.
- Family ve relation SQLite repository implementasyonları eklendi.
- `family.relation.created` için structured log ve idempotent diagnostic projection handler'ları eklendi.

## Değişen

- `FamilyDataStore.getSnapshot()` aile, üye ve ilişki verilerini doğrudan SQL yerine application query use-case üzerinden alıyor.
- `FamilyDataStore.createMember()` doğrudan repository koordinasyonu yerine application command use-case çağırıyor.
- `FamilyDataStore.createRelation()` doğrudan SQL yerine application command use-case çağırıyor.
- `family:createRelation` IPC akışı transaction sonrasında outbox dispatch çalıştırıyor.
- Timeline repository portu application katmanına taşındı; application paketinin infrastructure bağımlılığı kaldırıldı.
- Sürüm sırası Temmuz 2026 içindeki 46. geliştirme olarak kaydedildi.

## Korunan uyumluluk

- Renderer API'si ve ekran davranışı değişmedi.
- IPC kanal sayısı 124 olarak korundu.
- Mevcut SQLite şeması ve beş migration korundu.
- Mevcut aile, üye, ilişki, zaman tüneli ve yedekleme verileri korunuyor.
- Gold için Silver'da test edilen aynı artifact kuralı değişmedi.
