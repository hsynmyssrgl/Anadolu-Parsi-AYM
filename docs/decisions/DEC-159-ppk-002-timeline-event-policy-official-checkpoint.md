# DEC-159 — PPK-002 timeline-event Policy Enforcement resmî checkpoint seçimi

## Durum

ACTIVE — 31-A resmî çalışma seçimi.

## Seçim

30-Z, DEC-158 ile D: harici USB Library üzerinde kalıcı makbuz ve geri-okuma zinciriyle `COMPLETED/PASS` olmuştur. DEC-137’nin bağlayıcı sırası yeniden uygulanmış; başlanmış, P0 ve `PARTIAL` durumdaki PPK-002 zincirinin ilk doğrulanabilir açık sınırı olan timeline-event Policy Enforcement, 31-A olarak seçilmiştir.

DEC-156 altında yerel devam olarak uygulanmış kod yeniden yazılmayacaktır. 31-A bu kodu taze runtime, statik sözleşme, tam regresyon ve kalıcı harici makbuz zinciriyle resmî checkpoint’e dönüştürür.

## Dar kapsam

- Migration 67 ve `governed_timeline_events` projection.
- Exact `event` policy intent ile create/read/update/archive/participant/invitation/notes işlemleri.
- `PolicyAuthorizedRepositoryExecutionContext`, durable receipt ve SQLite direct-write fence.
- Konum referansında ayrı exact `location.read` receipt.
- Audit/outbox receipt bağlama ve çapraz yüzey okuyucularının governed projection kullanımı.
- Receiptless/ownerless tarihsel satırların silinmeden karantinada tutulması.

## Kapsam dışı

- DEC-157 aile veri aktarımı merkezi yetkilendirme diliminin resmî kapanışı.
- Multi-receipt import batch’i ve governed deletion/claim/repair iş akışları.
- Evrensel repository enforcement ve obligation execution.
- Haricî monoton rollback otoritesi, secure file deletion atomikliği ve installed Core Service/SCM.

PPK-002 `PARTIAL` kalır. Yeni Build verilmez. 31-A yalnız kendi hedefi, testleri ve D: Library makbuzu PASS olduğunda tamamlanır.
