# Katı Ürün Yaşam Döngüsü Politikası — Build 182

**Aktif sürüm:** 02.08.2026.228

**Politika kimliği:** `PPT-LIFECYCLE-STRICT-V1`  
**Marka kimliği:** Panthera pardus tulliana  
**Değiştirilebilirlik:** Katı; açık kullanıcı kararı ve yeni anayasa build’i olmadan esnetilemez.

## 1. Bronze geliştirme kanalı

Silver veya Gold için planlanmış olsa dahi bütün ürün özellikleri, modüller,
ekranlar, kullanıcı akışları, menü bağlantıları, veri modelleri, güvenlik
kontrolleri ve yerel işlevler Bronze kanalında tamamlanır. Yeni ürün geliştirme
yalnız Bronze kanalında yapılır.

## 2. Tek erteleme istisnası

Yalnız gerçek haricî servis hesabı, OAuth/sertifika, sağlayıcı onayı, ücret/kota,
hukuki sözleşme veya gerçek ağ ortamı gerektiren ağır API entegrasyonlarının
üretim adaptörü geçici olarak askıya alınabilir. Bu istisna özelliği Silver veya
Gold geliştirmesine taşımaz; hedef kanal yine Bronze’dur.

Erteleme ancak aşağıdaki altyapının Bronze kaynakta bulunmasıyla geçerlidir:

- açık port sözleşmesi,
- sağlayıcıdan bağımsız adaptör sınırı,
- yapılandırma ve sır yönetimi sınırı,
- çevrimdışı/yerel yedek davranış,
- sahte/test adaptörü,
- tipli hata ve yeniden deneme sözleşmesi,
- güvenlik, gizlilik, rıza ve denetim sınırı.

Bu koşullardan biri eksikse iş “API ertelendi” sayılamaz; Bronze’da eksik ürün
geliştirmesi olarak kalır.

## 3. Silver doğrulama kanalı

Silver’da yeni ürün özelliği eklenmez. Yalnız:

- mevcut altyapının iyileştirilmesi,
- hata düzeltmeleri,
- temiz kurulum ve tam TypeScript,
- birim, entegrasyon, güvenlik, performans, erişilebilirlik ve UAT,
- Electron production build, smoke, gerçek Windows ve installer,
- yedek/restore ve uzun süreli kararlılık

çalışmaları yapılır.

## 4. Gold üretim kanalı

Gold, başarılı Silver doğrulamasından sonra hazırlanır. Gold’da yeni ürün
özelliği geliştirilmez; yalnız üretim paketleme, imza, SBOM/lisans, rollback,
operasyon ve kritik üretim hata düzeltmeleri yapılabilir.

## 5. Değişmez arayüz ve aile veri kararları

- Aktif kanalın menü metni, ikon, hover ve seçili durum rengi kanal tokenından
  türetilir: Bronze bakır/bronz, Silver gümüş, Gold altın. Kanal adı yazıyla da
  görünür; renk tek başına anlam taşımaz.
- Aile bireyi ekleme varsayılan olarak domain yakınlık kataloğunu kullanır.
  Anne, baba, eş, çocuk, torun, enişte ve diğer geniş aile ilişkileri hazır
  seçilebilir; ilişki bir referans kişiye göre kurulur ve ileri/ters bağlar aynı
  işlem içinde oluşturulur. Özel ilişki ve eski serbest metin uyumluluğu korunur.

## 6. Kararın yayılımı

Her önemli karar aynı build içinde:

1. Ana Karar Kaydı’na,
2. Belge Yetki Matrisi’ne,
3. kapsam, ürün kataloğu ve açık işler belgelerine,
4. sürüm/test/doğrulama yönetişimine,
5. ilgili ADR ve uzmanlık standardına,
6. makine tarafından okunur politika dosyasına,
7. kaynak doğrulama sözleşmesine,
8. aktif teslim belgelerine

işlenmeden tamamlanmış sayılmaz. Tarihsel build kanıtları değiştirilmez; aktif
politikaya aykırı eski ifadeler yalnız tarihsel kayıt olarak değerlendirilir.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.

## Build 184 bağlayıcı güncellemesi

DEC-074 kapsamındaki atomik sonuçlandırma ve kalıcı çalışma geçmişi Bronze ürün geliştirmesidir. Silver bu davranışa yeni özellik eklemez; yalnız mevcut altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 185 bağlayıcı güncellemesi

DEC-075 kapsamındaki gerçek yedek yayılımı kronolojisi Bronze hata düzeltmesi ve
ürün bütünlüğü geliştirmesidir. Silver bu davranışa yeni özellik eklemez; yalnız
gerçek platform testleri, altyapı iyileştirmesi ve hata düzeltmesi yürütür.

## Build 186 bağlayıcı güncellemesi

DEC-076 ve ADR-059 kapsamındaki bağlı kronoloji ürün geliştirmesi Bronze'da
tamamlanır. Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test
kampanyası yürütür.

## Build 187 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-077 gereği kesinti kurtarma kronolojisi Bronze
kaynağında tamamlanır. Silver bu davranışa yeni özellik eklemez; gerçek Windows
saat geri alma, süreç sonlandırma, yeniden başlatma ve installer testlerini
yürütür.

## Build 188 bağlayıcı güncellemesi

DEC-078 ve ADR-061 kapsamındaki geri alma güvenli temiz-yedek sahiplenmesi Bronze ürün geliştirmesidir ve kaynakta tamamlanır. Silver yalnız mevcut altyapı iyileştirmesi, hata düzeltmesi ve bütün testlerin yürütülmesi içindir; bu özelliğin yeni tasarımı Silver'a ertelenemez.

## Build 189 bağlayıcı güncellemesi

DEC-079 ve ADR-062 kapsamındaki operasyonel izolasyon Bronze ürün bütünlüğü geliştirmesidir. Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyası yürütür.


## Build 190 bağlayıcı güncellemesi

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 bağlayıcı güncellemesi

Tetikleyiciye duyarlı temiz-yedek geri çekilmesi Bronze ürün geliştirmesidir; Silver yeni özellik eklemez.

## Build 192 bağlayıcı güncellemesi

Otomatik politikadan bağımsız manuel temiz-yedek kullanılabilirliği Bronze ürün geliştirmesidir. Silver yalnız mevcut altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyası yürütür.



## Build 193 bağlayıcı güncellemesi

DEC-083 ve ADR-066 Bronze ürün geliştirmesidir; Silver’a yeni özellik bırakılmaz ve kanal geçişi ürün sahibi kararı olmadan yapılmaz. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 bağlayıcı güncellemesi

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 bağlayıcı güncellemesi

Aktif temiz-yedek politika yürütme parametrelerinin dondurulması Bronze ürün güvenliği kapsamındadır; Silver tam platform doğrulaması NOT_RUN kalır.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — API önceliği ve anayasa üstünlüğü

P0: yedekleme, AI ve sistem için yaşamsal adapterlar. P1: çekirdek özelliği tamamlayan entegrasyonlar. P2: banka ve diğer kurum entegrasyonları; kararlı üretimden yaklaşık 5-6 ay sonra değerlendirilir. Build208'de `PROJECT-RULES-2026-08-01-V4` anayasa tabanıydı; Build214 itibarıyla `PROJECT-RULES-2026-08-01-V5` istisnasız güncel Proje Anayasasıdır ve yaşam döngüsü politikasının üzerinde güncel kullanıcı kararını temsil eder.

## Build 210 yaşam döngüsü bütünlüğü

Terminal clean-backup run ledger kanıtı tamamlandıktan sonra değiştirilemez. Bu veri-bütünlüğü kararı Bronze ürün geliştirmesidir ve kanal terfisi anlamına gelmez. DEC-100 / ADR-083 / Migrasyon 49 zinciri `PPT-LIFECYCLE-STRICT-V1` altında bağlayıcıdır.
