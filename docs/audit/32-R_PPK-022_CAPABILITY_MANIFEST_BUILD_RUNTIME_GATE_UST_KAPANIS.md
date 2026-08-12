# 32-R / PPK-022 Capability manifest build/runtime kapısı üst kapanışı

Durum: `COMPLETE / PASS`.

## Kapsam

PPK-022; capability manifestte bulunmayan kamera, mikrofon, dosya, OCR, AI, konum ve ağ kullanımını build ve runtime katmanlarında default-deny reddeder. Uygulama kodu, signed Platform Policy package, Core Service startup, Desktop authenticated startup ve content-free durum IPC/UI zinciri birlikte kapsamdadır.

## Uygulanan zincir

- Yedi kaynak ailesi için gerçek TypeScript/JSX AST envanteri.
- 18 production source zone içinde 237 exact `kind|path|symbol` yüzeyi ve kanonik uygulama/capability eşlemesi.
- Yeni, stale, duplicate, wildcard, parse failure ve unresolved dynamic import için fail-closed gate; re-export, TypeScript import-equals, createRequire, destructuring, assignment, Reflect ve JSX file/capture kaçışlarının self-test kapsamı.
- On dört kanonik uygulamanın signed manifestinde exact `runtimeCapabilities` alanı ve manifest SHA-256 bağı.
- Yalnız deployed Windows Desktop/Core Service için `file.access` ve `network.access`; diğer on iki profil için boş runtime capability kümesi.
- Core Service package creation sonrası on dört uygulamada exact coverage; Desktop'ta authenticated health package coverage kontrolü.
- Pre-handshake Desktop file bootstrap ile authenticated yerel Core Service network bağlantısı için 24+2 exact pin; build manifestinin runtime authority olmadığına ilişkin açık sınır.
- Root pretypecheck/prebuild ve birleşik Platform Policy gate entegrasyonu.
- Content-free, sıfır argümanlı, no-cache IPC/preload/UI status yüzeyi.
- Migration 77'nin korunması; persistence, gerçek veri taşıma, backfill, cutover ve ownership değişikliği yokluğu.

## Final doğrulama

- Capability production gate: PPK-022 kapanışında `18 zone / 355 dosya`; PPK-025 ardıl kaynak ratchet'iyle güncel olarak `18 zone / 365 dosya / 237 capability surface / 237 exact manifest / 26 bootstrap pin (24 file + 2 local network) / 33 malicious / 5 benign / 0 bulgu PASS`.
- PPK-022 hedefli test: `3/3 dosya / 19/19 test PASS`.
- Seçili PPK-008/014/021/022 regresyonu: `8/8 dosya / 63/63 test PASS`.
- PPK-012–PPK-022 birleşik güvenlik regresyonu: `16/16 dosya / 264/264 test PASS`.
- Tam Vitest: `77/77 dosya / 672/672 test PASS`.
- Root pretypecheck: `10/10 güvenlik kapısı`; root ve Platform Policy/domain/application/Core Service/Electron main/renderer TypeScript: `0 hata`.
- Production constituent build: `18/18 workspace`; Core Service ve Electron main/preload/renderer PASS.
- DataStore smoke `14/14`; migration runtime `9/9`, latest migration `77` PASS.
- Foundation `14/14`; runtime foundation `6/6`; Platform Policy runtime `8/8`; policy enforcement `43/43`; Core Service boundary `8/8`; Core Service entrypoint `24/24 PASS`.
- Build162 IPC read sharing contract `49/49`, runtime `37/37`, syntax `4/4`; Build96 raw database export yasağı `8/8 PASS`.
- Build214 contract `25/25`, protected runtime `10/10`, integration runtime `10/10`; Build225 fatal startup contract `10/10`, tamper runtime `3/3 PASS`.
- Lockfile `542 kontrol / 18 workspace`; supply `436 kontrol / 135 kanonik tarball`; workspace `516 kontrol / 18 workspace / döngüsüz`; karar defteri `308 kontrol / 57 karar PASS`.
- Aday contract: `107/107 PASS`; aday runtime kanıt demeti: `23/23 PASS`.
- Final contract: `108/108 PASS`; runtime kanıt demeti: `24/24 PASS`.
- Bronze audit: `PASS_WITH_OPEN_SCOPE`; resmî `%25`, strict `%10`, implementation-chain `%10,2571`.

## Güvenlik gerçeği

Build manifesti veya exact AST entry runtime yetkisi vermez. Runtime yetkisi imzalı policy package, exact uygulama/sürüm/manifest hash'i ve authenticated startup otoritesi gerektirir. `file.access` veya `network.access`, veri erişimi ya da egress policy'sini atlamaz. PPK-012 lease/cache ve policy-sensitive IPC no-cache çitleri korunur.

## Kapanış kararı

Kanonik scope, inventory, exact surface manifesti, accepted registry ve DEC-203 aynı doğrulanmış durumda `COMPLETE` olarak kapanmıştır. PPK-022 yalnız capability manifest build/runtime kapısını tamamlar; PPK-023 ve sonraki Bronze kapsamı açık kalır. Kaynak koruması, Git commit'i ve D/GitHub eşleşmesi paket kapanış prosedüründe ayrıca doğrulanır.
