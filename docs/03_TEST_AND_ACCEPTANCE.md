# Test ve Kabul Stratejisi — Build 185

**Aktif sürüm:** 02.08.2026.228

Ayrıntılı kapı yönetişimi:
`docs/15_RELEASE_VALIDATION_GOVERNANCE.md`.

## Statü dürüstlüğü

- `PASS`: Bu build ve kaynak üzerinde gerçekten çalıştırıldı ve geçti.
- `FAIL`: Gerçekten çalıştırıldı ve başarısız oldu.
- `NOT_RUN`: Çalıştırılmadı; PASS değildir.
- `BLOCKED`: Önceki veya dış engel nedeniyle başlatılmadı.
- `DIAGNOSTIC_PASS`: Tanısal koşu; promotion kanıtı değildir.

Eski build sonucu yeni build’e otomatik taşınmaz.

## Test katmanları

- Domain birim testleri
- Application/use-case testleri
- Repository ve SQLite entegrasyon testleri
- IPC main/preload sözleşme testleri
- Yetki, audit, AI consent ve cihaz güvenliği testleri
- Zaman tüneli/önemli gün/arşiv uçtan uca regresyonları
- Yedek/restore, yanlış parola, marker hatası, yarım işlem ve çökme sonrası kurtarma senaryoları
- Electron güvenlik ve payload sınırları
- Başlangıç OS sır koruması turu, kalıcı sentinel, bozulma ve güvensiz anahtar reddi
- Gerçek Windows’ta aynı kullanıcı verisiyle iki süreçli DPAPI kalıcılık kanıtı
- Temiz kurulum, TypeScript, production build ve smoke
- Normal Windows kurulum/açılış/kaldırma
- Kullanılabilirlik, erişilebilirlik ve performans

## Test verisi

Gerçek aile verisi Bronze kaynak doğrulamalarında ve Silver tam test kampanyasında kullanılmaz. Sentetik aile ağaçları,
sahte belgeler ve anonim sağlık/finans kayıtları kullanılır. Gerçek veriye geçiş
Gold öncesi açık kullanıcı kabulü gerektirir.

## Ara Bronze artırımları

Kapsamlı UAT, toplu ekran görüntüsü ve son kullanıcı kılavuzu geliştirmeyi
engellemediği sürece toplu final hazırlığına ertelenebilir. Hedefli kontroller
yalnız gerçekten çalıştırılırsa raporlanır.

## Silver tam doğrulama kapıları — yeni ürün geliştirmesi yok

Temiz `npm ci`, tam `tsc --noEmit`, tüm testler, production build, smoke,
dependency audit, Windows sandbox’lı gerçek açılış, installer yaşam döngüsü,
yedek/restore, erişilebilirlik, ekran kanıtı ve kullanıcı dokümantasyonu aynı Silver kaynak teslimi üzerinde tamamlanmalıdır.

## Kritik kabul senaryoları

1. Aile yöneticisi başka yetişkinin özel sağlık/finans verisini izinsiz göremez.
2. Kişisel ve aile zaman tünelleri aynı olay ağından farklı izin filtreleriyle üretilir.
3. Etkinlik tüm bağlı yer, kişi, davetiye, belge, medya ve notları tutarlı açar.
4. AI yetkisiz veriyi arama/özet/öneride kullanmaz.
5. Bir yedek hedefi hatasında diğer hedefler devam eder.
6. Yeni cihaz veya geri yüklenen aynı cihaz, tüm güven kayıtları iptal edilerek yeniden kimlik ve cihaz doğrulaması ister.
7. Marker yazma hatası ve yarım commit mevcut doğrulanmış veri setini rollback ile korur.
8. `--no-sandbox` koşusu resmî Windows PASS sayılmaz.
9. İlk Windows açılışında oluşturulan OS korumalı sentinel ikinci ayrı süreçte DPAPI ile açılmadan development veya paketli açılış PASS sayılmaz.
10. Bozuk başlangıç sentineli sessizce yenilenmez ve uygulama veri deposunu açmaz.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 test sınırı

Bronze hedefli sözleşme 36, davranış 15 ve kontrollü TypeScript 3 kontrolden oluşur. Preflight 165 kontrolü en fazla sekizli 21 bağımsız segmente ayrılır. Temiz kurulum, tam TypeScript, bütün testler, production build, smoke, performans, güvenlik, kullanılabilirlik ve gerçek Windows/installer testleri Silver'da çalıştırılır.

## Build 184 kabul sınırı

Bronze kapısı sahte repository davranışına ek olarak gerçek `node:sqlite` sonuçlandırma regresyonunu zorunlu kılar. SQL bağlayıcı sayısı, başarı zamanı, hata sayacı, backoff, sahiplik reddi ve defter snapshotları doğrulanır. Gerçek disk kesintisi, temiz kurulum, production build ve Windows/installer testleri Silver'da NOT_RUN'dan çıkarılır.

## Build 185 kabul sınırı

Bronze hedefli kapılar; sözleşme yayılımı, 24 sentetik monotonik saat davranışı,
12 gerçek SQLite kalıcılık kontrolü ve 3 kontrollü TypeScript/geriye dönük
regresyondur. Kaynak preflight 173 kontrolü en fazla sekizer kontrollü bağımsız
segmentlere ayrılır. Gerçek Windows uyku/uyanma, saat ayarı, uzun disk I/O,
production build ve installer testleri Silver'da yürütülür.

## Build 186 kabul sınırı

Hedefli kabul; 27 davranış, 14 gerçek SQLite ve 3 kontrollü TypeScript/regresyon
kontrolüdür. Tam Windows saat değişikliği ve uyku/uyanma testleri Silver'dadır.

## Build 187 kabul sınırı

Bronze hedefli kabul; 20 kurtarma davranışı, 22 gerçek SQLite kronoloji kontrolü,
3 kontrollü TypeScript/regresyon ve Build 187 sözleşme kapısının PASS olmasıdır.
Final kaynak preflight 181 bağımsız kontrolü segmentli çalıştırır. Silver tam test
kampanyası NOT_RUN olarak ayrılır.

## Build 188 kabul sınırı

Kaynak kabulü; normal ve geri alınmış saat claim davranışı, güvenli zamanda durum yeniden hesaplama, backoff atlamama, saklama kesimi uyumu, politika/defter kronoloji tetikleyicileri, tek `running` indeks ve Build 187 regresyonunu kapsar. Gerçek Windows saat değiştirme provası Silver test kampanyasına aittir.

## Build 189 kabul sınırı

Kabul için aktif ayar kilidi, defter-güncelleme tabanlı kurtarma, terminal eşleme reddi ve kontrollü TypeScript regresyonu ayrı JSON kanıtları üretmelidir.


## Build 190 kabul sınırı

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 kabul sınırı

Manuel/otomatik attention, partial, failed, interrupted ve deferred gecikmeleri; repository ve gerçek SQLite tetikleyicileri hedefli test edilir.

## Build 192 kabul sınırı

Kabul; kapalı otomatik politikada manuel success/attention/deferred/failed yolları, otomatik skip, backoff korunumu, repository claim ayrımı, iki SQLite tetikleyicisi ve Build 191 regresyonunun ayrı JSON kanıtlarıyla PASS olmasını gerektirir.



## Build 193 kabul sınırı

Repository davranış, gerçek SQLite ve kontrollü TypeScript/regresyon kanıtları PASS olmadan Build 193 kaynak teslimi tamamlanamaz. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 kabul sınırı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 kabul sınırı

Aktif politika parametresi mutasyonlarının SQLite tarafından reddedilmesi ve normal terminal geçişin korunması hedefli kanıtlarla doğrulanır.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Yeni zorunlu sözleşme kapıları

Her buildde Project Provenance, Version Sweep, Personal Identity Sweep, Production Clean Data, Artifact Index, Documentation Closure ve Project Progress Report kontrolleri çalıştırılır. Silver öncesi ayrıca UI Visual Baseline doğrulaması zorunludur.

## Build 210 hedefli kabul — Terminal ledger immutability

Bronze hedefli regresyonu şu davranışları gerçek `node:sqlite` üzerinde kanıtlar: Build209 tabanında UPDATE/DELETE/REPLACE kaçışlarının yeniden üretimi, altı terminal statünün gerçek mutation reddi, nullable alan mutation reddi, terminal DELETE reddi, `recursive_triggers=0` altında REPLACE reddi, no-op UPDATE geçişi, `running → terminal` geçişinin yeni guard tarafından engellenmemesi, üç trigger kaydı ve Migrasyon 49 revision markerı. Tam Silver/Windows zinciri ayrıca çalıştırılmadıkça NOT_RUN kalır.
