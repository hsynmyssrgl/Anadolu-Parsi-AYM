# Build 134 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.134`
- Package Version: `27.7.2026-134`
- Stage: **Bronze RC2 Active Development**
- Build: **134**

## Hedefli kontroller

- Build 134 sözleşmesi: **PASS — 64/64**
- Build 134 runtime: **PASS — 19/19**
- Kontrollü accessibility helper TypeScript: **PASS**
- Kontrollü package-source TypeScript: **PASS**
- Kontrollü desktop-main TypeScript: **PASS**

## Resmî ağır kapılar

- Clean `npm ci`: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Rendered accessibility / screen-reader UAT: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 23/23**
- Kaynak bütünlüğü: **PASS — 1.089 kaynak / 1.090 SHA girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.091 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 21 kanıt / 8 kapı**

Ayrık teslim tasdiki kaynak ZIP üretildikten sonra dış dosya olarak oluşturulur.
