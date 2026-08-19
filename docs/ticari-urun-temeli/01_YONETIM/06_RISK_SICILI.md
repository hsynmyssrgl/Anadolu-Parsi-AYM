# Risk Sicili

## Puanlama

- Olasilik: 1 dusuk, 5 cok yuksek.
- Etki: 1 sinirli, 5 kritik.
- Risk puani: olasilik x etki.
- 15-25: KRITIK/YUKSEK; yayin engeller.
- 8-14: ORTA; sahibi ve kapanis tarihi zorunludur.
- 1-7: DUSUK; izlenir.

| ID | Risk | Olasilik | Etki | Puan | Durum | Azaltma | Bagli is |
|---|---|---:|---:|---:|---|---|---|
| RISK-001 | Kirli calisma agacinda ilgisiz degisikligin teslim edilmesi | 4 | 5 | 20 | ACIK | Kapsam bazli diff, teslim dalı, iki asamali review | IS-0002 |
| RISK-002 | Imzasiz Windows binarysinin guvenilir yayin sayilmasi | 5 | 5 | 25 | BLOCKED_EXTERNAL | Uretim sertifikasi, provenance ve Authenticode gate | IS-0305 |
| RISK-003 | Kullanici verisinin update/uninstall sirasinda kaybi | 3 | 5 | 15 | ACIK | N-1 migration, backup/readback, rollback ve destructive receipt | IS-0205, IS-0206 |
| RISK-004 | Lisans veya veri kosulu belirsiz bilesenin ticari pakete girmesi | 3 | 5 | 15 | ACIK | SBOM, lisans allowlist, provenance ve NOTICE | IS-0602 |
| RISK-005 | AI/OCR girdisinin dis aga veya yetkisiz isleme kacmasi | 2 | 5 | 10 | ACIK | Loopback-only, deny egress, consent ve source policy | IS-0402, IS-0404 |
| RISK-006 | OCR child processinin dusuk yetkili sandbox olmamasi | 4 | 4 | 16 | ACIK | AppContainer/low integrity veya kabul edilmis alternatif | IS-0406 |
| RISK-007 | OCR calisirken cancel isteginin transaction kilidine takilmasi | 5 | 4 | 20 | ACIK | Iki fazli run veya ayri preauthorized cancellation control | IS-0407 |
| RISK-008 | Kaynak dosya silindikten sonra turetilmis verinin crash nedeniyle kalmasi | 3 | 5 | 15 | ACIK | Durable resume journal ve idempotent propagation | IS-0506 |
| RISK-009 | Bulut yedeginin eksik veya yanlis hesaba gitmesi | 3 | 5 | 15 | BLOCKED_EXTERNAL | OAuth minimum scope, owner binding, upload/readback/delete kaniti | IS-0502, IS-0503 |
| RISK-010 | Tam English olmayan urunun global yayinlanmasi | 4 | 3 | 12 | ACIK | Locale coverage gate ve insan dil incelemesi | IS-0106, IS-0706 |
| RISK-011 | Tema renginin surum kanaliyla uyusmamasi | 3 | 3 | 9 | ACIK | Merkezi token, channel contract ve screenshot testi | IS-0102 |
| RISK-012 | Gercek cihaz testi olmadan passkey/Windows Hello iddiasi | 4 | 4 | 16 | NOT_RUN | Desteklenen cihaz matrisi ve fiziksel UAT | IS-0304 |
| RISK-013 | Hukuk/vergi/gizlilik incelemesi olmadan ticari yayin | 4 | 5 | 20 | BLOCKED_EXTERNAL | Yetkili uzman onayi ve ulkeye gore belge seti | IS-0701, IS-0703, IS-0704 |
| RISK-014 | Yedek silme ve fabrika ayari iddiasinin dis hedeflerde gerceklesmemesi | 3 | 5 | 15 | ACIK | Hedef bazli silme receipt, pending truth ve retry | IS-0207, IS-0506 |
| RISK-015 | Ucuncu taraf binary/model guncellemesinde supply-chain degisikligi | 3 | 5 | 15 | ACIK | Exact surum/hash, imza, kaynak ve yeniden lisans incelemesi | IS-0602, IS-0603 |
| RISK-016 | Ticari belge kokunun Git ve uzak yedek disinda kalmasi | 4 | 4 | 16 | ACIK | Kapsamli depo karari, sifreli uzak yedek, commit ve tag kaniti | IS-0003 |

## Kapanis kurali

Risk ancak bagli isin kabul kaniti PASS oldugunda kapanir. Risk puaninin dusurulmesi kod veya kanit yerine gecmez. `BLOCKED_EXTERNAL` kayitlar yerel gelistirmeyi durdurmaz; ilgili ticari yayin iddiasini durdurur.
