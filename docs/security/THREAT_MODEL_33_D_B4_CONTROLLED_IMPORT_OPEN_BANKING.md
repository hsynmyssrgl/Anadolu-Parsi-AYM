# 33-D B4-13/B4-14 kontrollü içe aktarma ve ÖHVPS tehdit modeli

## Varlıklar ve güven sınırları

- Yerel kullanıcının seçtiği finans hareketi dosyası ve geçici ayrıştırılmış hücreler.
- Finans kategori, batch ve append-only hareket defterleri.
- Merkezi finance PEP kararı, kalıcı işlem makbuzu, audit ve outbox.
- Ana süreç dosya diyaloğu ile sandbox preload/renderer arasındaki IPC sınırı.
- Ağsız `ohvps-v1-local` adapter sözleşmesi ve sentetik sandbox verisi.

## Tehditler ve kontroller

| Tehdit | Kontrol |
|---|---|
| Dosya yolu veya ham banka ekstresinin renderer'a sızması | Dosya seçimi/okuma ana süreçte; renderer yalnız opaque preview kimliği, başlık ve en fazla 20 örnek satır alır. Dosya yolu IPC sözleşmesinde yoktur ve ham dosya baytları saklanmaz. Ayrıştırılmış satırların süre sonuna kadar ana süreç belleğinde kaldığı ve örnek hücrelerin renderer'a gösterildiği iki ayrı truth alanıyla açıklanır. |
| Aşırı büyük/zip-bomb dosyasıyla kaynak tüketimi | 5 MiB dosya, 5.000 satır, 64 sütun, 2.000 karakter/hücre, 128 ZIP girdi, 10 MiB/girdi ve 20 MiB toplam açılmış içerik çitleri. |
| XLSX makro, formül veya dış varlık çalıştırılması | Yalnız ilk sayfanın veri XML'i ayrıştırılır; formül denetimi arşivdeki bütün worksheet XML'lerine uygulanır. Formül, VBA, externalLinks, connections, DOCTYPE/ENTITY, şifreleme ve desteklenmeyen yöntem fail-closed reddedilir. Hiçbir hücre kod olarak çalıştırılmaz. |
| Bozuk veya yol kaçışlı XLSX | Merkez dizin/lokal header, normalize yol, boyut ve CRC32 doğrulaması; `..` kök kaçışı ve çift ad reddi. |
| Hatalı eşleme veya tutar/tarih yönü | Exact IPC alanları; üç açık tutar modeli; sütun benzersizliği; katı para gruplama/işaret ayrıştırması; gerçek takvim günü kontrolü; XLSX 1900/1904 epoch ayrımı; para birimi, sıfır/üst tutar ve gelir/gider kategori uyumu application katmanında yeniden doğrulanır. Harfli tutar, çelişkili negatif işaret ve 29.02.1900 sahte seri tarihi reddedilir. |
| Parola, token veya kart sırrının önizlemeye girmesi | Başlık satırı parola/password, token, secret, credential, PIN, CVV/CVC benzeri hassas alan adları içeriyorsa örnek hücreler oluşturulmadan önce dosya fail-closed reddedilir. |
| Süresi dolan veya başka oturuma ait preview'nun kullanılması | Main IPC composition her preview'yu renderer sender kimliği, doğrulanmış hesap ve aileden türetilen opaque owner tokenına bağlar; resolve/consume aynı tokenı ister. Login, logout ve session lock tüm preview'ları temizler. Ayrı timer 15 dakikada parsed satırları siler; process kapanışında `dispose` çalışır. |
| Aynı hareketin yeniden içe alınması veya başka ailedeki parmak izinin yanlış eşleşmesi | Canonical SHA-256 parmak izi aile, sahip, kaynak dosya hash'i ve satır numarası namespace'ini içerir. Böylece aynı kaynak satırı için batch-içi set, yetkili `family_id` lookup ve kalıcı `UNIQUE(family_id,row_fingerprint)` exact replay çiti uygulanırken farklı dosyalardaki benzer meşru hareketler sessizce atlanmaz. |
| Sahip, gizlilik veya kategori sahteciliği | Aile üyesi ve kategori lookup; merkezi authorization; sahip/gizlilik/yön mirası; SQLite parent guard. |
| Aileler arası okuma veya tekrar varlığı sızıntısı | Batch, hareket, kategori ve parmak izi sorguları aktif policy receipt'in `resourceFamilyId` alanına SQL düzeyinde bağlanır; adapter ayrıca satır ailesini uygulama bağlamıyla eşleştirir. |
| Receipt'siz, replay veya yarım paket yazımı | Tek exact finance create receipt ve privacy→sensitivity bağı; doğrudan INSERT yalnız staging kabul eder; bütün finans tablolarına çift yönlü replay trigger'ları; staging batch + satır sayısı doğrulanmış exact seal aynı transaction içinde. |
| Geçmiş hareket/batch değiştirilmesi | Entry update/delete guard; batch yalnız staging→committed exact seal güncellemesine izin verir. |
| Audit/outbox sızıntısı | Olay yalnız batch kimliği, sahip, kaynak modu, sayımlar ve gizlilik taşır; tutar, açıklama, harici kimlik, dosya hash'i ve fingerprint taşımaz. |
| Sentetik sandbox'ın gerçek banka bağlantısı sanılması | UI ve domain görünümü `synthetic_local`, `liveBankConnection:not_implemented`, `networkAccess:not_performed`, `credentialCollection:prohibited` alanlarını gösterir. |
| Kimlik bilgisi/token toplanması veya gizli ağ çıkışı | Adapter portunda kimlik bilgisi alanı ve ağ istemcisi yoktur; IPC'de token/sertifika alanı yoktur. Sınırlı dosya okuma için dört yeni yüzey PPK-022 exact manifestinde açıkça kayıtlıdır; network egress değişmez. Manuel OFX/QFX fallback yalnız UTF-8 olarak çözülebilen metin kabul eder; dosya header'ına dayalı legacy charset dönüşüm desteği uygulanmamıştır. |

## Kalan risk ve dürüst sınır

Kullanıcı yanlış sütun veya kategori seçebilir; kontrollü örnek önizleme, açık eşleme
ve atomik reddetme bu riski azaltır fakat finansal doğruluk garantisi vermez. Dosya
kaynağı banka tarafından doğrulanmaz. Canlı ÖHVPS bağlantısı uygulanmamıştır; gelecekte
eklenirse ayrı kimlik, rıza, sertifika, ağ çıkışı, iptal ve tehdit modeli gerekir.
