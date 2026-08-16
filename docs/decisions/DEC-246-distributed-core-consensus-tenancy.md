# DEC-246 — Dağıtık Core Service consensus ve tenancy temeli

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-I mevcut headless Core Service'i cluster sözleşmeleriyle genişletir. Özel consensus algoritması yazılmaz; olgun Raft sağlayıcısı zorunlu porttur. Sağlayıcı yoksa quorum commit ve snapshot bootstrap fail-closed olur. Üretim sağlayıcısı doğrulanmadıkça sentetik sağlayıcı yalnız açık test bayrağıyla çalışabilir. Lider term/fencing token, quorum kaybı, policy version, revocation epoch, key epoch, clusterId/familyId tenancy ve entityVersion her yazıda doğrulanır.

SQLite projection yolu yalnız canonical mutlak Windows yolu ve ağ-paylaşımı biçimlerinin reddi bakımından sözlüksel olarak doğrulanır; gerçek volume kimliği bu aşamada kanıtlanmış değildir. Append-only mutation envelope global sequence, actor, device, schema, hash, durable idempotency fingerprint'i, provider evidence ve projection hash bağlarını taşır. Persist katmanı quorum commit kaydı ile yerel projection uygulamasını tek atomik işlem olarak sunmak zorundadır. Provider commit sonrası yerel uygulama başarısız olursa karar consensus commit'i inkâr etmez; yerel uygulamayı başarısız bildirip safe mode'a girer.

Migration 113 üç STRICT tablo, immutable mutation/snapshot kayıtları, active leader/fence/policy/epoch eşliği, monotonik sequence/entity version/commit index ve node state geçişleriyle fail-closed kalır. Bilinmeyen kaynak türleri varsayılan olarak `strong` tutarlılığa gider. Otomatik failover yalnız topoloji uygunluğu değil, yapılandırılmış üretim sağlayıcısı, sağlıklı quorum ve gerçek çok-node doğrulaması birlikte varsa kullanılabilir sayılır.

Migration 113 ve sentetik test-double kanıtı gerçek Raft, Windows Service Host, mTLS sertifikası, çok node, partition, failover veya bootstrap UAT değildir. Üretim runtime composition'ı yoktur; mevcut uygulama ağ kullanmaz. `productionConsensusVerified=false`, `countsAsRequirementPass=false` kalır.
