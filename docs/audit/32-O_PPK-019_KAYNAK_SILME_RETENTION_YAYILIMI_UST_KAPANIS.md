# 32-O / PPK-019 kaynak silme ve retention yayılımı üst kapanışı

Durum: `COMPLETE / PASS`.

## Kapsam

PPK-019; kaynak kalıcı imhasının OCR metni, arama indeksi, thumbnail, AI hafızası, cache, replica ve yedek owner sınıflarına fail-closed yayılmasını kapsar. Yerel propagation kaynak siliminden önce tamamlanır; backup propagation ayrı, kanıtlı ve pending tombstone ile korunan asenkron fazdır.

## Uygulanan zincir

- Merkezi `SourceDeletionPropagationPolicy` ve `EnforceSourceDeletionPropagationUseCase`.
- Üç runtime cache sahibinin silme öncesi zorunlu temizlenmesi/kilitlenmesi.
- Runtime `sqlite_schema` owner taraması ve repository'de ikinci TOCTOU taraması.
- Plan hash/shape, lifecycle, legal-hold ve exact source doğrulaması.
- `secure_delete` ile source, object permission ve AI consent satırlarının aynı transactionda kaldırılması.
- Content-free outbox evidence ve `backup_propagation_pending=1` tombstone.
- Yönetilen hedeflerde fresh korumalı backup + SHA-256 + eski managed artefakt karantinası + unmanaged artefakt sıfırı sonrası exact pending kapanışı.
- Harici/yönetilmeyen kopyalarda attention ve signed evidence/attestation gerçeğinin korunması.
- Content-free, sıfır argümanlı, no-cache IPC/UI duruşu.
- Bütün üretim source zone'larında statik bypass kapısı.

## Final doğrulama

- PPK-019 hedefli test: `20/20 PASS`.
- Build136 data lifecycle runtime: `31/31 PASS`.
- Build137 backup purge propagation runtime: `37/37 PASS`.
- Statik propagation gate: `18 zone / 346 dosya / 32 ilgili dosya / 8 kötü niyetli / 4 benign / 0 bulgu PASS`.
- PPK-012–PPK-019 birleşik güvenlik regresyonu: `8/8 dosya / 202/202 test PASS`.
- Tam Vitest: `69/69 dosya / 610/610 test PASS`.
- Kök TypeScript: `0 hata`.
- Production constituent build: `18 workspace`, Core Service ve Electron main/preload/renderer PASS.
- DataStore smoke: `14/14`; migration runtime: `9/9`, latest migration `77` PASS.
- Foundation `14/14`; runtime foundation `6/6 PASS`.
- Platform Policy gate/runtime `8/8`; policy enforcement regresyonu `43/43`; Core Service boundary `8/8`; Core Service entrypoint `24/24 PASS`.
- Build162 IPC read sharing contract `49/49`, runtime `37/37`, syntax `4/4`; Build96 raw replica yasağı `8/8 PASS`.
- Build214 contract `25/25`, protected runtime `10/10`, integration runtime `10/10`; Build225 fatal startup contract `10/10` ve tamper runtime `3/3 PASS`.
- Lockfile `542 kontrol / 18 workspace`; supply `435 kontrol / 135 kanonik tarball`; workspace `516 kontrol / 18 workspace / döngüsüz`; karar defteri `293 kontrol / 54 karar PASS`.
- Final PPK-019 contract: `108/108 PASS`; runtime kanıt demeti: `15/15 PASS`. Öncesindeki ayrı aday koşu da `108/108` ve `15/15` PASS vererek açık durumun dürüstlüğünü doğrulamıştır.
- Bronze audit: `PASS_WITH_OPEN_SCOPE`; resmî `%25`, strict `%9,1429`, implementation-chain `%9,4`.

## Şema ve veri gerçeği

Yeni migration yoktur; latest migration 77 kalır. Mevcut migration 16/17/18/19 ve 29-49 temelleri yeniden kullanılır. Gerçek kullanıcı verisi taşınmamış, backfill/cutover yapılmamış, Desktop vault ve SQLite sahipliği değiştirilmemiştir. Korumalı whole-vault backup ayrı kriptografik sınırdır ve propagation kanıtının yerine geçmez.

## Kapanış kararı

Kanonik kapsam, envanter, registry ve DEC-200 aynı doğrulanmış durumda `COMPLETE` olarak kapanmıştır. Yönetilmeyen veya harici kopya fiziksel olarak silinmiş sayılmaz; quarantine destruction değildir. PPK-019 yalnız kaynak silme/retention yayılımını kapatır; PPK-020 ve sonraki Bronze kapsamı açık kalır. Kaynak koruması, Git commit'i ve D/GitHub eşleşmesi paket kapanış prosedüründe ayrıca doğrulanır.
