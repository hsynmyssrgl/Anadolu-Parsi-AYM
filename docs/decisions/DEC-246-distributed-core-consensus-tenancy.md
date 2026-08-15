# DEC-246 — Dağıtık Core Service consensus ve tenancy temeli

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-I mevcut headless Core Service'i cluster sözleşmeleriyle genişletir. Özel consensus algoritması yazılmaz; olgun Raft sağlayıcısı zorunlu porttur. Sağlayıcı yoksa quorum commit ve snapshot bootstrap fail-closed olur. Lider term/fencing token, quorum kaybı, policy version, revocation epoch, key epoch, clusterId/familyId tenancy ve entityVersion her yazıda doğrulanır.

SQLite projection yalnız mutlak yerel Windows yolunda açılabilir; ağ paylaşımı reddedilir. Append-only mutation envelope global sequence, actor, device, schema, hash ve idempotency taşır. Tek node otomatik failover sunmaz; Apple istemcileri voter değildir.

Migration 113 ve sentetik test-double kanıtı gerçek Raft, Windows Service Host, mTLS sertifikası, çok node, partition veya bootstrap UAT değildir. `productionConsensusVerified=false`, `countsAsRequirementPass=false` kalır.
