# Bronze RC2 Build 141 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.141`
- Package Version: `28.7.2026-141`
- Stage: **Bronze RC2 Active Development**
- Build: **141**

## Kapsam

Güvenilen Ed25519 imha kanıtı sağlayıcıları için imzalı anahtar döndürme,
geçerlilik aralıkları, replay/çakışma koruması ve makbuz-zamanı güven doğrulaması.

## Hedefli doğrulama

- Build 141 anahtar döndürme sözleşmesi: **PASS — 87/87**
- Gerçek Ed25519 çalışma zamanı: **PASS — 21/21**
- Renderer/preload/global sözdizimi: **PASS — 3/3**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Temiz `npm ci`, tam root typecheck, tüm testler, Electron production build, gerçek sağlayıcı ve installer: **NOT_RUN**

Build 141 Bronze RC2 Active Development içinde kalır; Final, Freeze, Silver veya Gold değildir.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 42/42**
- Kaynak bütünlüğü: **PASS — 1.166/1.166 kaynak dosyası; 1.167 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.168 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 40 kanıt / 8 kapı**
