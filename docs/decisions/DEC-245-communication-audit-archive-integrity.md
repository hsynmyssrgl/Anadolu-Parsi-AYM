# DEC-245 — İletişim audit ve arşiv bütünlüğü

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-H iletişim olaylarını içerikten ayrı, append-only `previousHash → eventHash` zincirinde tutar. Oda üyeliği, çağrı, dosya paylaşımı ve izin değişikliği yalnız kaynak kimliği, sürüm, fingerprint, aktör, cihaz ve zamanı taşır; mesaj/dosya/tutanak içeriği audit'e kopyalanamaz.

Kasa, veritabanı, yedek, yerel replica ve restore manifestleri immutable checkpoint olarak modellenir. Remote replication ve dış yedek doğrulaması otomatik olarak doğru sayılmaz. Migration 112 ve yerel testler geçse de production query/API bileşimi ile gerçek restore/replication tatbikatı yoktur; `countsAsRequirementPass=false` kalır.
