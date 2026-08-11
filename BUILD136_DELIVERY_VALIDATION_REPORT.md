# Build 136 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.136`
- Package Version: `28.7.2026-136`
- Stage: **Bronze RC2 Active Development**
- Build: **136**

## Hedefli kontroller

- Build 136 sözleşmesi: **PASS — 70/70**
- Build 136 runtime: **PASS — 30/30**
- Renderer/bridge söz dizimi: **PASS — 3/3**
- Kontrollü package-source TypeScript: **PASS**
- Kontrollü desktop-main TypeScript: **PASS**

## Resmî ağır kapılar

- Clean `npm ci`: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Gerçek Windows/SSD güvenli silme ve yedek yayılım provası: **NOT_RUN**
- Render edilmiş yaşam döngüsü UAT ve ekran okuyucu testi: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 27/27**
- Kaynak bütünlüğü: **PASS — 1.108/1.108 kaynak dosyası; 1.109 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.110 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 26 kanıt dosyası / 8 kapı iddiası**

Ayrık teslim tasdiki, doğrulanmış kaynak ZIP üretildikten sonra dış teslim dosyası olarak oluşturulur.
