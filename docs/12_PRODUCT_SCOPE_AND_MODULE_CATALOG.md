# Ürün Kapsamı ve Modül Kataloğu — Build 183

**Aktif sürüm:** 02.08.2026.228

## Ürün tanımı

Anadolu Parsı Aile Yaşam Merkezi; aileye temas eden yetkili kişilerin yaşam
olaylarını, ilişkilerini, belgelerini, anılarını, sağlık ve finans kayıtlarını,
görevlerini ve ortak aile hafızasını yerel-öncelikli ve izin farkındalıklı
biçimde yöneten modüler masaüstü platformudur.

## Kullanıcı ve bağlam modeli

- Aile, hane, aile dalı, kişi, kullanıcı hesabı ve üyelik ayrı varlıklardır.
- Aynı kişi birden fazla aile dalı veya haneyle ilişkilendirilebilir.
- Her yetişkin kendi özel verisinin sahibidir.
- Çocuk, vasi, bakıcı, danışman, misafir ve profesyonel destek erişimleri amaç ve süreyle sınırlandırılır.
- Davet, üyelik, hesap ve yetki yaşam döngüleri birbirinden bağımsızdır.

## Aktif 16 modül

### 1. Gösterge Paneli

Aile durumu, yaklaşan olaylar, modül hazırlığı, son kayıtlar ve hızlı işlemler.

### 2. Aile

Kişi, üyelik, aile dalı, temel ilişki, davet ve profil yönetimi.

### 3. Soy Ağacı

Ebeveyn, eş, kardeş, vasi ve diğer ilişkiler; nesil görünümü; kaynak ve kanıt bağlantıları.

### 4. Zaman Tüneli

Kişisel ve aile olaylarının yetki filtreli görünümü; arama, filtre, düzenleme,
arşivleme ve geri alma.

### 5. Önemli Günler

Tarih-saat, yer, katılımcı, davetiye, not, tekrar, hatırlatma, medya, belge ve AI izni.

### 6. Arşiv

Fotoğraf, video, ses ve belge içe aktarma; hash, sürüm, kategori, ilişki ve olay bağlantısı.

### 7. Finans

Kişisel ve ortak varlık/borçlar, sahiplik yüzdesi, para birimi, hedef ve özetler.
Özel finans verisi açık izin olmadan aile toplamına katılmaz.

### 8. Sağlık

Sağlık kaydı, ilaç ve tedavi planı, bakım, sigorta ve yüksek hassasiyetli gizlilik.

### 9. Yaşam Merkezi

Görev, sigorta, eğitim, abonelik, resmî işlem, iş geçmişi, ev/araç ve acil durum kayıtları.

### 10. Bildirim ve Otomasyon

Önemli gün, yaşam, finans ve ilaç kayıtlarından yerel hatırlatma/görev üretimi;
çalıştırma geçmişi ve etkin/pasif kurallar.

### 11. Raporlama

Yetkiye göre aile özeti, finans, gecikmeler ve PDF dışa aktarımı. Dışa aktarım
veri sahipliği ve görünürlük filtresini aşamaz.

### 12. Konum

Olay ve ikamet konumları, harita ve rızaya bağlı süreli canlı konum için adapter sınırı.

### 13. Yetkiler

Rol, nesne, sahip, işlem, süre, allow/deny ve denetim yönetimi.

### 14. Yapay Zekâ

İzinli veriyle arama, ilişkilendirme, özetleme ve öneri. AI kesin kayıt oluşturmaz;
insan onayı gerekir.

### 15. Dijital Miras

Zaman kapsülü, hak paketi, bekleme süresi, çoklu yönetici onayı, iptal ve geri alma.

### 16. Ayarlar

Tema, tipografi tercihi, güvenlik, güvenilir cihaz, 2FA, yedekleme, operasyonel sağlık ve uygulama bilgisi.

## Kapsam dışı

- Bağımsız yatırım ve otomatik alım-satım işlevleri
- Broker ve piyasa veri entegrasyonları
- Kullanıcı onayı olmadan yüz/kişi/olay kesinleştiren AI
- Açık rıza olmadan canlı konum
- Bronze aşamasında gerçek mağaza yayını ve üretim kod imzası
- Mobil istemciden bağımsız işlem motoru

## Platform kapsamı

Windows masaüstü ilk platformdur. Gelecekte macOS ve Apple companion istemcileri
planlanabilir. iPhone, iPad, Watch ve Vision Pro istemcileri ilk aşamada masaüstü
verisini okuyan, bağımsız veri/işlem üretmeyen istemcilerdir.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Teslim kanalı sınıflandırması — Build 182

16 modülün kullanıcıya dönük bütün işlevleri Bronze kapsamındadır. Silver veya Gold için özellik rezervi oluşturulamaz. Ağır haricî API üretim adaptörü askıya alınabilir; ancak modülün yerel iş akışı, ekranı, veri modeli, portu, adaptör sınırı, yapılandırması, fallback’i, test ikizi, hata ve güvenlik/gizlilik sözleşmesi Bronze’da tamamlanır. Politika: `PPT-LIFECYCLE-STRICT-V1`.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 modül güncellemesi

Güvenlik ve veri yaşam döngüsü modülüne “Otomatik temiz yedek yeniden yazımı” eklenmiştir. Modül; saklama politikası, zamanlayıcı, güvenli yedek üretimi, karantina, kesinti kurtarma, geri çekilme ve görünür tanı alt sınırlarını kapsar.

## Build 184 ürün kataloğu güncellemesi

Güvenlik Merkezi / Yedek yaşam döngüsü modülü, temiz yeniden yazım politikasına ek olarak son denemelerin kalıcı geçmişini gösterir. Durum, tetikleyici, saklama kesimi, kayıt/hedef sayısı, propagation kimliği, hata ve sonraki deneme alanları tipli modeldir.

## Build 185 ürün kataloğu güncellemesi

Güvenlik Merkezi / Yedek yaşam döngüsü geçmişindeki propagation başlangıç ve
bitiş zamanları gerçek işlem kronolojisini kullanır. Ürün davranışı yeni bir ekran
eklemek yerine mevcut tarihlerin doğruluğunu ve denetlenebilirliğini güçlendirir.

## Build 186 ürün kataloğu güncellemesi

Güvenlik Merkezi temiz-yedek çalışma geçmişi, bağlı propagation kimliği ve ortak
tamamlanma zamanına dayalıdır. Başarılı/kısmi kayıtlar bağlantısız gösterilemez.

## Build 187 ürün kataloğu güncellemesi

Güvenlik Merkezi içindeki temiz-yedek çalışma geçmişi, kesilmiş çalışmanın
güvenli kurtarma zamanını ve sonraki deneme zamanını gösterir. Saat geri alma
düzeltmesi teknik tanı olarak görünür; yeni menü veya ayrı ürün modülü eklenmez.

## Build 188 ürün kataloğu güncellemesi

Güvenlik Merkezi yedek otomasyonunda yeni bir görünür tanı bulunur: saat geri alma nedeniyle claim zamanı kalıcı kronolojiye yükseltildiğinde gözlenen saat, güvenli başlangıç ve kronoloji tabanı gösterilir. Bu tanı yedek içeriği veya kişisel veri içermez.

## Build 189 ürün kataloğu güncellemesi

Güvenlik Merkezi temiz-yedek politikası aktif çalışma boyunca salt okunur davranır; çalışma tamamlandıktan sonra yeniden düzenlenebilir.


## Build 190 ürün kataloğu güncellemesi

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 ürün kataloğu güncellemesi

Yedek ve veri yaşam döngüsü modülü manuel/otomatik tetikleyiciye duyarlı retry sözleşmesini içerir.

## Build 192 ürün kataloğu güncellemesi

Yedek ve veri yaşam döngüsü modülündeki “Otomatik politika etkin” anahtarı yalnız zamanlanmış çevrimi, “Şimdi çalıştır” ise ayrı manuel komutu temsil eder.



## Build 193 ürün kataloğu güncellemesi

Yedek ve kurtarma modülü, policy-owned running ledger identity kontrolünü kalıcı veri bütünlüğü işlevi olarak içerir. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 ürün kataloğu güncellemesi

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 ürün kataloğu güncellemesi

Temiz-yedek modülü aktif politika parametre bütünlüğü korumasını içerir.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 marka ve veri başlangıcı

Üst marka `Panthera pardus tulliana`dır; kullanıcıya görünen ürün adı `Anadolu Parsı Aile Yaşam Merkezi`dir. Ürün herhangi bir hazır kişi/aile/demo kaydıyla başlamaz; veri yalnız kullanıcı kurulumu, içe aktarma veya açık kullanıcı işlemiyle oluşur.
