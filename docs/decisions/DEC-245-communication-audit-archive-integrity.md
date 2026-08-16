# DEC-245 — İletişim audit ve arşiv bütünlüğü

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-H iletişim olaylarını içerikten ayrı, append-only `previousHash → eventHash` zincirinde tutar. Oda üyeliği, çağrı, dosya paylaşımı ve izin değişikliği yalnız kaynak kimliği, sürüm, fingerprint, aktör, cihaz ve zamanı taşır; mesaj/dosya/tutanak içeriği audit'e kopyalanamaz.

Kasa, veritabanı, yedek, yerel replica ve restore manifestleri immutable checkpoint olarak modellenir. Remote replication ve dış yedek doğrulaması otomatik olarak doğru sayılmaz.

Üretim masaüstü read zinciri merkezi PEP üzerinden exact aile/hesap/kişi/sahip receipt'iyle çalışır. Repository operation satırı writable fence ve journal projection bulunan aynı receipt'e bağlanır; SQLite zincir başı, sıra, owner ve immutable ledger koşullarını ayrıca doğrular. Renderer yalnız olay türü, kaynak sınıfı, sürüm, sıra ve zamanı; checkpoint tarafında yalnız nesil ve yerel doğrulama bayraklarını alır. Kişi, cihaz, kaynak kimliği, fingerprint, event hash ve manifest hash yüzeye çıkmaz. Renderer'a audit/checkpoint yazma kanalı verilmez.

Migration 112 checksum'u `38cdcc1b46af899ff286072b15edc0449ce36a150fe00a8b36aef0210fffc8c0`; yerel hedef matris 5 dosya/10 testtir. Üretim event producer kancaları, gerçek restore/replication tatbikatı ve bağımsız dış yedek kanıtı yoktur; `countsAsRequirementPass=false` kalır.
