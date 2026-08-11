# Panthera pardus tulliana Aile — Bronze RC2 Build 116

- Application Version: `25.07.2026.116`
- Package Version: `25.7.2026-116`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 116 odağı

Resmî npm registry kökenli yerel cache içeriğinin lockfile SHA-512 değerleriyle doğrulanması, cache tam olduğunda offline clean install çalıştırılması ve eksik cache durumunda yalnızca resmî registry’ye `prefer-offline` fallback uygulanması.

## Tamamlanan mimari değişiklikler

- Lockfile’daki benzersiz haricî tarball URL’leri ve SHA-512 bütünlük değerleri çıkarılıyor.
- Npm cache `index-v5` kayıtları, içerik dosyası, byte sayısı ve gerçek SHA-512 özeti çapraz doğrulanıyor.
- Eksik indeks, eksik içerik, boyut farkı, hash farkı ve resmî olmayan registry ayrı nedenlerle reddediliyor.
- Cache tam olduğunda `npm ci --offline` önce çalıştırılıyor.
- Cache eksikse offline kurulum denenmeden resmî registry üzerinde `--prefer-offline` clean install çalıştırılıyor.
- Offline deneme başarısız olursa kısmi `node_modules` kalıntıları online fallback öncesinde temizleniyor.
- Linux ve Windows doğrulama akışlarına cache hazırlık kanıtı eklendi.

## Gerçek doğrulama durumu

- Source-preflight: **PASS — 9/9**.
- Kaynak bütünlüğü: **PASS — 928 dosya / 929 SHA-256 girdisi**.
- Build 116 mimari doğrulaması: **PASS — 40 assertion**.
- Lockfile / tedarik / workspace sözleşmeleri: **PASS — 1.150 / 1.349 / 356 assertion**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- Package-source ve Electron-main kontrollü type-check: **PASS**.
- Bronze database ve repository source kapıları: **PASS**.
- Npm offline cache readiness: **INCOMPLETE — 39/421 tarball hazır, 382 indeks kaydı eksik**.
- Temiz `npm ci`: **FAIL — 3 resmî registry denemesi; NPM_PROCESS_TIMEOUT / ATTEMPT_TIMEOUT**.
- Offline clean install: **NOT_RUN — cache incomplete**.
- Force-settle ve kısmi kurulum temizliği: **PASS**.
- Tam root `tsc --noEmit`, production build, blocking smoke, Windows launch ve installer: **NOT_RUN**.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
