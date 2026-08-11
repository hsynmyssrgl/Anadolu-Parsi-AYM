# DEC-154 - GOV-004 guncel teslim raporu kapanisi

## Durum

ACTIVE - 2026-08-09 tarihli kullanici talimatinin DEC-137 sirasinda uygulanmasi.

## Karar

GOV-004, aktif `Bronze 04.08.2026.29` tesliminin yuzde, kalan kapsam, ETA durumu, Silver/Gold siniri, sohbet kapasitesi, devir promptu, dogrulama sonucu, kaynak receipt/yedek, manifest, Library ve siradaki is alanlarini tek makine okunur raporda toplar.

Platform actual sohbet kapasitesi saglanmiyorsa `UNAVAILABLE` yazilir ve tahmin uretilmez. Yeterli yonetilen hiz serisi yoksa Bronze ETA kesin tarih olarak uydurulmaz; dusuk guvenli `UNAVAILABLE_INSUFFICIENT_GOVERNED_VELOCITY_SERIES` durumu kullanilir. Silver ve Gold acik kapsam nedeniyle `BLOCKED_NOT_READY` kalir.

Kaynak raporu, kendisini ve sonraki postflight kanitlarini iceren nihai agac hashini kendi icinde dairesel olarak tasdik edemez. Bu nedenle rapor, uretim anindaki yerel receipt'i ve acik siniri bildirir; nihai kaynak agaci hash ve yedegi `05_TEST/30Z_LOCAL_RECEIPT/LATEST.json`, `00_PROJE/DURUM.json` ve son kullanici bildiriminde disaridan baglanir.

Bu karar harici 30-Z Library receipt'i PASS yapmaz, resmi 30-Z tamamlanma iddiasi uretmez ve yeni Build numarasi vermez.

## Izlenebilirlik

- Gereksinim: `GOV-004`
- Oncelik: `DEC-137`
- Kaynak gercekligi: `DEC-152`
- Kurallar: `PR-087`, `PR-124`, `PR-179`, `PR-183`, `PR-184`, `PR-185`, `PR-187`, `PR-194`, `PR-200`, `PR-203`
- Kod: `scripts/generate-current-delivery-report.mjs`
- Test: `scripts/verify-delivery-report-contract-v2.mjs`
- Postflight: `scripts/run-governed-postflight.mjs`
- Kanit: `artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json`
- Test kaniti: `artifacts/validation/delivery-report-contract-v2.json`
- Postflight kaniti: `artifacts/validation/governed-postflight.json`

Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.
