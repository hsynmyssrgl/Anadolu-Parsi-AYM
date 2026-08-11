# Panthera pardus tulliana — Bronze MVP-45 Release Notları

**Sürüm:** `23.07.2026.45`  
**Milestone:** `B060-M5 — Event Dispatcher & Idempotency`

## Yeni

- Outbox olaylarını batch olarak claim eden gerçek event dispatcher eklendi.
- Retryable handler hataları için exponential backoff eklendi.
- Non-retryable hata veya maksimum deneme sonrası `failed` durumu eklendi.
- Her event/handler çifti için başarı ve hata receipt kaydı eklendi.
- Başarılı handler'ın aynı event için tekrar çalışmasını engelleyen idempotency eklendi.
- Uygulama kapanması sonrası `processing` durumunda kalan olayları geri kazanan stale recovery eklendi.
- Aile üyesi oluşturulduğunda structured log ve diagnostic projection üreten iki handler eklendi.

## Değişen

- `family:createMember` IPC çağrısı, transaction tamamlandıktan sonra pending outbox olaylarını işler.
- Background scheduler, kullanıcı oturumu açık olmasa bile bekleyen sistem olaylarını güvenli şekilde işler.
- Outbox kayıtlarına `processing_started_at` alanı eklendi.
- Migration sayısı 4'ten 5'e yükseldi.

## Korunan uyumluluk

- Renderer API'si değişmedi.
- IPC kanal sayısı 124 olarak korundu.
- Mevcut SQLite kullanıcı verisi ve legacy fingerprint korundu.
- Person, audit ve outbox atomik commit/rollback davranışı korundu.
