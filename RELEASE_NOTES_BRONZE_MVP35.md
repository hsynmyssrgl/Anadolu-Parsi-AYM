# Bronze MVP-35 — Sürüm Notları

**Sürüm:** 21.07.2026.35  
**Kanal:** Bronze  
**Durum:** Windows installer altyapısı hazır; gerçek NSIS `.exe` üretimi çevrimdışı çalışma ortamında tamamlanamadı.

## Eklenenler

- Windows NSIS yardımcı kurulum yapılandırması standardize edildi.
- Kullanıcı bazlı kurulum (`perMachine: false`) ve yönetici yetkisi istemeyen `asInvoker` çalışma seviyesi tanımlandı.
- Kurulum dizini seçimi, masaüstü ve Başlat menüsü kısayolları etkinleştirildi.
- Kaldırma işleminde kullanıcı verilerinin otomatik silinmemesi güvenli varsayılan olarak korundu.
- Bronze lisans bildirimi ve çok çözünürlüklü Windows `.ico` simgesi eklendi.
- Paket öncesi simge, lisans, Electron main/preload ve renderer çıktısını denetleyen installer doğrulama komutu eklendi.
- Windows paket klasörü için `package:win:dir`, NSIS kurucusu için `package:win` komutları tanımlandı.
- Tek uygulama örneği kilidi ve Windows AppUserModelId eklendi.
- İkinci kez çalıştırıldığında mevcut pencerenin öne getirilmesi sağlandı.

## Doğrulama

- TypeScript: başarılı
- Testler: 34/34 başarılı
- Electron + React üretim derlemesi: başarılı
- Installer ön doğrulaması: başarılı
- npm güvenlik denetimi: 0 açık
- Gerçek Windows NSIS denemesi: yapılandırma aşaması başarılı; Electron Windows ikilisi çevrimdışı ortam nedeniyle indirilemedi (`getaddrinfo EAI_AGAIN github.com`).

## Bilinen sınırlama

Bu kaynak pakette kurulabilir `.exe` bulunmaz. NSIS kurucusu internet erişimli Windows veya uygun cross-build ortamında `npm run package:win --workspace @ppt/desktop` komutuyla üretilecektir.
