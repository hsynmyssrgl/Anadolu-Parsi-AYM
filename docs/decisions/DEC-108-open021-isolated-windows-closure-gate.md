# DEC-108 — OPEN-021 gerçek Windows kapanışı ayrı ve dar bir kapıdır

**Build:** 217  
**Sürüm:** 01.08.2026.217  
**Durum:** Kabul edildi

OPEN-021, Silver doğrulama zinciri veya OPEN-022 kapanışıyla gereksiz biçimde birleştirilmeyecektir. Resmî kapanış için yalnız exact Build217 kaynak bütünlüğü, gerçek Windows development çalıştırması, Windows EFS ile korunan kısa ömürlü SQLite staging/snapshot, paketli Electron/installer çalıştırması ve aynı EFS kanıtının kurulu uygulamada PASS olması zorunludur.

`npm ci` yalnız Windows çalıştırmasının dependency bootstrap önkoşuludur; tek başına OPEN-002'yi kapatmaz. OPEN-022'nin DPAPI/Protected Side Artifact kapanışı bu karar ile değiştirilmez.

Bağlayıcı uygulama: ADR-091, `docs/security/OPEN021_WINDOWS_CLOSURE_BUILD217.md`, `OPEN021_WINDOWS_KAPAT.cmd`.

