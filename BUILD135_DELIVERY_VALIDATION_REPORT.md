# Build 135 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.135`
- Package Version: `28.7.2026-135`
- Stage: **Bronze RC2 Active Development**
- Build: **135**

## Hedefli kontroller

- Build 135 sözleşmesi: **PASS — 52/52**
- Build 135 runtime: **PASS — 21/21**
- Kontrollü package-source TypeScript: **PASS**
- Kontrollü desktop-main TypeScript: **PASS**

## Resmî ağır kapılar

- Clean `npm ci`: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Gerçek Windows DPAPI kasa anahtarı migration/restore: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 25/25**
- Kaynak bütünlüğü: **PASS — 1.097/1.097 kaynak dosyası; 1.098 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.099 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 23 kanıt dosyası / 8 kapı iddiası**

Ayrık teslim tasdiki, doğrulanmış kaynak ZIP üretildikten sonra dış teslim dosyası olarak oluşturulur; bu rapor yalnız tasdik sözleşmesinin kaynak tarafındaki PASS sonucunu kaydeder.
