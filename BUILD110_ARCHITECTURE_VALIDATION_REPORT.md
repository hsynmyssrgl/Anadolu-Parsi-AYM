# Build 110 Architecture Validation Report

## Kimlik

- Ürün: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.110`
- Package Version: `25.7.2026-110`
- Aşama: **Bronze RC2 Active Development**

## Çözülen mimari sorunlar

1. Temiz `npm ci` kapısı geçici dış servis hatalarında tek denemeyle sonlanıyordu; resmî npm registry ile sınırlı, en fazla üç denemeli kontrollü retry katmanı eklendi.
2. HTTP/ağ kesintileri; lockfile/politika, paket bütünlüğü, yerel dosya izni ve sınıflandırılamayan kurulum hatalarından ayrıldı.
3. Npm'nin `Exit handler never called` genel hatasının arkasındaki gerçek ağ sinyallerini bulmak için güvenli npm debug-log incelemesi eklendi.
4. Debug log yalnızca npm cache `_logs` sınırı içinde okunur; dizin dışına taşan yol reddedilir.
5. Asılı kalan npm süreçleri için platformlar arası process-tree sonlandırması ve bağımsız deneme süresi sınırı eklendi.
6. Normal RC2 politikası `180000 ms` deneme süresi kullanır. Doğrulama ortamı yalnızca bu süreyi kısaltabilir; uzatamaz.
7. Kaynak lockfile içindeki tüm haricî tarball kökenlerinin `https://registry.npmjs.org` olduğu kurulum öncesinde doğrulanır.
8. Alternatif, ayna veya güvenilmeyen registry'ye otomatik geçiş kesin olarak yasaklandı.
9. Npm çıktı ve debug kanıtlarındaki olası token/URL kimlik bilgileri maskelenir.
10. Debug kanıtları hata sinyalleri ve sınırlı log sonuyla özetlenerek teslim paketinin gereksiz büyümesi engellendi.
11. Windows RC2 GitHub Actions artifact kapsamına bağımlılık erişim kanıtı eklendi.

## Hedefli mimari doğrulama

`node scripts/verify-build110-architecture.mjs` gerçekten çalıştırıldı.

- Sonuç: **PASS**
- Hedefli assertion: **80**
- Doğrulanan başlıklar:
  - HTTP 408/429/500/502/503/504 sınıflandırması
  - `EAI_AGAIN`, `ECONNRESET`, `ETIMEDOUT` ağ sinyalleri
  - Debug-log içinde gizlenen ağ hatasının bulunması
  - Timeout + ağ sinyalinin birlikte korunması
  - Lockfile, bütünlük ve izin hatalarında retry yapılmaması
  - Üç denemelik retry sınırı ve gecikme tavanı
  - Token/kimlik bilgisi maskelemesi
  - Resmî registry ve lockfile origin kısıtı
  - Asılı npm process-tree sonlandırması
  - Windows workflow kanıt koruması
  - Build 110 sürüm ve aşama senkronizasyonu

## Gerçek temiz kurulum sonucu

Temiz, `node_modules` içermeyen ayrı kaynak kopyasında sıralı RC2 gate runner gerçekten çalıştırıldı. Araç oturumu için yalnızca daha kısa `7000 ms` deneme sınırı kullanıldı; kaynak politikadaki normal sınır `180000 ms` olarak korunmaktadır.

- Deneme sayısı: **3/3**
- Registry: `https://registry.npmjs.org/`
- Lockfile registry kökenleri: yalnızca `https://registry.npmjs.org`
- Üç denemenin sonucu: **FAIL**
- Sınıflandırma: `EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE`
- Gerçek ağ sinyali: `EAI_AGAIN`
- Asılı süreç sinyali: `ATTEMPT_TIMEOUT`
- Alternatif registry kullanımı: **yok**

Bu dış erişim engeli nedeniyle tam workspace `tsc --noEmit`, Electron production build, blocking smoke testleri, Windows gerçek açılış ve installer kapıları çalıştırılmamıştır.
