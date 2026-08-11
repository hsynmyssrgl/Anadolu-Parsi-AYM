# UI, UX ve Erişilebilirlik Standardı — Build 183

**Aktif sürüm:** 02.08.2026.228

## 1. Tasarım yönü

Arayüz Apple ürünlerindeki sadelik, hiyerarşi, okunabilirlik ve doğal etkileşim
ilkelerinden esinlenir; birebir kopya değildir. Anadolu Parsı marka işareti,
özgün ikon ve cam yüzeyli masaüstü kabuğu korunur.

## 2. Uygulama kabuğu

- 16 modül dört mantıksal grup altında sunulur.
- Kenar menüsü daraltılabilir ve tercih yerel olarak saklanır.
- Açık/koyu tema kullanıcı tercihidir.
- `Ctrl+K` / `Ctrl+F` komut araması gerçek modül gezinmesi sağlar.
- Bildirim merkezi okundu işaretlemeyi destekler.
- Profil menüsü ayarlar, güvenlik ve çıkış işlemlerini gösterir.
- Çevrimdışı durum, son senkronizasyon ve bekleyen değişiklik sayısı görünür olmalıdır.

## 3. Tipografi

Merkezi font zinciri işletim sisteminin Apple uyumlu sistem fontunu önceler;
proprietary SF font dosyaları projeye gömülmez.

| Semantik rol | Boyut | Ağırlık | Tipik kullanım |
|---|---:|---:|---|
| Büyük başlık | 34 px | 700 | Ana karşılama / büyük sayfa |
| Sayfa başlığı | 28 px | 700 | Modül başlığı |
| Bölüm başlığı | 22 px | 600 | Büyük panel bölümü |
| Alt başlık | 20 px | 600 | Kart/panel alt hiyerarşisi |
| Gövde | 17 px | 400 | Ana okunabilir metin |
| Kontrol | 15 px | 500 | Düğme, form, menü |
| İkincil | 13 px | 400/500 | Metadata, dipnot |
| Minimum | 11–12 px | 400/500 | Zorunlu kompakt bilgi |

- Rastgele `font-size` yerine semantik token kullanılır.
- Genel arayüz etiketleri tümü büyük harfe dönüştürülmez.
- Türkçe doğal cümle/başlık yazımı kullanılır.
- Satır yüksekliği okunabilirlik için font boyutundan büyük tutulur.
- Kullanıcı metin ölçeği tercihi saklanabilir olmalıdır.

## 4. Etkileşim ve kontroller

- Temel dokunma/tıklama hedefi en az 44 px yüksekliğindedir.
- Kritik işlem düğmeleri tek ve anlaşılır eylem taşır.
- Silme, iptal, arşivleme ve geri alma görsel olarak ayrılır.
- Hata mesajı sorunun yanında yapılacak eylemi de söyler.
- Uzun işlem ilerleme, iptal ve sonuç durumu gösterir.
- Yükleme, boş durum, hata ve yetkisiz durum ayrı bileşenlerdir.

## 5. Erişilebilirlik

- Tüm işlevler klavyeyle erişilebilir olmalıdır.
- Görünür odak halkası kaldırılmaz.
- Form kontrolü etiket, açıklama ve hata ilişkisine sahip olmalıdır.
- İkon düğmeleri erişilebilir ad taşır.
- Renk tek durum göstergesi değildir; metin/ikon/şekil eşlik eder.
- Ekran okuyucu için anlamlı başlık hiyerarşisi kullanılır.
- Kontrast açık ve koyu temada doğrulanır.
- Türkçe metin uzaması ve farklı ekran ölçekleri test edilir.
- Çocuk, yetişkin ve yaşlı kullanıcı senaryoları Silver kullanılabilirlik testine dahildir.
- Kullanıcı `standard`, `large` veya `extra-large` metin ölçeği seçebilir; tercih yerel profilde saklanır.
- Yüksek kontrast ve hareket azaltma tercihleri yerel olarak saklanır; ilk değer işletim sistemi tercihinden alınabilir.
- Bölüm değişiminde ana içerik odağı güncellenir ve Türkçe canlı bölge duyurusu yapılır.
- Komut araması `listbox/option` semantiği, yukarı/aşağı, Home/End, Enter, Escape ve Tab odak tuzağını destekler.
- Forced-colors ortamında sistem renkleri ve görünür odak korunur.

## 6. Gizlilik deneyimi

- Dashboard hassas tutarlar için gizleme modu sunmalıdır.
- Sağlık, finans, konum ve AI izinleri açıkça görünürdür.
- Paylaşımın kiminle, ne amaçla ve ne zamana kadar geçerli olduğu gösterilir.
- Aile yöneticisi rolü özel veriye sınırsız erişim algısı oluşturmamalıdır.

## 7. Yayın davranışı

Bronze ve Silver’da tanı/test yüzeyleri açıkça etiketlenir. Gold sürümünde test,
geliştirici ve tanı menüleri son kullanıcıdan gizlenir. Kullanıcıya gösterilen
sürüm/kanal bilgisi gerçek build sözleşmesiyle eşleşir.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 179 kalıcı UI kararları

`PPT-LIFECYCLE-STRICT-V1` altında kanal rengi ve aile ekleme akışı değişmez kabul standardıdır. Bronze menüleri bakır/bronz, Silver gümüş, Gold altın tokenlarını kullanır; metinsel kanal etiketi korunur. Aile bireyi formu hazır, gruplu ve aranabilir yakınlık kataloğu ile “Kime göre?” referans kişi seçimini sunar; yalnız serbest metin girişi varsayılan akış olamaz.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 UI/UX kararı

Güvenlik Merkezi; politika etkinliği, saklama günü, süresi dolan kayıt, etkin hedef, kalıcı durum, sonraki deneme ve son hatayı metinle gösterir. Renk tek başına durum anlamı taşımaz. Manuel çalıştırma ve politika kaydı açık etiketlidir; güçlü doğrulama alanları mevcut ortak akıştan kullanılır.

## Build 184 UI/UX kararı

“Kalıcı çalışma geçmişi” listesi durum metnini renkten bağımsız gösterir; hata ve sonraki deneme açık dille sunulur. Menü ve seçili menü renkleri merkezi Bronze bakır/bronz sürüm tokenlarından gelmeye devam eder.

## Build 185 UI/UX kararı

Yedek yaşam döngüsü ve kalıcı çalışma geçmişinde gösterilen tamamlanma zamanı,
hedef işlemlerinden sonra üretilmiş gerçek kronolojik zamandır. Renk tek başına
zaman veya başarı anlamı taşımaz; Bronze menü tokenları bakır/bronz kalır.

## Build 186 UI/UX kararı

Çalışma geçmişinde propagation kimliği, üst sonuç ve tamamlanma zamanı metinle
birlikte sunulur. Bağlantı/kronoloji hataları renkten bağımsız açık hata metnidir.

## Build 187 UI/UX kararı

Kesinti kurtarması saat düzeltmesi kullandıysa kullanıcıya teknik fakat anlaşılır
bir uyarı gösterilir. Uyarı yalnız kayıtlı çalışma başlangıcı, gözlenen saat ve
sonraki deneme zamanını taşır; renk tek başına anlam taşımaz ve mevcut canlı
bölge/klavye erişilebilirliği korunur.

## Build 188 UI/UX kararı

`backup.clean_rewrite_claim_clock_adjusted` tanısı teknik hata gibi gizlenmez; kısa neden, gözlenen saat ve güvenli başlangıç erişilebilir metinle sunulur. Kullanıcıya geri çekilmenin atlanmadığı ve verinin değiştirilmediği açıklanır. Renk tek başına anlam taşımaz.

## Build 189 UI/UX kararı

Aktif çalışma sırasında ayar kaydetme girişimi anlaşılır hata üretir; kullanıcı ayarların çalışma tamamlanana kadar kilitli olduğunu görür.


## Build 190 UI/UX kararı

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 UI/UX kararı

Kullanıcıya gösterilen sonraki deneme zamanı manuel ve otomatik tetikleyici politikasına göre hesaplanan kalıcı değer olmalıdır.

## Build 192 UI/UX kararı

“Otomatik politika etkin” kapalıyken “Şimdi çalıştır” kullanılabilir kalır. Manuel komut backoff nedeniyle reddedilirse kullanıcıya sonraki deneme zamanı gösterilir; otomatik politikanın yeniden açıldığı izlenimi verilmez.



## Build 193 UI/UX kararı

Yeni kullanıcı akışı eklenmez. Mevcut çalışma geçmişi yalnız doğrulanmış policy-owned ledger kayıtlarını gösterir; hata metinleri açık ve erişilebilir kalır. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 UI/UX kararı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 UI/UX kararı

Aktif çalışma sırasında politika ayarları arayüzden düzenlenemez; backend ve SQLite aynı sınırı uygular.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — UI Görsel Referans Manifestosu

`config/ui-visual-reference-manifest.json` ve `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png` bağlayıcı baseline’dır; görsel SHA-256 özeti manifestte sabitlenir ve drift fail-closed reddedilir. Ölçülebilir tipografi için mevcut Apple uyumlu sistem font zinciri, kanal rengi için Build 179 Bronze/Silver/Gold tokenları korunur. Görsel baseline kişisel/demo içerik taşıyamaz. Silver öncesi ekran uyumu doğrulanır.
