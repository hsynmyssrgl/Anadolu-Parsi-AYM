# Bronze RC2 Build 122 Sürüm Notları

- Application Version: `26.07.2026.122`
- Package Version: `26.7.2026-122`
- Stage: **Bronze RC2 Active Development**

## Ürün düzeltmeleri

- Kişisel zaman tünelindeki açık nesne izni hatası kapatıldı.
- AI onay zamanı güvenilir transaction saatine bağlandı.
- Renderer’dan Node `crypto` bağı kaldırıldı.
- Önemli günlerden ilgili arşiv içeriklerine geçiş ve etkinlik filtresi eklendi.
- Bağlı dosya filtresi yetkilendirilmiş arşiv sorgu zincirine taşındı.

## Derleme ve doğrulama düzeltmeleri

- Electron main/preload üretimi workspace TypeScript derleyicisine geçirildi.
- Vitest kaynak eşlemeleri düzeltildi.
- RC2 zincirine zorunlu birim/entegrasyon testi eklendi.
- Temiz kaynakta eksik olan `@ppt/domain/renderer` kök TypeScript eşlemesi
  tamamlandı; eski `dist` çıktılarının hatayı gizlemesi engellendi.
- Windows açılış kanıtları resmî ve tanısal olarak ayrıldı.
- Minimal Electron sandbox ortam tanısı ve normal Windows yaşam döngüsü
  doğrulayıcısı eklendi.
- Windows yaşam döngüsü doğrulayıcısı PowerShell 5.1 ve yeni PowerShell
  sürümlerinde güvenli argüman aktaracak ve BOM’suz JSON kanıtı yazacak şekilde
  düzeltildi.
- Windows’ta npm paketleme çağrısı uyumlu komut yorumlayıcısına taşındı.
- Eski per-machine kurulumların test kurulumunu yükseltme kipine zorlaması
  engellendi; test yalnız mevcut kullanıcıya ve yalıtılmış çalışma dizinine kurulur.
- Mevcut gerçek kullanıcı kurulumu üzerine yazmayı reddeden ve ayrık kaldırıcı
  sürecinin tamamlanmasını bekleyen fail-closed yaşam döngüsü koruması eklendi.
- Başlangıç kapsamı için gereksinim izlenebilirlik matrisi eklendi.
- `electron-builder` `26.15.6` sürümüne yükseltildi ve tam olarak sabitlendi.
- Yalnız NSIS kullanan Windows teslim hattından Squirrel.Windows bağımlılık
  zinciri çıkarıldı; yanlışlıkla çağrılırsa fail-closed davranan uyumluluk
  paketi eklendi.
- ASAR `4.2.1`, universal `3.0.4` ve EJS `6.0.1` güvenli araç sürümlerine
  sabitlendi.
- Production ve build-toolchain npm audit sonuçları **0 bulgu** seviyesine
  indirildi.
- Electron `43.2.0` sürümüne yükseltildi; yeni Electron indirme önbelleği
  sözleşmesi doğrulama çalışma alanına bağlandı.
- Electron installer paketleyicisi de eski ve yeni cache sözleşmelerini birlikte
  kullanan kontrollü Node çalıştırıcısına taşındı.
- Kodlama bilgisi gerektirmeyen tek tıklamalı Bronze Final Windows doğrulayıcısı
  eklendi. Araç clean kaynak, RC2 kapıları, resmî sandbox’lı yaşam döngüsü ve iki
  bağımlılık denetimini çalıştırıp taşınabilir kanıt ZIP’i üretir.
- Tek tıklamalı doğrulayıcının npm önbelleği kullanıcı profilinden ayrılarak
  kaynak paket içindeki doğrulama alanına sabitlendi.
- Manuel Windows kurulumunda lisans metninin BOM’suz UTF-8 olarak yanlış
  yorumlanması düzeltildi. NSIS lisansı ASCII RTF içinde açık Unicode
  kaçışlarıyla paketleniyor ve UTF-8 kaynak metinle birebir doğrulanıyor.

## Sonuç

Temiz kaynakta `npm ci`, tam tip kontrolü, 57 test, production build ve Bronze
smoke zinciri geçti. Güvenliği azaltılmış tanı kipinde geliştirme açılışı,
installer üretimi, sessiz kurulum, kurulu uygulama açılışı ve kaldırma 5/5 geçti.
Bu sonuç resmî sandbox’lı Windows açılış PASS’i yerine geçmez; Build 122 Final
değildir.
