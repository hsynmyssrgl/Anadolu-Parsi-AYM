# DEC-155 - GOV-005 harici Library engel siniflandirmasi

## Durum

ACTIVE - 2026-08-09 tarihli acik kullanici dogruluk sinirinin uygulanmasi.

## Karar

GOV-005, aktif teslimin zorunlu kalici Library dalina gercek yuklenmesi ve harici receipt kaniti olmadan COMPLETE sayilamaz. `LOCAL_RECEIPT_VERIFIED`, yerel kaynak butunlugunu kanitlar ancak harici Library otoritesinin yerine gecmez.

Bu nedenle GOV-005 `PARTIAL` kalir ve `PENDING_EXTERNAL_AUTHORITY` completion blocker ile izlenir. DEC-137 otomatik siralamasinda engel kaldirilana kadar sonraki yerel olarak eyleme uygun PARTIAL/FOUNDATION_STARTED P0 dilime gecilir. Harici receipt geldiginde GOV-005 yeniden dogrulanir; yerel kanit sessizce PASS'e cevrilmez.

Bu karar 30-Z'yi resmî tamamlanmis ilan etmez ve yeni Build numarasi vermez.

## Izlenebilirlik

- Gereksinim: `GOV-005`
- Oncelik: `DEC-137`
- Kaynak ve receipt siniri: `DEC-152`
- Kurallar: `PR-087`, `PR-180`, `PR-181`, `PR-194`, `PR-203`, `PR-208`
- Kod: `scripts/apply-gov005-external-blocker.mjs`
- Kanit: `05_TEST/30Z_LOCAL_RECEIPT/LATEST.json`
- Politika: `config/persistent-artifact-policy.json`
- Rapor: `artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json`

Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.
