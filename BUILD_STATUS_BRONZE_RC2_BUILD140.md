# Bronze RC2 Build 140 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.140`
- Package Version: `28.7.2026-140`
- Stage: **Bronze RC2 Active Development**
- Build: **140**

## Kapsam

Güvenilen Ed25519 sağlayıcı açık anahtarları, sabit kanonik imha makbuzu,
detached imza doğrulaması, replay/tarih/hukuki bekletme koruması ve sağlayıcı
güven iptalinin bağlı kanıtlara yayılması.

## Hedefli doğrulama

- Build 140 imzalı haricî yedek imha kanıtı sözleşmesi: **PASS — 130/130**
- Gerçek Ed25519 çalışma zamanı senaryoları: **PASS — 30/30**
- Renderer/preload/global söz dizimi: **PASS — 3/3 dosya**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Temiz `npm ci`, tam root typecheck, tüm testler, Electron production build, gerçek sağlayıcı/fiziksel imha ve installer: **NOT_RUN**

Build 140 Bronze RC2 Active Development içinde kalır; Final, Freeze, Silver veya Gold değildir.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 39/39**
- Kaynak bütünlüğü: **PASS — 1.158/1.158 kaynak dosyası; 1.159 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.160 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 37 kanıt / 8 kapı**
