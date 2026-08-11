# Anadolu Parsı Aile Yaşam Merkezi
## Planlanan Bronze 03.08.2026.27 — Dağıtık Platform ve Yüksek Erişilebilirlik Sözleşmesi

> Durum: Bağlayıcı mimari kapsam girdisi. Bu dosya henüz tamamlanmış kaynak derlemesi veya PASS kanıtı değildir.

## 1. Kesin mimari karar

Windows masaüstü arayüzü artık sunucunun kendisi sayılmayacaktır. Ürün üç ana parçaya ayrılır:

1. **Anadolu Parsı Core Service** — Windows Hizmeti olarak 7/24 çalışan headless çekirdek.
2. **Anadolu Parsı Desktop** — Electron/React kullanıcı arayüzü; yerel Core Service’in istemcisidir.
3. **Anadolu Parsı Companion API** — macOS, iPhone, iPad, Watch ve Vision Pro istemcilerinin yetkili veri alacağı sürümlü ve güvenli API.

Mevcut TypeScript domain/application kodu korunur. Core Service ayrı bir TypeScript/Node uygulaması olarak çıkarılır. Windows hizmet yaşam döngüsü için ince bir native service host kullanılır; iş kuralları ikinci dilde yeniden yazılmaz.

## 2. Çoklu Windows düğüm modeli

### Güvenli kurulum profilleri

- **Tek Düğüm:** Bir ana Windows node. Otomatik failover yok; bağımsız yedek zorunlu.
- **İki Tam Node + Witness:** Ev/işyeri iki Windows node ve veri taşımayan üçüncü oy/witness. Bir node kaybında otomatik failover.
- **Üç Tam Node:** Üçü de şifreli tam replikadır; iki üye quorum oluşturur ve bir arıza tolere edilir.
- **Backup-only Node:** Veriyi şifreli yedekler, cluster yazma oyu kullanmaz.

İki node tek başına otomatik failover yapamaz; ağ kopması ile karşı tarafın gerçekten düşmesi ayırt edilemediğinde iki tarafın da lider olması split-brain yaratır. Bu nedenle üçüncü oy veya manuel failover gerekir.

### Yazma modeli

- Bütün node’lar çalışabilir ancak yalnız seçilmiş **leader** yazı kabul eder.
- Yazı çoğunluk tarafından kalıcı loga alınmadan kullanıcıya başarılı dönmez.
- Leader quorum kaybederse yazıları fail-closed reddeder ve güvenli read-only moda geçer.
- Eski leader’ın yazmasını engellemek için term/epoch ve fencing token kullanılır.
- Consensus sıfırdan yazılmaz; olgun ve denetlenmiş Raft implementasyonu native cluster-agent arkasında kullanılır.

## 3. Veri replikasyonu

SQLite dosyası paylaşılmaz. Her Windows node kendi yerel, şifreli SQLite projection’ını tutar. Değişiklikler append-only mutation log üzerinden çoğaltılır.

Her mutasyon en az şu alanları taşır:

- clusterId, familyId, mutationId ve idempotencyKey
- logIndex, leaderTerm ve entityVersion
- actorAccountId ve actorDeviceId
- commandType, schemaVersion ve createdAt
- payload hash, previous hash ve imza
- izin/amaç bağlamı ve correlationId

Arşiv medyası içerik adresli chunklar hâlinde, devam ettirilebilir ve hash doğrulamalı çoğaltılır. Metadata önce, büyük içerik daha sonra eşitlenebilir.

## 4. API katmanları

### Local Administration API

Yalnız aynı Windows makinesinde named pipe/loopback üzerinden Desktop UI, installer ve bakım araçları tarafından kullanılır.

### Companion Client API

- HTTPS
- mTLS cihaz kimliği
- Sürümlü REST/JSON veya CBOR
- OpenAPI sözleşmesi ve otomatik Swift/TypeScript istemci üretimi
- Delta sync, cursor, ETag/entityVersion ve idempotency
- WebSocket değişiklik bildirim akışı
- Typed error, retry-after ve rate limit

### Cluster Replication API

- mTLS üzerinden HTTP/2 gRPC/protobuf
- Raft log, snapshot, membership, health ve file-chunk akışları
- İnternete açık değildir; yalnız onaylı cluster node kimlikleri kullanır

## 5. Cihaz eşleme ve güvenlik

1. Yönetici kısa ömürlü QR/tek kullanımlık eşleme kodu üretir.
2. Apple/Windows cihazı kendi donanım korumalı anahtar çiftini oluşturur.
3. Core Service kullanıcı, aile, cihaz ve izin kapsamına bağlı sertifika verir.
4. Sonraki bağlantılar mTLS + kullanıcı oturumu + merkezi nesne yetkisiyle doğrulanır.
5. Cihaz kaybolursa sertifika, token, sync key ve cache yetkisi iptal edilir.
6. LAN’da olmak güven sağlamaz; keşif yalnız adres bulur.

## 6. Apple istemcileri

### İlk aşama

- macOS, iPhone ve iPad salt-okunur companion.
- Apple Watch yalnız özet, durum ve bildirim.
- Vision Pro ilk aşamada salt-okunur aile panosu/hatıra deneyimi.
- Hiçbiri cluster voter, bağımsız veri kaynağı veya otomatik yetki otoritesi değildir.

### Yerel ağ

Bonjour/mDNS ile servis bulunur; Apple yerel ağ izni reddedilirse QR ve manuel bağlantı kullanılabilir. ATS istisnası açılmaz; bağlantı HTTPS ve güvenilir/pinlenmiş sertifikadır.

### Arka plan

Apple işletim sistemi uygulamayı sürekli açık tutmaz. BGTask ve APNs yalnız uyandırma/yenileme fırsatı sağlar; teslim ve zaman garanti değildir. Bu nedenle istemci:

- açılışta delta sync,
- planlı background refresh,
- content-free APNs wake,
- son doğrulanmış offline cache,
- son sync zamanı ve stale uyarısı

kullanır. APNs özel anahtarı son kullanıcı Windows uygulamasına gömülemez; push için minimum içerikli bir sağlayıcı/control-plane servisi gerekir.

## 7. Yerel ve uzak erişim

### LAN Direct

Öncelikli ve en hızlı yoldur. Bonjour keşfi + mTLS HTTPS.

### Remote Relay

Varsayılan kapalıdır. Router’a port açtırmak yerine Windows node dışarı doğru güvenli bağlantı kurar. Relay yalnız rendezvous, şifreli trafik iletimi ve push/witness metadata’sı görür; aile içeriğini çözemez.

### User-managed VPN

Tailscale/WireGuard veya kurum VPN’i gibi kullanıcı yönetimli bağlantılar için adapter sınırı bulunur. Ürün belirli sağlayıcıya kilitlenmez.

## 8. Control plane ve data plane ayrımı

**Data plane:** aile kayıtları, arşiv, finans, sağlık ve sync payloadları. Uçtan uca/taşıma şifreli ve yalnız yetkili cihazlarca çözülebilir.

**Control plane:** cluster membership, sertifika iptali, device registry, rendezvous, APNs wake, witness vote ve sağlık metadata’sı. Minimum veri ilkesi uygulanır.

## 9. Arıza davranışları

- Leader düşerse quorum yeni leader seçer.
- Quorum yoksa yazı durur, doğrulanmış son veri read-only gösterilir.
- Follower gecikmesi görünürdür; çok gerideyse snapshot ile yeniden kurulur.
- Disk doluysa node yazıdan çekilir, diğer node’lar etkilenmez.
- Bozuk projection karantinaya alınır ve log/snapshot’tan yeniden üretilir.
- Sertifika süresi yaklaşınca otomatik yenileme; başarısızsa görünür uyarı.
- Crash loop’ta safe mode; körlemesine sonsuz restart yok.
- Saat farkı election ve token sürelerini bozuyorsa node degraded olur.

## 10. Replica yedek değildir

Replikasyon donanım arızasına karşı süreklilik sağlar; yanlış silme, uygulama hatası ve ransomware tüm replikalara yayılabilir. Bu nedenle:

- yerel sürümlü yedek,
- harici disk,
- offsite/OneDrive,
- immutable veya değiştirilemez saklama,
- düzenli restore provası

aynı şekilde zorunlu kalır.

## 11. Güncelleme modeli

1. Quorum ve yedek health kontrolü.
2. Follower node’lar birer birer güncellenir.
3. State hash ve replication catch-up doğrulanır.
4. Lider kontrollü devredilir.
5. Eski lider son güncellenir.
6. N-1 protokol/schema uyumluluğu korunur.
7. Migration yalnız geçerli lider ve quorum sağlıklıyken çalışır.
8. Başarısız güncellemede rollback yapılır.

## 12. Sağlık ve operasyon ekranı

Her node için:

- Rol ve leader term
- Uptime ve son heartbeat
- Commit index ve replication lag
- Projection state hash
- CPU/RAM/disk ve disk ömrü uyarısı
- Sertifika ve key epoch
- Son snapshot/yedek/restore provası
- API, queue, scheduler ve external dependency durumu
- Son hata, failover ve bakım işlemi

gösterilir. Kullanıcı “bu cihaz kapanırsa ne olur?” sorusunun cevabını tek ekranda görür.

## 13. Hedef hizmet seviyeleri

- **3 tam node:** committed write RPO hedefi 0; otomatik failover RTO hedefi 30–120 saniye.
- **2 tam node + witness:** committed write RPO hedefi 0; otomatik failover RTO hedefi 30–180 saniye.
- **2 node witness olmadan:** otomatik failover yok; manuel ve güçlü doğrulamalı promotion.
- **1 node:** otomatik failover yok; yedekten restore hedefi cihaz ve veri boyutuna bağlıdır.

Bu değerler tasarım hedefidir; Silver gerçek fault-injection testleriyle ölçülmeden PASS sayılmaz.

## 14. Bronze ve platform sınırı

Bronze’da tamamlanacak:

- Core Service ayrıştırması
- Client/cluster API sözleşmeleri
- device pairing ve sertifika altyapısı
- mutation log, sync, snapshot ve file replication
- leader/follower/witness mimarisi
- local discovery ve remote adapter sınırı
- Apple Swift client SDK/reference simulator
- cluster health/admin UI
- failover ve fault-injection test altyapısı

Tam native Apple ürün ekranları Windows Gold sonrasında ayrı platform geliştirme kanallarında yapılabilir; fakat onları besleyecek protokol, güvenlik ve referans istemci Bronze’da gerçek olmalıdır.

## 15. İlerleme ve süre etkisi

Önceki geniş kapsam için hesaplanan yaklaşık %46,7, yeni dağıtık platform kapsamı eklendiğinde **%39–42** aralığına iner. Bunun nedeni mevcut kaynakta gerçek server API, companion sync ve cluster katmanının bulunmamasıdır.

Tahmini ek odaklı iş:

- Core Service ve service host: 8–12 gün
- API, pairing, sertifika ve SDK: 8–12 gün
- Replicated log, snapshot ve file sync: 12–18 gün
- Raft/witness/fencing/failover: 12–18 gün
- Health, update, remote adapter ve fault tests: 8–12 gün

Paralellik sonrası dağıtık platformun Bronze etkisi **35–50 odaklı iş günü**dür. Genel Bronze tahmini **90–125 iş günü**, Silver dağıtık test/düzeltme **30–45 iş günü**, Gold kapanışı **7–12 iş günü** olarak güncellenir. Tam Apple uygulamaları bu hesaba dahil değildir.

## 16. İlk kodlama sırası

1. Core Service process boundary ve Desktop’ın local client’a dönüştürülmesi.
2. Cluster/domain contractları ve mutation envelope.
3. Local HTTPS/mTLS API ve device pairing.
4. Outbox’tan replicated mutation log’a geçiş.
5. İki node replication + manual promotion.
6. Witness/Raft, fencing ve automatic failover.
7. Snapshot, file chunk sync ve node bootstrap.
8. Cluster Health/Admin ekranı.
9. Apple Swift SDK ve reference read-only client simulator.
10. Remote relay/control plane adapter sınırı.
11. Fault-injection ve rolling update doğrulamaları.

## 17. Zorunlu bitiş metni

- Kanal: Bronze
- Planlanan görünür sürüm: Bronze 03.08.2026.27
- Kaynak kod durumu: Bu belgede değiştirilmedi
- Dağıtık platform kod durumu: YOK / BAŞLANMADI
- Güncellenmiş Bronze ilerleme tahmini: %39–42
- Silver’a geçiş: YASAK / HAZIR DEĞİL
- Sonraki tek resmi iş: Core Service process boundary ve FEATURE_REALITY_GATE ile ilk kaynak derlemesini başlatmak
- Bitiş cümlesi: Bu teslim mimari kapsam ve karar belgesidir; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
