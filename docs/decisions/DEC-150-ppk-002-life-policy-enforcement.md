# DEC-150 — PPK-002 yaşam politika enforcement dikey dilimi

## Karar

30-Y, `life:list` ve `life:create` üretim IPC işlemleri ile `listLifeRecords` ve `insertLifeRecord` repository işlemlerini merkezî Platform Policy Enforcement Point sınırına alır. Okuma intent'i mevcut `family.read`, oluşturma intent'i mevcut `family.write` capability değerini kullanır. Her iki intent `resourceType=life_record`, `purpose=general` ve exact aile, sahip kişi, gizlilik, hassasiyet ve korelasyon bağlarına sahiptir.

Yeni `life.read` veya `life.write` capability değeri eklenmez. Platform capability union, PEP geçerli capability kümesi ve değişmez receipt CHECK sözleşmesi değiştirilmez. Yaşam verisi okumaları aile ve sahip kişi bağlamına SQL seviyesinde sınırlandırılır; yazmalar sabit `family-main` kimliği kullanamaz. İş verisi, audit, outbox ve tam politika receipt bağı aynı SQLite transaction içinde korunur.

`life_records` yazmaları eşleşen kalıcı receipt olmadan repository dışı doğrudan SQL ile gerçekleştirilemez. Otomasyonun yaşam kaydı okuması ve üretilmiş görev yazması ile raporların başlık/tarih içeren yaşam sorguları, governed ve gizliliği koruyan projection veya yaşam PEP sınırı üzerinden çalışır.

## Düzeltme ve kapsam sınırı

İlk seçim doğrulaması `19/19` semantik ve `5/5` süreç PASS olarak tarihsel kanıttır; yalnız yeni `life.read`/`life.write` capability kaydı öngören tasarım ayrıntısı bu düzeltmeyle supersede edilmiştir. İlk PASS, FAIL olarak yeniden sınıflandırılmamıştır.

Yaşam silme/purge işlemi `NOT_COMPLETE / GOVERNED_DELETION_WORKFLOW_REQUIRED`; dashboard ve data-lifecycle genel çapraz yüzeyleri ayrı governed çalışma yapılana kadar `NOT_COMPLETE`; konum ve timeline-event Policy Enforcement `NOT_COMPLETE`; evrensel repository enforcement `NOT_COMPLETE`; haricî monoton otorite `NOT_IMPLEMENTED`; obligation execution ve kurulu Core Service/SCM kanıtı `NOT_RUN_NOT_PASS` kalır. PPK-002 `PARTIAL`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
