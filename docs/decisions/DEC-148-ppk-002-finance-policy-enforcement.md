# DEC-148 — PPK-002 finans politika enforcement dikey dilimi

## Karar

30-W, dört üretim finans IPC işlemini ve beş finans repository işlemini merkezî Platform Policy Enforcement Point sınırına alır. Finans yazmaları yalnız güvenilir özne, aile, korelasyon, kaynak ve capability bağları doğrulanmış bir politika transaction bağlamıyla çalışabilir; iş verisi, audit, outbox ve tam politika receipt bağı aynı SQLite transaction içinde korunur.

`finance_records` ve `finance_valuations` tablolarındaki korunan yazmalar, eşleşen kalıcı receipt olmadan repository dışı doğrudan SQL ile gerçekleştirilemez. Eksik üretim PEP bileşimi, sahte veya süresi geçmiş bağlam, resource/action/capability uyuşmazlığı ve receipt bağı olmayan yazma fail-closed reddedilir.

## Kapsam sınırı

Bu karar yalnız finans dikey dilimini hedefler. Diğer API/use-case/repository yüzeylerinin evrensel enforcement kapsamı `NOT_COMPLETE`; haricî monoton otorite `NOT_IMPLEMENTED`; obligation execution ve kurulu Core Service/SCM kanıtı `NOT_RUN_NOT_PASS` kalır. PPK-002 `PARTIAL`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
