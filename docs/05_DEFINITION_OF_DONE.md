# Tamamlanmış Sayılma Ölçütü — Build 182

**Aktif sürüm:** 02.08.2026.228

## İş/özellik tamamlanma ölçütü

Bir özellik yalnız aşağıdakiler sağlandığında tamamlanmış kabul edilir:

- Kabul ölçütü ve kullanıcı akışı uygulanmıştır.
- Yetki, veri sahipliği, AI izni ve hassasiyet etkisi değerlendirilmiştir.
- Application/domain/repository sınırları korunmuştur.
- Gerekli migration ve rollback yaklaşımı tanımlanmıştır.
- Hedefli test veya sözleşme gerçekten çalıştırılmış ve sonucu raporlanmıştır.
- Audit olayı gerekiyorsa üretilmiştir.
- Hata/boş/yükleme/yetkisiz durumları kullanıcıya anlaşılırdır.
- Türkçe metin, merkezi tipografi ve erişilebilirlik standardına uyar.
- İlgili `DEC-xxx`, kapsam, güvenlik, UI veya test belgesi güncellenmiştir.
- Kişisel veri, sır veya token loglara yazılmaz.

## Build tamamlanma ölçütü

- Sürüm tüm workspace ve aktif belgelerde senkronizedir.
- Build durumunda gerçek PASS/FAIL/NOT_RUN sınırı korunur.
- Hedefli Build sözleşmesi geçer.
- Kaynak manifesti ve SHA-256 kaynak ağacıyla eşleşir.
- Deterministik kaynak ZIP oluşturulur ve doğrulanır.
- Aktif teslim belgeleri güncel build dosyalarına referans verir.

## Final tamamlanma ölçütü

Bronze artırımı tamamlanmış olabilir; bu Bronze Final anlamına gelmez. Final için
`docs/15_RELEASE_VALIDATION_GOVERNANCE.md` içindeki tüm promotion kapıları ve
açık ürün sahibi onayı gerekir.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.

## Build 184 tamamlanma ölçütü

DEC-074/ADR-057 yayılımı, migrasyon 30, atomik repository sonucu, kalıcı çalışma geçmişi, görünür UI, gerçek SQLite regresyonu, segmentli kaynak kapıları, bütünlük, deterministik ZIP ve bağımsız teslim tasdiki birlikte PASS olmadan Build 184 tamamlanmış sayılmaz.

## Build 185 tamamlanma ölçütü

DEC-075/ADR-058 yayılımı, işlem sonrası final zaman üretimi, hedef bazlı karantina
zamanı, geriye giden saat reddi, gerçek SQLite kalıcılığı, segmentli kaynak
kapıları, bütünlük, deterministik ZIP ve bağımsız teslim tasdiki birlikte PASS
olmadan Build 185 tamamlanmış sayılmaz.

## Build 186 tamamlanma ölçütü

Başarı/kısmi temiz-yedek kaydı propagation kimliği olmadan oluşamıyor, final zaman
propagation tamamlanmasından önce olamıyor ve bu kurallar gerçek SQLite kanıtıyla
doğrulanıyorsa Bronze kaynak ölçütü karşılanır.

## Build 187 tamamlanma ölçütü

Kesilmiş çalışma saat geri alma koşulunda `running` durumundan çıkmalı; kurtarma
ve sonraki deneme zamanları kalıcı başlangıçtan önce olmamalı; sahiplik ve durum
kombinasyonları SQLite tarafından korunmalı; karar DEC-077/ADR-060 ve bütün
aktif belgelerde izlenebilir olmalıdır.

## Build 188 tamamlanma ölçütü

Güvenli claim zamanı kalıcı kronoloji üst sınırından türetilmeli, bekleyen kayıtlar bu zamanda yeniden hesaplanmalı, geri çekilme atlanmamalı, repository saklama kesimini doğrulamalı ve SQLite geriye giden/değiştirilen/eşzamanlı claim kayıtlarını reddetmelidir. Hedefli kaynak kanıtları PASS olmadan Build 188 tamamlanmış sayılmaz.

## Build 189 tamamlanma ölçütü

Aktif politika ayarı değiştirilemiyor, ileri çalışma-defteri zamanı kurtarmayı kilitlemiyor, terminal çelişki atomik reddediliyor ve hedefli kaynak kapıları PASS ise Bronze kapsamı tamamlanır.


## Build 190 tamamlanma ölçütü

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 tamamlanma ölçütü

21 davranış, 22 gerçek SQLite ve 3 kontrollü TypeScript/regresyon kapısı PASS olmadan Build 191 tamamlanmış sayılmaz.

## Build 192 tamamlanma ölçütü

Otomatik politika kapalıyken manuel claim ve terminal sonuçları kalıcı olarak doğrulanmalı; otomatik claim reddedilmeli; backoff ve tek sahiplik korunmalı; repository ve SQLite kanıtları PASS olmalıdır.



## Build 193 tamamlanma ölçütü

Yetim/mismatched çalışan satırların reddi, geçerli claim/tamamlama akışının korunması, 205 preflight kontrolü ve dört teslim dosyası zorunludur. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 tamamlanma ölçütü

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 tamamlanma ölçütü

Aktif parametre mutasyonları fail-closed reddedilir, normal terminal geçiş korunur ve deterministik teslim üretilir.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 205 ve sonraki bütün buildler için zorunlu ana defter ölçütü

- Güncel build `config/master-build-ledger.json` içinde bulunur.
- Build başlangıcında durum `IN_PROGRESS`, teslim öncesinde `COMPLETED` olarak işaretlenir.
- Yapılan iş özeti ve kanıt dosyaları build kaydına eklenir.
- Kapatılan/açılan kalan işler aynı build içinde güncellenir.
- Kullanıcıya verilen build sonrası durum bildirimi `lastStatusNotification` alanına kaydedilir.
- `docs/17_MASTER_BUILD_LEDGER.md` JSON kaynağından yeniden üretilir ve birebir eşleşir.
- `verify:build-ledger` PASS olmadan build tamamlanmış veya teslim edilmiş sayılamaz.

## Build 208 — Build kapanış ek ölçütleri

Build; Ana Build Defteri, güncel Anayasa SHA’sı, Artifact Index, ilerleme tahmini, etkilenmiş aktif belgeler ve Master DOCX/PDF güncel olmadan tamamlanamaz. Bronze Final’de işlevsiz UI ve iptal edilmiş/erişilemeyen production kodu bulunamaz.

## Build 210 özel kapanış kriteri

OPEN-001 ancak Migrasyon 49 kaynakta kayıtlı, terminal UPDATE/DELETE/REPLACE koruması hedefli sözleşme ve gerçek SQLite runtime testinde PASS, DEC-100/ADR-083 ve yetkili teknik sözleşmeler güncel, Ana Build Defteri `OPEN-001=COMPLETED` ve Build210 teslim kanıtları üretilmişse kapanır. No-op UPDATE ve normal `running → terminal` davranışının korunduğu ayrıca kanıtlanır.
