# Build 133 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.133`
- Package Version: `27.7.2026-133`
- Stage: **Bronze RC2 Active Development**
- Build: **133**

## Hedefli kontroller

- Build 133 sözleşmesi: **PASS — 36/36**
- Build 133 runtime: **PASS — 24/24**
- Kontrollü kaynak TypeScript: **PASS**

## Resmî ağır kapılar

- Clean `npm ci`: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 21/21**
- Kaynak bütünlüğü: **PASS — 1.081 kaynak / 1.082 SHA girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.083 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 19 kanıt / 8 kapı**

Ayrık teslim tasdiki kaynak ZIP üretildikten sonra dış dosya olarak oluşturulur.
