# Bronze RC2 Build 183 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.183`
- Package Version: `30.7.2026-183`
- Stage: **Bronze RC2 Active Development**
- Build: **183**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

Build 183, kalıcı olarak imha edilmiş kayıtları içeren yönetilen tam yedeklerin
saklama süresi dolduğunda doğrulanmış temiz yedekle otomatik yeniden yazılmasını
ve eski kopyanın geri alınabilir karantinaya taşınmasını sağlar.

## Bronze kaynak kapıları

- Build 183 sözleşme ve karar yayılımı: **36/36 PASS**
- Build 183 davranış doğrulaması: **15/15 PASS**
- Build 183 kontrollü TypeScript: **3/3 PASS**
- Kaynak preflight hedefi: **165/165 PASS — 21 küçük segment**
- Kaynak bütünlüğü hedefi: **1.594/1.594 PASS**
- SHA-256 listesi hedefi: **1.595 giriş**
- Aktif sürüm sözleşmesi hedefi: **178/178 PASS**
- Aktif teslim belgeleri hedefi: **121/121 PASS**
- Teslim tasdik sözleşmesi hedefi: **111 kanıt / 8 kapı PASS**

## Silver tam test sınırı

Temiz kurulum, tam root TypeScript, bütün birim ve entegrasyon testleri, Electron
production build, blocking smoke, performans, güvenlik, kullanılabilirlik ve gerçek
Windows/installer testleri Silver test kampanyasında çalıştırılacaktır.
