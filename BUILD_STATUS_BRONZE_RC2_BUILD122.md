# Bronze RC2 Build 122 Durumu

- Application Version: `26.07.2026.122`
- Package Version: `26.7.2026-122`
- Stage: **Bronze RC2 Active Development**
- Sonraki devam noktası: **Build 122 Active Development**

## Gerçek geliştirme

- Önemli gün ayrıntısındaki **Arşivde görüntüle** düğmesi çalışır hâle getirildi.
- Arşiv araması bağlı etkinlik kimliğine göre filtrelenebiliyor.
- Dosya–etkinlik bağlantısı için uçtan uca regresyon testi eklendi; bağlantısız
  belgelerin filtre sonucuna sızmadığı ve içerik sayısının transaction içinde
  arttığı doğrulandı.
- Temiz kaynakta gizlenen `@ppt/domain/renderer` TypeScript eşleme eksikliği
  bulundu ve düzeltildi.
- Aynı eksikliğin geri gelmesini engelleyen mimari sözleşme eklendi.
- Normal Windows oturumunda geliştirme açılışı, installer üretimi, geçici
  kurulum, kurulu uygulama açılışı ve kaldırmayı doğrulayan tek komutluk yaşam
  döngüsü testi eklendi.
- Yaşam döngüsü doğrulayıcısının Windows PowerShell 5.1 üzerinde Electron’a
  ulaşmadan düşmesine neden olan işlem argümanı uyumsuzluğu giderildi.
- Tanı koşularının resmî PASS kanıtını ezmesi engellendi; güvenliği azaltan
  koşular yalnız `DIAGNOSTIC_PASS` üretebilir.
- Minimal Electron sandbox sağlık testi, mevcut açılış engelini Panthera
  kodundan bağımsız olarak ortam katmanına izole etti.
- Bronze gereksinim izlenebilirlik matrisi oluşturuldu.
- `electron-builder` güvenlik yaması `26.15.6` sürümüne sabitlendi.
- Kullanılmayan Squirrel.Windows araç zinciri fail-closed yerel uyumluluk
  paketiyle devre dışı bırakıldı; Windows hedefi yalnız NSIS olarak doğrulanıyor.
- ASAR, universal ve EJS araç bağımlılıkları güvenli sürümlere sabitlendi.
- Electron, Windows donanım hızlandırma düzeltmesini içeren `43.2.0` sürümüne
  sabitlendi.
- Normal Windows bilgisayarda çift tıklamayla tüm resmî Final kapılarını
  çalıştıran `BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd` eklendi.
- Tek tıklamalı doğrulayıcının npm önbelleği kullanıcı profilinden ayrılarak
  paket içindeki doğrulama alanına yönlendirildi.
- Manuel Windows kabul denemesinde görülen bozuk Türkçe lisans metni giderildi;
  installer artık Unicode güvenli RTF lisansı kullanıyor.

## Gerçek doğrulama

- Clean `npm ci`: **PASS — 312 paket**
- Temiz kaynak tam tip kontrolü: **PASS**
- Temiz kaynak testleri: **PASS — 8/8 dosya, 57/57 test**
- Temiz kaynak production build: **PASS**
- Temiz kaynak Bronze smoke zinciri: **PASS**
- Build 122 mimari sözleşmesi: **PASS — 69 assertion**
- NSIS-only araç zinciri güvenlik sözleşmesi: **PASS — 64 assertion**
- Production dependency audit: **PASS — 0 bulgu**
- Build araç zinciri audit: **PASS — 0 bulgu**
- Windows installer üretimi: **PASS**
- Windows sandbox’lı geliştirme ve paketli açılış: **FAIL — ortam engeli**
- Minimal sandbox ortam testi: **BLOCKED_ENVIRONMENT — `launch-failed 49`**
- Tanı amaçlı `--no-sandbox` geliştirme ve paketli açılış: **DIAGNOSTIC_PASS**
- Tanı amaçlı tam Windows yaşam döngüsü: **DIAGNOSTIC_PASS — 5/5 adım**
- Resmî sandbox’lı Windows yaşam döngüsü: **FAIL — development launch ortam engeli**
- Geçici tanısal kurulum ve kaldırma kalıntı denetimi: **PASS**

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmedi.
