# DEC-149 — PPK-002 sağlık politika enforcement dikey dilimi

## Karar

30-X, altı üretim sağlık IPC işlemini ve altı sağlık repository işlemini merkezî Platform Policy Enforcement Point sınırına alır. Sağlık yazmaları yalnız güvenilir özne, cihaz, aile, kişi, korelasyon, kaynak, gizlilik, amaç ve capability bağları doğrulanmış bir politika transaction bağlamıyla çalışabilir; iş verisi, audit, outbox ve tam politika receipt bağı aynı SQLite transaction içinde korunur.

`health_records`, `medication_plans` ve `family_health_history` tablolarındaki korunan yazmalar, eşleşen kalıcı receipt olmadan repository dışı doğrudan SQL ile gerçekleştirilemez. Sağlık verisinin otomasyon ve raporlama yüzeylerine aktarımı governed veya kişisel içeriği açığa çıkarmayan bir projection üzerinden yapılır. Eksik üretim PEP bileşimi, sahte veya süresi geçmiş bağlam, subject/family/person/resource/action/capability uyuşmazlığı ve receipt bağı olmayan yazma fail-closed reddedilir.

## Kapsam sınırı

Bu karar yalnız sağlık dikey dilimini hedefler. Diğer API/use-case/repository yüzeylerinin evrensel enforcement kapsamı `NOT_COMPLETE`; haricî monoton otorite `NOT_IMPLEMENTED`; obligation execution ve kurulu Core Service/SCM kanıtı `NOT_RUN_NOT_PASS` kalır. PPK-002 `PARTIAL`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
