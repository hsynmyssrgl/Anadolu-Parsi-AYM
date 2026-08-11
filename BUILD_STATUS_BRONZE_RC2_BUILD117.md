# Panthera pardus tulliana Aile — Bronze RC2 Build 117

- Application Version: `25.07.2026.117`
- Package Version: `25.7.2026-117`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 117 odağı

Resmî npm registry tarball cache içeriğini lockfile SHA-512 değerleriyle deterministik bir taşıma paketine dönüştürme, paketi değişikliklere karşı doğrulama ve yeni yalıtılmış npm cache köküne güvenli biçimde yayımlama.

## Tamamlanan mimari

- Cache paketi yalnızca `https://registry.npmjs.org/` kökenli lockfile tarball’larını kabul eder.
- Paket, `package-lock.json` SHA-256 değeri ve her tarball’ın SHA-512 bütünlüğüyle bağlıdır.
- Eksik cache’den tam paket oluşturulmaz.
- Paket dosya yolları içerik özetinden türetilir ve deterministik ZIP olarak üretilir.
- İçe aktarma mevcut cache’i değiştirmez; hedef cache kökünün mevcut olmaması zorunludur.
- İçerik ve npm `index-v5` yapısı staging dizininde hazırlanır, readiness PASS olduktan sonra hedef adla yayımlanır.
- Npm timeout force-settle açık pipe tutamaçlarını kapatarak üst doğrulama zincirinin kesin çıkmasını sağlar.

## Gerçek doğrulama durumu

- Source-preflight: **PASS — 10/10**.
- Kaynak bütünlüğü: **PASS**.
- Npm cache transfer sözleşmesi: **PASS — 33 assertion**.
- Build 117 mimari doğrulaması: **PASS — 33 assertion**.
- Package-source ve Electron-main kontrollü type-check: **PASS**.
- Bronze database ve repository source kapıları: **PASS**.
- Npm offline cache readiness: **INCOMPLETE — 39/421 tarball hazır, 382 eksik**.
- Gerçek cache transfer paketi: **INCOMPLETE — eksik cache nedeniyle oluşturulmadı**.
- Temiz `npm ci`: **FAIL — 3 resmî registry denemesi; NPM_PROCESS_TIMEOUT**.
- Force-settle ve kısmi kurulum temizliği: **PASS**.
- Tam root `tsc --noEmit`, production build, blocking smoke, Windows launch ve installer: **NOT_RUN**.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
