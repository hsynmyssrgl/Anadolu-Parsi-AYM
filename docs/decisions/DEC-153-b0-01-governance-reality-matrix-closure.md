# DEC-153 - B0-01 tek yonetisim ve ozellik gercekligi matrisi kapanisi

## Durum

ACTIVE - 2026-08-09 tarihli kullanici talimatinin DEC-137 sirasinda uygulanmasi.

## Secim

DEC-137 uyarinca baslanmis isler yeni islerden once ele alinir. En ileri baslanmis P0 gereksinimi B2-01'dir; ancak gercek Windows Hello etkileşim testi uyumlu cihaz/oturum bulunmadigi icin `NOT_RUN_NOT_PASS` durumundadir ve COMPLETE sayilamaz.

Yerel olarak kapanabilir sonraki baslanmis P0 dilim B0-01'dir. Tek yetkili kapsam `config/accepted-scope-registry.json`, aktif kullanici kararlari `config/user-decision-ledger.json`, kok karar sicili `01_YONETIM/KARAR_SICILI.json` ve ozellik gercekligi `scripts/verify-feature-reality-gate.mjs` ile `scripts/audit-bronze-current-state.mjs` uzerinden birlikte dogrulanir.

## Karar

B0-01 yalniz asagidaki kosullar birlikte saglandiginda COMPLETE olur:

- tek yetkili kaynak `06_KOD/app` olarak sabittir;
- 350 gereksinimlik kabul edilmis kapsam tek sicilden okunur;
- DEC-153 aktif kullanici karar siciline baglidir;
- FEATURE_REALITY_GATE mevcut kapsam durumlarini makineyle dogrular;
- guncel Bronze denetimi ayni gereksinim sayilarini ve ayri ilerleme oranlarini raporlar;
- root karar/kapsam kayitlari artimli guncelleme ve salt-okunur sozlesme testiyle baglanir;
- B2-01 dis ortama bagli kanit eksigi `NOT_RUN_NOT_PASS` olarak acik kalir.

Bu karar 30-Z harici receipt durumunu degistirmez, resmî 30-Z tamamlanma iddiasi uretmez ve yeni Build numarasi vermez.

## Izlenebilirlik

- Gereksinim: `B0-01`
- Oncelik karari: `DEC-137`
- Kaynak/receipt karari: `DEC-152`
- Kurallar: `PR-087`, `PR-098`, `PR-101`, `PR-124`, `PR-187`, `PR-194`, `PR-203`
- Kod: `scripts/verify-bronze-governance-reality-matrix.mjs`
- Test: `scripts/verify-bronze-governance-reality-matrix.mjs`
- Kanit: `artifacts/validation/bronze-governance-reality-matrix.json`
- Kok baglama testi: `scripts/verify-aym-governance-incremental-contract.mjs`

Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.
