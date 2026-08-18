# Sürüm ve Doğrulama Yönetişimi — Build 183

**Aktif sürüm:** Bronze 04.08.2026.29

> 17.08.2026 güncellik bağı: Yerel boundary/contract/runtime/test/build PASS sonuçları gerçek cihaz, gerçek sağlayıcı, hukuk-gizlilik, sertifikasyon veya üretim UAT kanıtı değildir. `NOT_RUN`, `PARTIAL`, `BLOCKED` ve `countsAsRequirementPass=false` hiçbir zaman terfi PASS'i sayılamaz; güncel kanıt özeti `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md` içindedir.

> DEC-251 belge kapısı: Her yeni kararın DEC, makine defteri, etkilenen aktif belgeler ve iş listesi açık/kapalı/neden alanları aynı değişiklikte güncellenmeden kapanış yasaktır. DEC-252 sonrasında tarihsel build/arşiv/checkpoint içeriği tekrar denetlenmez; yalnız aktif ve yeni belgeler bu kapıya girer.

## 1. Kanal modeli

| Kanal | Amaç | Gerçek veri |
|---|---|---|
| Bronze | Bütün ürün geliştirmeleri; ağır API adaptörlerinde altyapı-hazır erteleme istisnası | Sentetik/yerel geliştirme verisi |
| Silver | Yeni özellik olmadan altyapı iyileştirme, hata düzeltme ve bütün testler | Sentetik/anonim veri |
| Gold | Yeni özellik olmadan üretim, imza, rollback ve operasyon | Kullanıcı onayıyla gerçek veri |

Güncel durum **Bronze RC2 Active Development**’tır.

## 2. Kanal geçiş kuralı

- Silver/Gold için planlanmış olanlar dahil bütün yeni geliştirmeler Bronze kanalında tamamlanır.
- Yalnız ağır haricî API üretim adaptörleri, Bronze-hazır mimari yeterlilikle askıya alınabilir; Silver’da yeni özellik eklenmez.
- Silver, mevcut altyapı iyileştirmesi ve bütün testlerin yürütüldüğü doğrulama sürümüdür.
- Silver testlerinin tamamı başarılı olursa ve ürün sahibi onay verirse Gold üretim sürümü hazırlanır.

## 3. Statü sözlüğü

- `PASS`: Kapı bu build ve kaynak üzerinde gerçekten çalıştırıldı ve geçti.
- `FAIL`: Kapı gerçekten çalıştırıldı ve başarısız oldu.
- `NOT_RUN`: Kapı çalıştırılmadı; PASS değildir.
- `BLOCKED`: Dış/önceki kapı engeli nedeniyle başlatılamadı.
- `DIAGNOSTIC_PASS`: Güvenliği veya resmî koşulu değiştiren tanı koşusu geçti; promotion kanıtı değildir.
- `INCOMPLETE`: Kısmi kanıt vardır ancak kapı tamamlanmamıştır.

## 4. Bronze artırımı

Her Bronze build için asgari olarak:

- sürüm ve aktif belge sözleşmesi
- hedefli mimari/ürün/güvenlik doğrulaması
- kaynak bütünlüğü
- deterministik arşiv ve SHA-256
- gerçek kapı statüleri

üretilir. Ara buildlerde tam UAT, ekran görüntüsü ve kullanıcı kılavuzu ertelenebilir.

## 5. Silver tam doğrulama kapıları

1. Source preflight
2. Temiz resmî `npm ci`
3. Tam root `tsc --noEmit`
4. Birim ve entegrasyon testleri
5. Electron production build
6. Blocking smoke zinciri
7. Dependency ve build-tool audit
8. Normal Windows’ta sandbox’lı development açılışı
9. Paketli uygulama gerçek açılışı
10. Geçici kurulum, kurulu açılış ve kaldırma
11. Installer doğrulaması
12. Yedek/restore provası
13. Erişilebilirlik ve kullanıcı akışları
14. Toplu ekran görüntüsü ve kullanıcı dokümantasyonu

Bir kapı başarısızsa sonraki Silver doğrulama kapıları `NOT_RUN` veya `BLOCKED` kalır.

## 6. Windows ortam sınırı

`--no-sandbox` tanı koşusu resmî açılışın yerini alamaz. Yönetilen hostta GPU veya
sandbox alt süreç hatası oluşması açıkça ortam engeli olarak raporlanır. Silver doğrulaması için
normal Windows bilgisayarda sandbox’lı gerçek açılış PASS olmalıdır.
Windows açılış kanıtı aynı kullanıcı veri diziniyle iki ayrı süreç çalıştırmalı;
ilk süreç `created`, ikinci süreç `verified` başlangıç sentineli üretmelidir.
`windows-dpapi`, şifreleme turu ve renderer sandbox politikası kanıtta PASS değilse
açılış kapısı tamamlanmış sayılmaz.

## 7. Silver kapıları

- Geniş sentetik aile senaryoları
- Yetki yükseltme ve veri sızıntısı saldırı testleri
- Çocuk, yetişkin ve yaşlı kullanılabilirlik testleri
- WCAG ve platform erişilebilirlik kontrolleri
- Büyük soy ağacı, arşiv ve zaman tüneli performansı
- Yedek hedefi arızası ve restore provası
- Uzun süreli kararlılık
- Ekran ve kullanıcı kabul kanıtı

## 8. Gold kapıları

- Kritik/P0/P1 hata yok
- SBOM ve lisans incelemesi
- Authenticode/kod imzası
- Rollback ve felaket kurtarma
- Hukuki/gizlilik incelemesi
- Test/geliştirici menülerinin kapatılması
- Ürün sahibinin açık release onayı

## 9. Belge dürüstlüğü

Her build yeni sürüme geçirilirken eski PASS/FAIL sonucu otomatik taşınmaz.
Kapı yeniden çalıştırılmadıysa `NOT_RUN` olarak sıfırlanır. Aktif teslim özeti,
Build durumu, doğrulama raporu ve makine kanıtı aynı statüyü taşımalıdır.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 doğrulama yönetişimi

165 kaynak kontrolü 21 bağımsız segmente ayrılır ve her segment sonucu ayrı JSON kanıtına yazılır. Başarılı segment yeniden çalıştırılmaz. Deterministik ZIP ve ayrık tasdik yalnız bütün segmentler, kaynak bütünlüğü ve aktif belge sözleşmeleri PASS olduktan sonra üretilir.

## Build 184 doğrulama yönetişimi

Kaynak preflight 169 kontrolü en fazla sekizer kontrollü bağımsız segmentlere ayrılır. Build 184 hedefli kapılar sözleşme, servis davranışı, gerçek SQLite regresyonu ve kontrollü TypeScript'tir. Başarılı segment yeniden çalıştırılmaz; ZIP ve tasdik bütün segmentler tamamlanmadan üretilmez.

## Build 185 doğrulama yönetişimi

Kaynak preflight 173 kontrolü en fazla sekizer kontrollü bağımsız segmentlere
ayrılır. Build 185 hedefli kapılar sözleşme, monotonik kronoloji davranışı, gerçek
SQLite kalıcılığı ve kontrollü TypeScript/regresyondur. Başarılı segment yeniden
çalıştırılmaz; ZIP ve tasdik bütün segmentler tamamlanmadan üretilmez.

## Build 186 doğrulama yönetişimi

Build 186 hedefli sözleşme, davranış, gerçek SQLite ve kontrollü TypeScript
kanıtları ayrı JSON dosyalarıdır. Final preflight en fazla sekiz kontrollü
segmentlere bölünür; yalnız başarısız/tamamlanmayan segment tekrarlanır.

## Build 187 doğrulama yönetişimi

Build 187 kaynak preflight'ı 181 kontrolü en fazla sekizerli bağımsız segmentlere
ayırır. Her segment JSON kanıtı üretir; başarılı segment yeniden çalıştırılmaz.
ZIP ve ayrık tasdik yalnız bütün segmentler, final manifest ve doğrulama sınırı
tamamlandıktan sonra oluşturulur.

## Build 188 doğrulama yönetişimi

Build 188 Bronze kaynak kapıları dört ayrı kanıt üretir: sözleşme yayılımı, davranış, gerçek SQLite ve kontrollü TypeScript/regresyon. Tam Windows saat değiştirme, uyku/uyanma ve installer testleri çalıştırılmadan PASS gösterilemez; doğrulama sınırında NOT_RUN kalır.

## Build 189 doğrulama yönetişimi

Build 189 hedefli kapıları sözleşme, repository/SQLite davranışı, doğrudan SQLite ve kontrollü TypeScript/regresyondur. Final preflight en fazla sekizerli bağımsız segmentlere ayrılır.


## Build 190 doğrulama yönetişimi

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 doğrulama yönetişimi

Dört Build 191 kanıtı preflight ve ayrık tasdik sözleşmesine eklenir; yalnız gerçekten çalıştırılan kapılar PASS sayılır.

## Build 192 doğrulama yönetişimi

Dört Build 192 kanıtı preflight ve ayrık tasdik sözleşmesine eklenir. Final preflight 201 kontrolü en fazla sekizerli bağımsız segmentlerde çalıştırır; yalnız başarısız veya tamamlanamayan segment yeniden çalıştırılır.



## Build 193 doğrulama yönetişimi

Dört hedefli Build 193 kanıtı preflight ve ayrık tasdik sözleşmesine bağlanır. PASS yalnız gerçekten çalıştırılan kontrole verilir. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 doğrulama yönetişimi

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 doğrulama yönetişimi

Hedefli sözleşme, repository, gerçek SQLite ve kontrollü TypeScript kanıtları bağlayıcıdır.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Anayasal teslim kapıları

Build kapanışı Project Provenance, Version Sweep, Personal Identity Sweep, Production Clean Data, Artifact Index, Documentation Closure ve Project Progress Report kanıtlarını gerektirir. Bu kapılardan biri FAIL/NOT_RUN ise Build 208 kapsamı tamamlandı gösterilemez. Silver/Windows kapıları ayrıca gerçek çalıştırma gerektirir.

## Build 210 doğrulama yönetişimi

Terminal ledger immutability için hedefli SQLite PASS kanıtı Bronze kapanışında zorunludur. Bu PASS, temiz npm ci, tam TypeScript, tüm testler, Electron build, smoke veya Windows installer kapılarının yerine geçmez; çalıştırılmayan kapılar NOT_RUN kalır.
