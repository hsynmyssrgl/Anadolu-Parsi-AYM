# 34-H Tehdit Modeli

- Audit'e içerik enjeksiyonu tip ve şema sınırında yasaktır.
- Event sırası, previous hash veya fingerprint değişimi zincir doğrulamasını bozar.
- Audit ve checkpoint update/delete trigger ile engellenir.
- Operation, event ve checkpoint yazımı exact owner-bound PEP receipt, writable fence ve journal projection ile bağlanır.
- Renderer read modeli kişi/cihaz/kaynak kimliği/hash/manifest içermez; audit veya checkpoint yazma kanalı yoktur.
- Restore sonucu backup kanıtı olmadan `verified` olamaz.
- Local replica kanıtı remote replication veya offsite backup iddiasına yükseltilemez.

Residual risk: üretim iletişim akışlarından audit event producer kancaları henüz bağlanmamıştır. Gerçek restore tatbikatı, remote replication ve bağımsız dış yedek doğrulaması `NOT_RUN` durumundadır. Yerel read API bu eksikleri kapatmış sayılmaz.
