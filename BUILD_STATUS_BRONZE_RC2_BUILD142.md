# Bronze RC2 Build 142 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.142`
- Package Version: `28.7.2026-142`
- Stage: **Bronze RC2 Active Development**
- Build: **142**

## Kapsam

İmzalı sağlayıcı iptal listesi, monoton geri alma koruması, süreli çevrimdışı
güven önbelleği ve iptal durumunun bağlı kanıtlara atomik yayılması.

## Hedefli doğrulama

- Build 142 iptal listesi sözleşmesi: **PASS — 80/80**
- Gerçek Ed25519 çalışma zamanı: **PASS — 28/28**
- Renderer/preload/global sözdizimi: **PASS — 3/3**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Temiz `npm ci`, tam root typecheck, tüm testler, Electron production build,
  gerçek sağlayıcı HTTPS senkronizasyonu ve installer: **NOT_RUN**

Build 142 Bronze RC2 Active Development içinde kalır; Final, Freeze, Silver veya Gold değildir.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 45/45**
- Kaynak bütünlüğü: **PASS — 1.175/1.175 kaynak dosyası; 1.176 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.177 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 43 kanıt / 8 kapı**
- Kaynak ZIP içerik doğrulaması: **PASS — 1.177 giriş**
