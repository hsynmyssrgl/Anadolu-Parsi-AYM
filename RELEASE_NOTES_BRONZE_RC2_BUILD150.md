# Bronze RC2 Build 150 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `29.07.2026.150`
- Package Version: `29.7.2026-150`
- Stage: **Bronze RC2 Active Development**

## Tek ana konu

Yeniden üretilebilir bağımlılık kurulumu ve Build 149'da başarısız kalan tam
TypeScript, test, Electron production build ve blocking smoke kapılarının tekrar
denetlenmesi.

## Eklenenler

- Hash ve sürüm bağlı npm cache paketi otomatik içe aktarma.
- Doğrulanmış cache ile çevrimdışı `npm ci`.
- Kurulum betiklerini kapatan güvenli temiz kurulum politikası.
- Cache/lock uyuşmazlığında fail-closed ret.
- Windows paketleme bağımlılıkları için ayrı manifest ve lockfile.
- Kök bağımlılık grafiğine Windows-only paket sızıntısını engelleyen sözleşme.
- Fixture üzerinde gerçek çevrimdışı `npm ci` uçtan uca testi.

## Gerçek ortam sonucu

Bu çalışma ortamında resmî npm erişimi sağlanamadığı için gerçek proje bağımlılık
kurulumu tamamlanmadı. Buna bağlı TypeScript, test, production build ve smoke
kapıları FAIL kaldı. Bu kapılar çalıştırılmış ve gerçek sonuçları kaydedilmiştir;
PASS olarak raporlanmamıştır.
