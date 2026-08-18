# Sürüm Planı ve Kanal Kuralları — Build 183

**Aktif sürüm:** Bronze 04.08.2026.29

> 17.08.2026 güncellik bağı: 34-L yerel kapanış otomasyonu PASS kanıtları üretmiştir; ancak `allRoadmapPackagesAccepted=false`, `countsAsRequirementPass=false` ve dış/manuel kanıtlar `NOT_RUN` olduğundan Silver/Gold terfisi yoktur. Güncel özet `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md` içindedir.

**Katı politika:** `PPT-LIFECYCLE-STRICT-V1`

## Sürüm biçimi

- Uygulama: `GG.AA.YYYY.SIRA`
- Paket: `G.A.YYYY-SIRA`
- Build sırası proje boyunca kesintisiz artar; ay değişiminde 1’e dönmez.

## Bronze

Bütün yeni özellikler, geçmişte Silver veya Gold için planlanmış ürün kabiliyetleri, modüller, ekranlar, menü bağlantıları, veri modelleri, güvenlik kontrolleri ve yerel işlevler Bronze kanalında tamamlanır. Yeni ürün geliştirme için başka kanal yoktur.

Yalnız ağır haricî API üretim adaptörü geçici olarak askıya alınabilir. Erteleme; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının Bronze kaynakta hazır olmasını zorunlu kılar. Hedef kanal yine Bronze’dur.

## Silver

Silver yeni ürün özelliği kabul etmez. Mevcut altyapı iyileştirilir, hata düzeltmeleri yapılır ve temiz kurulum, tam TypeScript, birim/entegrasyon, Electron production build, smoke, güvenlik, performans, erişilebilirlik, yedek/restore, gerçek Windows ve installer testleri yürütülür.

`DEC-253` kapsamındaki animasyonlu kurulum, üç adımlı ilk açılış anlatımı ve F1 Sesli Yardım Merkezi Bronze kaynakta uygulanır. Silver'da yeni yardım özelliği eklenmez; gerçek Windows ekranları, Türkçe ses kalitesi, Narrator, tam klavye, büyütme, yüksek kontrast, hareket azaltma ve kullanıcı kabul testleriyle mevcut uygulama doğrulanır.

## Gold

Gold başarılı Silver doğrulamasından sonra hazırlanır. Yeni ürün özelliği geliştirilmez; üretim paketleme, kod imzası, SBOM/lisans, rollback, operasyon ve kritik üretim düzeltmeleriyle sınırlıdır.

## Değişiklik yetkisi

Bu kanal politikası katıdır ve açık ürün sahibi kararı olmadan esnetilemez. Her önemli karar Ana Karar Kaydı, Yetki Matrisi, ilgili uzmanlık belgesi, ADR, makine politikası, doğrulama sözleşmesi ve aktif teslim belgelerine aynı build içinde işlenir.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 kanal kararı

Otomatik temiz yedek yeniden yazımının bütün ürün davranışları Bronze kaynakta tamamlanmıştır. Silver'a yeni özellik taşınmaz; yalnız mevcut altyapı iyileştirilir ve tam test kampanyası yürütülür. Gold, başarılı Silver sonrası hazırlanır.

## Build 184 sürüm planı

Bronze Build 184 atomik sonuçlandırma kusurunu düzeltir ve kalıcı çalışma geçmişini tamamlar. Silver yeni ürün özelliği eklemeden tam TypeScript, birim/entegrasyon, production build, smoke, performans, güvenlik, kullanılabilirlik ve gerçek Windows/installer testlerini yürütür.

## Build 185 sürüm planı

Bronze Build 185 yedek yayılımı kronoloji kusurunu kapatır ve monotonik zaman
sözleşmesini tamamlar. Silver yeni ürün özelliği eklemeden gerçek Windows saat
ayarı/uyku, tam test, production build, smoke, performans ve installer kampanyasını
yürütür.

## Build 186 sürüm planı

Bağlı kronoloji ürün davranışı Bronze'da tamamlanır. Silver yeni özellik eklemeden
gerçek Windows saat, uyku/uyanma ve kesinti kampanyasını yürütür.

## Build 187 sürüm planı

Build 187, kesinti kurtarma ve geri çekilme kronolojisi ürün düzeltmesini Bronze
kaynağında tamamlar. Silver yeni özellik eklemeden temiz kurulum, tam test,
production build, smoke ve gerçek Windows/installer doğrulamasını yürütür.

## Build 188 sürüm planı

Bronze Build 188, geri alma güvenli temiz-yedek claim kronolojisini ve SQLite bütünlük sınırını tamamlar. Silver yeni ürün geliştirmesi içermez; temiz kurulum, tam test, production build, Windows saat/uyku/yeniden başlatma ve installer doğrulamasını yürütür.

## Build 189 sürüm planı

Build 189 Bronze kaynak geliştirmesidir. Windows saat değişimi, süreç sonlandırma, uyku/uyanma ve installer senaryoları Silver doğrulamasında yürütülür.


## Build 190 sürüm planı

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 sürüm planı

Tetikleyiciye duyarlı retry ürün davranışı Bronze içinde tamamlanır; Silver yalnız tam platform testlerini çalıştırır.

## Build 192 sürüm planı

Build 192 manuel temiz-yedek kullanılabilirliği ürün düzeltmesini Bronze kaynakta tamamlar. Silver yeni özellik eklemeden temiz kurulum, tam test, production build, smoke ve gerçek Windows/installer doğrulamasını yürütür.



## Build 193 sürüm planı

Build 193 Bronze ürün bütünlüğü geliştirmesidir. Silver yalnız tam test ve altyapı doğrulamasını yürütür; otomatik promotion yoktur. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 sürüm planı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 sürüm planı

Bronze teslimi hedefli kaynak doğrulamalarıyla paketlenir; Silver tam platform kapıları ayrı tutulur.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.


## Build 205 sürüm sürekliliği

Build numarası proje genelinde kesintisizdir. Tarih alanı gün/ay/yıl bilgisini taşır; son sayı önceki buildin bir fazlasıdır. Ay değiştiğinde sıra 1’e dönmez. Ana build defteri ve VERSION_LEDGER aynı güncel buildi göstermek zorundadır.

## Build 208 — API ve UI yayın önceliği

P0 API sınırları yedekleme, AI ve sistem için yaşamsal adapterlardır. P2 banka/kurum entegrasyonları kararlı üretimden yaklaşık 5-6 ay sonraya ertelenir. Silver, onaylı UI Görsel Referans Manifestosu ile gerçek ekran uyumu doğrulanmadan başlatılamaz.

## Build 210 yayın etkisi

Build 210 yalnız Bronze RC2 veri-bütünlüğü geliştirmesidir. Kanal terfisi oluşturmaz. Silver/Gold geçişi mevcut Anayasa V4 kapıları ve gerçek tam doğrulama zinciri olmadan yapılamaz.
