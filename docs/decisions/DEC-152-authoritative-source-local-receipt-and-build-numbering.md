# DEC-152 - Tek yetkili kaynak, yerel receipt ve Build numaralandirmasi

## Durum

ACTIVE - 2026-08-09 tarihli acik kullanici talimati.

## Karar

AYM icindeki tek duzenlenebilir ve yetkili kod kaynagi `06_KOD/app` dizinidir. Arsiv, siniflandirilmis kopya, checkpoint ZIP'i ve yedekler calisma kaynagi degildir; yalniz kanit ve geri donus amaciyla salt-okunur kabul edilir.

Aktif kaynak her koruma aninda sirali dosya listesi, dosya boyutu ve SHA-256 ile yerel kalici receipt'e baglanir. Ayni agac deterministik ZIP olarak `10_YEDEK` altinda saklanir ve geri okuma ile hash dogrulamasi yapilir. Yerel receipt `LOCAL_RECEIPT_VERIFIED` olabilir, ancak harici Library otoritesinin yerine gecmez ve 30-Z icin resmi tamamlanma iddiasi uretmez.

PR ve DEC kimlikleri Build numarasi degildir. Tarihsel checkpoint ve Build kimlikleri yeniden kullanilmaz veya geriye donuk degistirilmez. Yeni Build numarasi yalniz guncel zorunlu kapilar PASS oldugunda, acik kapsam durumu dogru raporlandiginda, kaynak manifestosu ve receipt kaniti bulundugunda verilebilir.

Build 228 tarihsel ve kapanmistir. Bronze 04.08.2026.29 aktif gelistirme surumudur. 30-Z guncel calisma adimidir ve harici persistent receipt bekledigi icin resmi olarak tamamlanmis degildir.

## Sinirlar

- Bu karar DEC-064'u yeniden kurmaz veya onun yerine gecmez.
- Arsivden aktif kaynaga otomatik ve denetimsiz kod karistirilamaz.
- NOT_RUN, BLOCKED, PARTIAL veya yerel receipt resmi PASS sayilamaz.
- Yeni Build numarasi eksik isi gizlemek icin kullanilamaz.

## Uygulama

- `config/bronze-current-audit-policy.json`
- `scripts/audit-bronze-current-state.mjs`
- `scripts/protect-authoritative-source.mjs`
- `scripts/apply-dec152-governance-tooling.mjs`
- `scripts/update-aym-governance-incrementally.mjs`
- `scripts/verify-aym-governance-incremental-contract.mjs`
- `docs/audit/BRONZE_CURRENT_COMPLETION_AUDIT.md`
- `00_PROJE/ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json`
- `05_TEST/30Z_LOCAL_RECEIPT`
- `10_YEDEK/AYM_AKTIF_KOD_<tree-hash>.zip`

## Izlenebilirlik

- Kurallar: `PR-092`, `PR-094`, `PR-095`, `PR-208`
- Gereksinimler: `GOV-003`, `B9-03`
- Test: `scripts/verify-aym-governance-incremental-contract.mjs`
- Kanit: `00_PROJE/ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json`

Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.
