# 34-H Tehdit Modeli

- Audit'e içerik enjeksiyonu tip ve şema sınırında yasaktır.
- Event sırası, previous hash veya fingerprint değişimi zincir doğrulamasını bozar.
- Audit ve checkpoint update/delete trigger ile engellenir.
- Restore sonucu backup kanıtı olmadan `verified` olamaz.
- Local replica kanıtı remote replication veya offsite backup iddiasına yükseltilemez.

Residual risk: gerçek restore tatbikatı, remote replication, bağımsız dış yedek doğrulaması ve production API/UI query bileşimi `NOT_RUN` durumundadır.
