# Build 125 Teslim Doğrulama Raporu

Gerçekten çalıştırılan kontroller:

- Source preflight: **PASS — 13/13**
- Kaynak bütünlüğü: **PASS — 1010 kaynak / 1011 SHA-256 girdisi**
- Resmî registry ile temiz `npm ci`: **PASS — 312 paket**
- Tam root TypeScript: **PASS**
- Birim/entegrasyon testleri: **PASS — 8 dosya, 60 test**
- Electron production build: **PASS**
- Bronze blocking smoke zinciri: **PASS**
- Build 125 olay yaşam döngüsü: **PASS — 42 assertion**
- Tarayıcıda görünür arayüz ve etkileşim: **PASS — 3 senaryo**
- NSIS installer ön doğrulaması ve üretimi: **PASS**
- Development Windows açılış: **FAIL — GPU alt süreç `-1073741515`**
- Paketli Windows açılış: **FAIL — GPU alt süreç `-1073741515`**

Installer:

- Dosya: `Anadolu Parsı Aile Yaşam Merkezi-27.7.2026-125-x64.exe`
- Boyut: `108647574` byte
- SHA-256: `91285f1f5a3433cbe4adf6ac1841171c27c2676151e30ab446b30179740517a1`
- Authenticode: **NotSigned**

Teslim Bronze RC2 Active Development olarak kalır; sonraki geliştirme noktası
Build 126’dır. Windows açılış hatası çözülmeden Final ilan edilmez.
