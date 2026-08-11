# Build 152 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.152`
- Package Version: `29.7.2026-152`
- Stage: **Bronze RC2 Active Development**

## Tek ana konu

Çevrimdışı npm cache paketinin fail-closed kabulü, karantinası ve atomik cache
aktarımı.

## Hedefli sonuçlar

- Cache bundle acceptance contract: **PASS — 26/26**
- Gerçek offline `npm ci` fixture: **PASS**
- Checksum/lockfile/sürüm/tarball bütünlüğü: **PASS**
- İdempotent kabul ve makbuz bütünlüğü: **PASS**
- Red karantinası: **PASS**
- Renderer/preload/main değişikliği: **YOK**

## Geniş kapılar

- Source preflight gate: **PASS** — 71/71
- Source integrity: **PASS** — manifest 1.273 / kaynak 1.273 / SHA256SUMS 1.274
- Clean install gate: **NOT_RUN — gerçek 117 tarball paketi henüz sağlanmadı**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

- Validation boundary: **INCOMPLETE — 2 PASS / 0 FAIL / 6 NOT_RUN**

Çalıştırılmayan kapılar PASS olarak raporlanmamıştır.
