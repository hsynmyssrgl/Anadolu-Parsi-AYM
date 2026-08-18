# Kullanıcı Kararları Kaydı

- Görünür sürüm: **Bronze 04.08.2026.29**
- Makine okunur defter: `config/user-decision-ledger.json`
- Aktif karar sayısı: **82**

Bu kayıt, konuşmanın kelimesi kelimesine kopyası olduğunu iddia etmez. Bağlayıcı kullanıcı kararlarını karar düzeyinde, etkilediği kural/belge/kod alanlarıyla saklar. Ham konuşma erişimi olmadan “tam transcript” iddiası yapılmaz.

## Bu sürümde kaydedilen kararlar

- `DEC-121` — Accepted scope, monthly release and channel gates
- `DEC-122` — Platform Policy Kernel and Core Service foundation
- `DEC-123` — All proposed family capabilities accepted as binding Bronze scope
- `DEC-124` — Exceptionless canonical rule lock and automatic fail-closed gates
- `DEC-125` — Persistent Library hierarchy is mandatory for every delivery
- `DEC-126` — Every delivery reports progress, ETA, Silver/Gold, conversation status and handoff state
- `DEC-127` — All documents and artifacts must be exhaustively indexed and listed
- `DEC-128` — Completed releases are immutable; new work continues in monthly next sequence
- `DEC-129` — Tüm aktif kurallar aşılamaz yürütme çekirdeğine bağlanır
- `DEC-137` — Incomplete Bronze backlog full-auto prioritization and cancellation of the user-specific 95 percent stop
- `DEC-152` — Single authoritative source, local persistent receipt and gated Build numbering
- `DEC-153` — B0-01 single governance and feature-reality matrix closure
- `DEC-154` — GOV-004 current delivery report closure
- `DEC-155` — GOV-005 external Library blocker classification
- `DEC-156` — PPK-002 timeline-event policy enforcement local continuation
- `DEC-162` — Windows Hello hardware validation temporary non-blocking deferral
- `DEC-163` — PPK-002 family import reused-location exact read receipt chain
- `DEC-164` — GOV-005 external USB authoritative source protection closure
- `DEC-165` — B0-02 user-visible release metadata boundary
- `DEC-166` — PPK-002 family import newly-created-location linked event atomic policy chain
- `DEC-167` — PPK-002 family import governed rollback exact delete receipt fence
- `DEC-168` — Main structure first: Core Service typed API and ownership foundation
- `DEC-169` — Core Service protected family-data session ownership control plane
- `DEC-170` — Headless shared device-secret protection boundary
- `DEC-171` — Family-data coexistence and default-deny cutover gate
- `DEC-172` — Monotonic cutover-readiness evidence and tamper-evident acceptance state
- `DEC-173` — Protected cutover-readiness journal port and detached default-deny boundary
- `DEC-174` — Signed cutover-readiness evidence verifier public-key-only boundary
- `DEC-175` — Synthetic single-writer proof harness detached non-authoritative boundary
- `DEC-176` — Synthetic key lifecycle proof harness detached non-submittable boundary
- `DEC-177` — Synthetic rollback and recovery drill detached non-submittable boundary
- `DEC-178` — End-to-end security evidence aggregator detached non-submittable boundary
- `DEC-179` — Explicit user approval receipt detached no-cutover boundary
- `DEC-180` — Versioned cutover decision preflight detached no-authority boundary
- `DEC-181` — PPK-002 family import governed rollback exact delete receipt fence
- `DEC-182` — PPK-002 remaining technical boundaries
- `DEC-183` — PPK-002 universal enforcement top closure
- `DEC-184` — PPK-003 bounded default-deny policy decision availability top closure
- `DEC-185` — PPK-004 complete user-to-operation policy context binding top closure
- `DEC-186` — PPK-005 complete data classification top closure
- `DEC-187` — PPK-006 complete policy obligation suite top closure
- `DEC-188` — PPK-007 signed, versioned and SHA-256-bound policy package top closure
- `DEC-189` — PPK-008 unique application identity, trusted-device certificate and capability manifest top closure
- `DEC-190` — PPK-009 Core Service policy decision re-evaluation top closure
- `DEC-191` — PPK-010 central policy and zero direct-role authorization exception top closure
- `DEC-192` — PPK-011 contextual authorization and ownership-share top closure
- `DEC-193` — PPK-012 finite offline capability lease and sensitive-cache fence top closure
- `DEC-194` — PPK-013 zero-exception client data-access boundary top closure
- `DEC-195` — PPK-014 zero-exception versioned Core Service client API boundary top closure
- `DEC-196` — PPK-015 zero-exception allowlisted TLS/mTLS network egress policy top closure
- `DEC-197` — PPK-016 fail-closed derived-data policy inheritance and immutable lineage metadata top closure
- `DEC-198` — PPK-017 fail-closed content-free sensitive logging and diagnostic boundary top closure
- `DEC-199`–`DEC-224` — PPK-018–PPK-028 ve 32-X/33-A–33-M yerel yönetişim ve ürün paket kararları
- `DEC-250` — Güncel dokümantasyon yenilemesi ve tarihsel kayıtların korunması
- `DEC-251` — Karar anında eşzamanlı belge ve iş listesi güncellemesi; eksik senkronizasyon fail-closed
- `DEC-252` — Tarihsel kayıtların son temel sonrasında gelecek içerik denetimlerinden çıkarılması
- `DEC-253` — Animasyonlu kurulum ekranları, yenilenmiş üç adımlı anlatım ve Silver doğrulamasına hazırlanmış F1 sesli Yardım Merkezi

## Bundan sonraki kararlar için zorunlu eşzamanlılık kuralı

`DEC-251` ve `config/documentation-synchronization-policy.json` gereği her yeni bağlayıcı karar aynı değişiklikte DEC dosyasına, makine defterine, etkilenen aktif belgelere ve iş listesine işlenir. Açık kalan işlerde yerel durum, açık kalma nedeni, eksik kanıt ve `countsAsRequirementPass` alanları zorunludur. Bu zincir eksikse karar veya iş tamamlandı sayılamaz.

`DEC-252` gereği bu yenilemedeki kapsamlı tarihsel tarama son temeldir. Bundan sonra eski build, arşiv ve checkpoint belgelerinin içeriği yeniden denetlenmez veya güncel karar kaynağı sayılmaz; yalnız değişmez `HISTORICAL` kayıt olarak korunur. Yeni denetimler aktif ve yeni belgelere uygulanır.

Makine defteri yalnız açık kullanıcı kararlarını tutar. Türetilmiş paket/mimari kararlarının eksiksiz DEC-090–DEC-252 dizini ve dosya yolları `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md` içindedir.
