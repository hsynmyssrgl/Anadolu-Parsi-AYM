# Build 123 Teslim Doğrulama Raporu

Gerçekten çalıştırılan kontroller:

- Tam root TypeScript: **PASS**
- Birim/entegrasyon testleri: **PASS — 8 dosya, 59 test**
- Electron main, preload ve renderer production build: **PASS**
- Bronze blocking smoke zinciri: **PASS**
- Build 123 UI shell: **PASS — 45 assertion**
- Build 123 mimari sözleşmesi: **PASS — 22 assertion**
- IPC sender/kapanış regresyonu: **PASS — 45 assertion**
- Tarayıcıda gerçek render ve etkileşim: **PASS — 4 senaryo**
- Temiz `npm ci`: **PASS — 312 paket**
- Windows NSIS üretimi: **PASS**
- Paketli resmi açılış: **FAIL — yönetilen host GPU alt süreç hatası**

Installer SHA-256:

`7d29c33bc16837cf17032609e23cbe71bf46ff15af6b3c94efe4498e507cab9a`

Kod imzası: **NotSigned**

Teslim Bronze RC2 Active Development olarak kalır. Sonraki geliştirme noktası
Build 124’tür.
