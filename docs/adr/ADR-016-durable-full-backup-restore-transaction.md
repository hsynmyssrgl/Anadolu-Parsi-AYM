# ADR-016 — Dayanıklı Tam Yedek Geri Yükleme İşlemi

- Durum: Kabul edildi
- Tarih: 27.07.2026
- Build: 131
- İlgili karar: DEC-045

## Bağlam

Tam yedek geri yükleme; canlı SQLite veritabanını, dijital kasa anahtarını ve
şifreli arşiv dizinini birlikte değiştirmektedir. Önceki akış aynı proses içinde
rollback yapabilse de uygulama kapanması, elektrik kesintisi veya güvenli giriş
işaretinin yazılamaması gibi durumlarda işlem aşaması kalıcı olarak bilinmiyordu.
Ayrıca geri yüklenen veritabanındaki güvenilir cihaz kayıtlarının yeni veya aynı
cihazda otomatik güven taşımaması açıkça uygulanmalıydı.

## Karar

Geri yükleme aşağıdaki kalıcı işlem aşamalarıyla yürütülür:

1. `prepared`
2. `live-moved`
3. `staged-installed`
4. `committed`

Her aşama `restore-transaction.json` dosyasına atomik geçici dosya, `fsync` ve
yeniden adlandırma ile yazılır. Canlı bileşenler işlem kimliğine bağlı rollback
yollarına taşınır. Yeni bileşenler kurulduktan sonra yeniden giriş ve cihaz
yetkilendirme işareti kalıcı yazılmadan rollback kopyaları silinmez.

Uygulama başlangıcında açık işlem günlüğü bulunursa:

- `committed` ve eksiksiz canlı set için yalnız artık rollback/staging dosyaları
temizlenir.
- Diğer aşamalarda eski doğrulanmış set geri alınır.
- Yol ve işlem kimliği eşleşmeyen günlük fail-closed reddedilir.

Commit öncesinde staged SQLite veritabanındaki tüm aktif `trusted_devices`
kayıtları iptal edilir ve `restore_reauthorization_required=1` metadata kaydı
yazılır. Böylece yedek aynı cihazda açılsa bile eski güven kaydı MFA atlamasına
neden olmaz.

## Sonuçlar

- Marker yazma hatası mevcut veriyi kaybettiremez.
- Proses çökmesi sonrası geri yükleme deterministik biçimde tamamlanır veya geri
alınır.
- Yeni cihaz ve geri yüklenen aynı cihaz yeniden parola/2FA doğrulaması yapar.
- Commit sonrası temizlik hatası veri commitini geri almaz; bir sonraki açılışta
tamamlanır.
- Gerçek Windows installer ve elektrik kesintisi provası Final/Silver kapısında
yeniden çalıştırılacaktır.
