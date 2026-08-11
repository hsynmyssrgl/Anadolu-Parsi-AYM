# Build 124 Teslim Doğrulama Raporu

Gerçekten çalıştırılan kontroller:

- Resmî registry ile temiz `npm ci`: **PASS — 312 paket**
- Tam root TypeScript: **PASS**
- Birim/entegrasyon testleri: **PASS — 8 dosya, 59 test**
- Electron main, preload ve renderer production build: **PASS**
- Bronze blocking smoke zinciri: **PASS**
- Build 124 ürün ve özellik sözleşmesi: **PASS — 41 assertion**
- Tarayıcıda gerçek render ve etkileşim: **PASS — 3 senaryo**
- Production dependency audit: **PASS — 0 bulgu**
- Build-tool dependency audit: **PASS — 0 bulgu**
- NSIS installer üretimi: **PASS**
- Paketli resmî açılış: **FAIL — yönetilen host GPU alt süreç hatası**

Installer SHA-256:

`39639dbe7ddb06260f9b672814aec020217b85c08c3fa22f7f190f2fe2a51834`

Kod imzası: **NotSigned**

Teslim Bronze RC2 Active Development olarak kalır. Sonraki geliştirme noktası
Build 125’tir.
