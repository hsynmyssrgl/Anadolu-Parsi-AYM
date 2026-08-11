# Build 211 - Temiz npm ci bağımlılık handoff

Build 211, OPEN-002 temiz ve tekrarlanabilir bağımlılık kurulumunu gerçek PASS olmadan kapatmaz. Mevcut yürütme ortamında resmî npm registry erişimi ve kabul edilmiş offline cache bulunmadığı için clean `npm ci` FAIL kalır.

- Resmî lockfile korunur; sahte/yerel paket ikamesi yapılmaz.
- Acquisition planı: **117** resmî tarball.
- Bağlı ve internete erişebilen makine için deterministik handoff isteği üretilir.
- Tarball bütünlüğü lockfile SHA-512/integrity değerleriyle doğrulanır.
- Kabul edilmiş cache geri getirildiğinde önce doğrulama, sonra offline `npm ci` çalıştırılır.
- OPEN-002 yalnız gerçek `npm ci` PASS kanıtıyla COMPLETED olabilir.

Bu build Silver terfisi değildir; Bronze RC2 devam eder. Sıradaki uygulanabilir geliştirme OPEN-021 aktif oturum kullanıcı verisi korumasıdır.
