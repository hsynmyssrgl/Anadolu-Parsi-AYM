# PPK-016 türetilmiş veri politika mirası tehdit modeli

## Korunan sınır

PPK-016; OCR metni, arama indeksi, küçük resim, özet, embedding, çeviri, transkript, AI hafızası, cache ve replica gibi türevlerin kaynaklarından daha düşük hassasiyetle veya daha geniş erişimle oluşturulmasını engeller. Paket gerçek OCR/AI motoru çalıştırmaz ve türev payload saklamaz; yalnız politika kararı ile değişmez kaynak–türev metadata bağını kurar.

Korunan ana sınıf, kullanıcı kaynağının semantik içeriğinden üretilen ve kaynak çağrısı bittikten sonra bağımsız adreslenebilen veya yeniden kullanılabilen retained/reusable semantic materialization’dır. Aşağıdaki sınıflar ayrı güven sınırlarıdır:

- `LIVE_PROJECTION`: tek yetkili çağrıda hesaplanır, backend’de saklanmaz ve çağrılar arasında yeniden kullanılmaz.
- `TRANSACTION_JOURNAL`: aynı kasa ve aynı ya da daha dar yetki sınırında atomik geri alma, bütünlük veya audit amacıyla tutulur.
- `PRIMARY_RECORD`: kendi resource kimliği, güncel politika kararı ve yaşam döngüsü olan first-class iş kaydıdır.
- `OPERATIONAL_ARTIFACT`: kullanıcı kaynağının semantik payloadını taşımayan operasyonel tanı/sağlık telemetrisidir.
- `WHOLE_VAULT_BACKUP`: kaynak payload ile politika/receipt kayıtlarını birlikte taşıyan, bağımsız plaintext görünüm sağlamayan korumalı `.pptbackup` konteyneridir.

Bir üretim yolu bu niteliklerden sapıp çağrılar arasında reusable kullanıcı semantiği materialize ederse sınıf etiketi geçersiz olur ve PPK-016 fail-closed binding sınırı zorunlu hâle gelir. Kanonik sınıflandırma `config/32-l-ppk-016-derived-data-production-inventory.json` içindedir.

## Güven varsayımları

- Kaynak politika kararları geçerli Platform Policy receipt, context hash, request hash, policy package hash ve karar otoritesine bağlıdır.
- Repository işlemleri yalnız aktif policy-authorized transaction context içinde çalışır.
- Türev üreticisi, merkezi inheritance use-case izin vermeden payload üretimini veya metadata mühürlemeyi başlatamaz.
- Kaynak politikası bulunamıyor, doğrulanamıyor veya güncel değilse güvenli varsayım ret kararıdır.

## Tehditler ve kontroller

| Tehdit | Fail-closed kontrol |
|---|---|
| Hassasiyet düşürme | Türev hassasiyeti bütün kaynakların en yüksek seviyesinden düşük olamaz. |
| Veri sınıfı çıkarma | Türev sınıfları kaynak sınıflarının kanonik birleşimini eksiksiz içerir. |
| İzin genişletme | Hesap, uygulama, capability, eylem ve amaç kümeleri kaynak kümelerinin kesişimiyle sınırlandırılır. |
| Yükümlülük düşürme | `no_cache`, `no_export`, `no_ai`, `local_processing_only`, `online_only` ve diğer kısıtlar birleşimle devralınır. |
| Saklama süresini uzatma | En erken kaynak retention/expiry sınırı türevin üst sınırıdır. |
| Çapraz aile/hane/dal | Kaynaklar ve türev aynı politika kapsamına exact bağlı değilse karar reddedilir. |
| Sahte veya stale lineage | Kaynak kimliği, sürümü, içerik SHA-256, receipt/context/request hash ve kaynak politika hash'i binding hash'ine katılır. |
| Diskte producer/source receipt ikamesi | Her binding okumasında producer ve bütün source receipt zarfları imzalı receipt hash'inden başlayarak canonical record, request/context, kimlik, aile, karar, paket ve zaman bağlarıyla yeniden doğrulanır; eksik veya bozuk provenance fail-closed reddedilir. |
| Tarihsel receipt'i güncel grant sayma | Read-back sırasında source-to-producer `0..30.000 ms` creation chronology yeniden doğrulanır; fakat güncel erişim ayrıca aktif current target/source PEP ister. Tarihsel receipt tek başına grant/revocation kanıtı değildir. |
| Self-declared veya resetlenmiş upstream lineage | Türetilmiş source exactly-one sealed upstream bindinge type/id/version/content/family üzerinden bağlanır; upstream producer/source receipt zinciri recursive doğrulanır. Upstream yokluğu yalnız depth=0 ve boş ata kümeli primary source için geçerlidir; ambiguous, reset, eksik/fazla ata ve bozuk upstream reddedilir. |
| Policy rotation ile gevşetme | Aynı yeni inheritance kararında source/target version ve package exact kalır. Tarihsel upstream ile current source arasında sürüm/hash eşitliği aranmaz; current receipt kendi paketine exact bağlı olur ve source politikası upstream targettan semantik olarak daha gevşek olamaz. |
| Ata fan-out ile traversal tüketimi | Kanonik transitive ata kümesi ve recursive stored-lineage traversal en çok 512 distinct kayıtla, derinlik ayrıca 16 seviye ile sınırlandırılır; 513'üncü ata callback/read açılmadan reddedilir. |
| Kısmi çok-kaynak yetkisi | 1–32 kaynağın tamamı geçerli olmadan callback ve repository yazımı açılmaz. |
| Döngü ve self-reference | Yinelenen kaynak, türevin kendisini kaynak göstermesi, ata döngüsü ve 16’dan büyük derinlik reddedilir. |
| TOCTOU ve sonradan değiştirme | Metadata önce `pending`, tüm kaynaklar bağlıyken `sealed` olur; sealed binding ve kaynak satırları değişmezdir. |
| Receipt ikamesi | Migration 77 kaynak ve oluşturma receipt hash’lerini mevcut değişmez receipt kayıtlarına bağlar. |
| Bozuk kalıcı veri | Kanonik JSON, sayım, hash, sensitivity ve zaman biçimi hem repository hem SQLite CHECK/trigger sınırında doğrulanır. |
| Renderer/cache sızıntısı | Güvenlik duruşu IPC’si sıfır argümanlı ve no-cache’tir; genel türetilmiş IPC paylaşımları kaynak zarfı taşımadıkça cache dışıdır. |
| “Live” adı altında kalıcı türev | Projection backend’de veya çağrılar arasında tutuluyorsa `LIVE_PROJECTION` sayılmaz; sealed binding ve güncel PEP olmadan persistence reddedilir. No-cache tek başına politika mirası kanıtı değildir. |
| Public AI helper bypass’ı | `ai-memory` public kök exportu kaldırılmıştır; production import ve `buildAiTimelineContext` çağrıları statik kaynak kapısında reddedilir. |
| Family-import preview payload cache’i | `CachedPreviewLease` kaynak metni, parse document, preview veya plan taşıyamaz; apply sırasında kaynak stat/SHA-256, yeniden parse ve plan digest yeniden doğrulanır. |
| Plaintext kasa replikası | Production `.db` export hedefi reddedilir; eski raw use-case/adapter composition dışında tutulur. Yalnız korumalı `.pptbackup` tüm SQLite kaynağı ve politika kayıtlarını birlikte taşır. |
| Journal etiketiyle yetki genişletme | Data-repair/person-lifecycle snapshot, import summary, automation run ve archive result durumu yalnız kaynak mutation’ın aynı kasa ve aynı/daha dar yetkili işlem kaydı olarak kalabilir. Bağımsız kullanıcı görünümü veya reusable semantik payload üretirse PPK-016’ya girer. |
| Primary record etiketiyle kaynak kopyalama | Automation yalnız LIFE kaynağını kabul eder ve kaynağı güncel receipt-bound LIFE PEP üzerinden yeniden doğrular. Üretilen private task kaynak `title/dueAt` değerlerini taşımaz; yalnız bağımsız rule başlığı ve sabit not saklanır. Kaynak semantiği yeniden eklenirse sealed binding zorunludur. |
| Non-life automation ledger sızıntısı | Non-LIFE rule create/execute/list fail-closed reddedilir. Ledger API kaynak `title/dueAt` kabul etmez; kalıcı uyumluluk sütunları redacted title ve transaction `createdAt` taşır. Görünür LIFE alanları yalnız güncel PEP joininden canlı üretilir. |
| Archive `resultJson` içinde semantik payload | Semantik result erişimi ve replay kaldırılmıştır. Kalıcı `result_json` sabit `{status:completed}` değeridir; yalnız one-way `resultHash` ve işlem kimliği okunabilir. Retry exact güncel kalıcı receipt sonrası content-free conflict döndürür. |
| Telemetry etiketiyle kullanıcı içeriği sızdırma | Health history ve diagnostic artefakt kullanıcı metni, görseli, ilişkisi veya sağlık içeriğini materialize edemez. Cihaz anahtarlı koruma yalnız ayrı kriptografik/operasyonel sınır kanıtıdır; PPK-016 inheritance kanıtı değildir. |
| Korumalı yedeği inheritance kanıtı sayma | `.pptbackup` kaynak ve politika kayıtlarını aynı korumalı konteynerde taşır; bu yalnız kriptografik/ayrı kasa sınırıdır ve tekil türevlerin current-PEP/sealed binding mirasını kanıtlamaz. |
| Çevrimdışı yetki aşımı | PPK-012 capability lease süresi, cihaz/hesap/aile/paket bağları ve kilit davranışı korunur; `no_cache` kaynağı cache’e alınamaz. |
| Doğrudan SQL/repository/kasa erişimi | PPK-013 statik çiti ve merkezi uygulama servisi zorunluluğu korunur. |

## Kapsam dışı

PPK-017 hassas log yasağının, PPK-018 değişmez audit zincirinin ve PPK-019 fiziksel silme/retention yayılımının tam kapanışı bu pakette yapılmaz. Gerçek OCR, thumbnail, embedding, AI, çeviri veya transkript üretimi; gerçek veri backfill’i; dış ağa payload gönderimi; Desktop vault/SQLite sahiplik aktarımı ve Core Service cutover kapsam dışıdır.

## Doğrulama durumu

Tehdit modeli `VALIDATED / COMPLETE` durumundadır. Üretim envanteri `activeUngovernedDerivedPayloadOwners=0`, `openBlockerCount=0` ile kapanmıştır. Read-time provenance, exact upstream, monotonic rotation ve 512 ata/traversal kontrolleri 75/75 hedefli testte; bütün üretim ve regresyon sınırı 66 dosya/540 testte doğrulanmıştır. Source gate 18 zone/335 dosya/23 ilgili kaynak, 23 kötü niyetli ve 4 iyi huylu öz-sınamada 0 bulgu vermiş; root TypeScript 0 hata ve production build zinciri PASS olmuştur. Final contract 109/109 ve 15 komutluk runtime kanıt demeti 15/15 PASS sonucuyla kapanmıştır. Bu doğrulama gerçek payload üretimi, veri taşıma/backfill, SQLite sahiplik aktarımı, cutover veya PPK-019 fiziksel silme yayılımı iddiası değildir.
