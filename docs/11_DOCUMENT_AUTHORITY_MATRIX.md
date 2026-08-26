# Belge Yetki ve İzlenebilirlik Matrisi — Bronze 04.08.2026.29

**Aktif sürüm:** Bronze 04.08.2026.29

**Güncel master sürüm:** `docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_17.08.2026_V1.docx/.pdf`
**Güncel birleşik kaynak:** `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`

## Yetkili aktif belgeler

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md` | DEC-090–DEC-252 karar dizini, 208 kanonik kural, paket/iş akışı ve açık kanıt matrisi | En güncel birleşik çalışma kaydı |
| `config/documentation-synchronization-policy.json` | Her kararın DEC + etkilenen aktif belgeler + iş listesi açık/kapalı/neden alanlarıyla aynı değişiklikte güncellenmesi | Fail-closed karar-belge eşzamanlılık otoritesi |
| `docs/current/12_TUM_BELGE_TURLERI_DENETIMI.md` | Tüm belge türlerinin son temel ve aktif denetim özeti | DEC-252 sonrasında tarihsel içerik yeniden incelenmez |
| `docs/10_MASTER_DECISION_REGISTER.md` | Build228'e kadar karar anlatımı; sonraki karar dosyaları için tarihsel başlangıç kaydı | Güncel birleşik sicile bağlı tarihsel/yardımcı kayıt |
| `docs/00_SCOPE_FREEZE.md` | Ürün sınırı, kullanıcılar, modüller ve kapsam dışı alanlar | Aktif kapsam tabanı |
| `docs/01_TECHNICAL_STACK.md` | Platform, teknoloji ve katman seçimi | Aktif teknik taban |
| `docs/02_SECURITY_BASELINE.md` | Kimlik, yetki, Electron, AI ve veri güvenliği | Zorunlu güvenlik tabanı |
| `docs/03_TEST_AND_ACCEPTANCE.md` | Test katmanları ve kabul kapıları | Doğrulama politikası |
| `docs/04_RELEASE_PLAN.md` | Bronze/Silver/Gold ve promotion kuralları | Yayın yönetişimi |
| `docs/05_DEFINITION_OF_DONE.md` | İş ve build tamamlanma ölçütü | Tamamlanma sözleşmesi |
| `docs/06_OPEN_ITEMS_AFTER_CODING_START.md` | Açık, ertelenmiş ve dış bağımlı maddeler | Aktif risk/gap kaydı |
| `docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md` | Gereksinim → kod → kanıt eşleştirmesi | Bronze izlenebilirlik |
| `docs/09_ACTIVE_DEVELOPMENT_STATUS.md` | Güncel kanal ve build davranışı | Aktif geliştirme durumu |
| `docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md` | 17 ürün modülü, 5 yönetişim yüzeyi ve fonksiyon sınırları | Ürün kataloğu |
| `docs/13_UI_UX_ACCESSIBILITY_STANDARD.md` | Görsel dil, tipografi ve erişilebilirlik | UI kabul standardı |
| `docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md` | Güvenlik, mahremiyet, yedek ve kurtarma | Uzmanlık standardı |
| `docs/15_RELEASE_VALIDATION_GOVERNANCE.md` | PASS/FAIL/NOT_RUN ve kapı sırası | Kanıt yönetişimi |
| `docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md` ve `config/product-lifecycle-policy.json` | Katı Bronze/Silver/Gold ve ağır API erteleme kuralları | Esnetilemez yaşam döngüsü sözleşmesi |
| `docs/FAMILY_DATA_IMPORT_V1.md` ve `docs/adr/ADR-029-validated-family-data-import-and-controlled-rollback.md` | Aile verisi içe aktarma şeması, atomiklik ve geri alma sınırı | Build 146 bağlayıcı veri aktarım sözleşmesi |
| `docs/LARGE_FAMILY_READ_MODEL_PERFORMANCE_V1.md` ve `docs/adr/ADR-030-keyset-pagination-and-bounded-rendering.md` | Büyük soy ağacı, zaman tüneli ve arşiv okuma performansı | Build 147 bağlayıcı büyük veri okuma sözleşmesi |
| `SECURITY.md` | Güvenlik bildirim özeti | Dışa dönük güvenlik özeti |
| `CONTRIBUTING.md` | Değişiklik kuralları | Katkı sözleşmesi |
| `BUILD_STATUS.md` | Güncel build ve gerçek doğrulama durumu | Operasyonel durum |
| `docs/17_MASTER_BUILD_LEDGER.md` ve `config/master-build-ledger.json` | Build 1’den güncel builde kadar yapılanlar, kalan işler ve tek devam noktası | Build 205 sonrası zorunlu süreklilik kaydı |
| `docs/security/BRONZE_OPEN021_OPEN022_CLOSURE_BUILD228.md` ve `config/bronze-open-closure-status.json` | OPEN-021/022 resmî kapanışı ve exact Build227 kanıt SHA bağları | Build228 bağlayıcı Bronze closure kaydı |

| `docs/EXTERNAL_EVIDENCE_ROOT_TRUST_VERIFICATION_V1.md` ve `docs/adr/ADR-055-out-of-band-dual-evidence-root-trust-verification.md` | Haricî kanıt sağlayıcısı kök anahtarının kurum dışı çift kanıtla doğrulanması | Build 182 bağlayıcı güven töreni |

| `docs/CLEAN_BACKUP_REWRITE_TRIGGER_AWARE_BACKOFF_V1.md` ve `docs/adr/ADR-064-trigger-aware-clean-backup-rewrite-backoff.md` | Tetikleyiciye duyarlı temiz-yedek geri çekilme ve SQLite retry bütünlüğü | Build 191 bağlayıcı retry sözleşmesi |

## Tarihsel belgeler

Aşağıdaki belgeler silinmez ancak yeni geliştirmede doğrudan bağlayıcı değildir:

- 20 Temmuz 2026 tarihli Belge Paketi v1.x/v2.0 PDF ve DOCX’leri
- Eski `Panthera pardus tulliana` adını taşıyan belgeler
- MVP ve önceki Bronze Build durum/sürüm notları
- Eski Code Freeze veya erken kapsam kayıtları
- Geçmiş doğrulama kanıtları

Tarihsel belge, aktif kayda aykırıysa aktif karar uygulanır. Tarihsel kanıtın
üzerine yazılmaz; yeni revizyon oluşturulur.

`DEC-252` gereği 17 Ağustos 2026 kapsamlı taraması tarihsel içerik için son temeldir. Bundan sonra eski build, arşiv ve checkpoint belgeleri yeniden okunmaz, render edilmez veya semantik güncellik denetimine sokulmaz; yalnız `HISTORICAL` sınıfında korunur. Yeni kontroller aktif ve yeni belgelere uygulanır.

## Belge güncelleme akışı

1. Karar `DEC-xxx` kimliği ve makine defteri kaydıyla aynı değişiklikte kaydedilir.
2. Etkilenen kapsam/mimari/güvenlik/UI/test belgesi ile iş listesinin açık/kapalı/neden alanları aynı değişiklikte güncellenir.
3. Gereksinim izlenebilirlik tablosuna kod veya plan karşılığı eklenir.
4. Aktif teslim belgeleri sürümle eşleştirilir.
5. Hedefli belge yönetişimi doğrulaması çalıştırılır.
6. Güvenlik kararlarında ilgili ADR ve kaynak sözleşmesi güncellenir.
7. Kaynak manifesti ve deterministik ZIP yeniden üretilir.
8. `scripts/verify-documentation-synchronization-policy.mjs` PASS değilse karar veya iş tamamlanmış sayılamaz.

## Çelişki kontrolleri

Aktif belgelerde aşağıdakiler hata sayılır:

- Aktif ürün adı dışında yeni marka kullanımı
- Otomatik Final/Silver/Gold iddiası
- Çalıştırılmayan doğrulamanın PASS gösterilmesi
- Aile yöneticisinin tüm özel verilere erişebileceği varsayımı
- Yatırım uygulaması kapsamının aile uygulamasına karıştırılması
- Apple font dosyalarının projeye gömülmesi
- Yedekten dönen yeni cihazın otomatik güvenilir sayılması
- Güvenlik kontrolünün kayıtsız biçimde zayıflatılması
- Normal Windows PASS kanıtının tanısal `--no-sandbox` koşusuyla değiştirilmesi
- OS korumalı başlangıç sentinelinin hata durumunda sessizce sıfırlanması
- Dijital kasa anahtarının açık yerel dosyada tutulması veya restore sırasında eski cihaz DPAPI zarfının taşınması

- Kalıcı imhanın arşivleme, saklama süresi, geri alma penceresi veya güçlü yeniden doğrulama atlanarak çalıştırılması
- SQLite güvenli silmenin SSD, bulut veya yedeklerde mutlak fiziksel imha olarak sunulması


## Build 138 bağlayıcı ek karar

- `docs/adr/ADR-023-backup-quarantine-retention-legal-hold-and-destruction.md`
  yönetilen yedek karantinasının saklama, bekletme ve nihai imha güvenlik sınırıdır.
- Karantinanın süre dolmadan, bekletme varken, güçlü doğrulama veya manifest
  bütünlük kontrolü olmadan silinmesi belge çelişkisi ve güvenlik hatası sayılır.
- 90 günlük varsayılan süre yasal tavsiye veya nihai hukuk kararı olarak sunulamaz.

## Build 140 bağlayıcı ek karar

- `docs/adr/ADR-025-signed-external-backup-destruction-evidence.md` güvenilen
  Ed25519 sağlayıcı anahtarları ve imzalı imha makbuzlarının güven sınırıdır.
- Özel anahtarın uygulamaya alınması, RSA/belirsiz algoritma kabulü, kanonik
  olmayan makbuz, replay korumasının atlanması veya iptal edilen sağlayıcının
  hâlâ doğrulanmış gösterilmesi belge çelişkisi ve güvenlik hatasıdır.
- Geçerli imza fiziksel imhanın mutlak kanıtı olarak sunulamaz.

## Build 146 bağlayıcı ek karar

- Renderer aile verisi dosya yolu veya ham içeriği gönderemez.
- Ön izleme doğrulaması geçmeden ve güçlü yeniden doğrulama yapılmadan kayıt uygulanamaz.
- Kısmi içe aktarma kalıcı bırakılamaz; transaction hatası tüm batch yazımlarını geri alır.
- Sonradan bağımlılık oluşmuş kayıtlar geri alma sırasında sessizce silinemez.

## Build 147 bağlayıcı ek karar

- Soy ağacı, zaman tüneli ve arşiv için renderer başlangıcında sınırsız/tam liste yüklenemez.
- Sayfa boyutu 20–200 dışında olamaz; offset yerine kararlı anahtar imleci kullanılır.
- Olay ve arşiv read-model sonuçları nesne izin filtresi atlanarak döndürülemez.
- İmleç yetkilendirme kanıtı olarak kullanılamaz ve görünüm türleri arasında taşınamaz.
- Üretim veya Windows performansı yalnız bellek içi `node:sqlite` kanıtıyla PASS sayılamaz.

## Build 155 bağlayıcı ek karar

- `docs/adr/ADR-032-bounded-bootstrap-and-screen-lazy-loading.md` ve
  `docs/BOUNDED_BOOTSTRAP_AND_LAZY_LOADING_V1.md` başlangıç veri yükleme sınırıdır.
- Renderer oturum açılışında tam `getSnapshot()` veya bütün ikincil modül listelerini
  aynı toplu çağrıda yükleyemez.
- Dashboard olay ön izleme payload'ı 6 yaklaşan + 4 son kayıt sınırını aşamaz.
- Çalıştırılmamış gerçek Windows başlangıç performansı kaynak sözleşme kanıtıyla
  PASS gösterilemez.

## Build 156 bağlayıcı ek karar

- `docs/adr/ADR-033-searchable-keyset-entity-catalogs.md` ve
  `docs/SEARCHABLE_ENTITY_CATALOGS_V1.md` ortak kişi/olay seçimlerinin veri yükleme
  sınırıdır.
- Katalog kullanan ekran veya modal tam kişi/olay koleksiyonunu yalnız seçenek
  üretmek için yükleyemez.
- Sayfa boyutu 10–100 ve lookup kapsamı tür başına en fazla 100 kimliktir.
- Katalog imleci yetkilendirme kanıtı sayılamaz; olay izni ayrıca uygulanır.
- Çalıştırılmamış gerçek Windows render veya production build sonucu kaynak
  sözleşme kanıtıyla PASS gösterilemez.

## Katı yaşam döngüsü politikası — Build 208

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.
## Build 180 bağlayıcı ek karar

- `PPT-LIFECYCLE-STRICT-V1` bütün aktif bilgi ve belgelerde zorunludur.
- Silver veya Gold için yeni ürün özelliği planlamak belge çelişkisidir; ürün geliştirmesi Bronze’a taşınır.
- Ağır API ertelemesi yedi mimari yeterlilik alanından biri eksikse geçersizdir.
- ADR-052 sürüm rengi ve varsayılan aile yakınlık kataloğu kararları kalıcı ürün sözleşmeleridir.
- Tarihsel build belgeleri değiştirilmez; güncel politika için yetkili kaynak değildir.

| `docs/adr/ADR-054-protected-periodic-revocation-sync-state.md` | DEC-071, korumalı periyodik iptal listesi eşitlemesi ve süre uyarıları | Bağlayıcı | `PPT-LIFECYCLE-STRICT-V1` |

## Build 182 bağlayıcı ek karar

- `docs/adr/ADR-055-out-of-band-dual-evidence-root-trust-verification.md` ve
  `docs/EXTERNAL_EVIDENCE_ROOT_TRUST_VERIFICATION_V1.md`, DEC-072'nin bağlayıcı
  mimari ve operasyon sözleşmesidir.
- Kök Ed25519 anahtarının tek kanala, yalnız yönetici beyanına veya anahtar
  metninden farklı bir parmak izine dayanarak güvenilir yapılması belge çelişkisi
  ve güvenlik hatasıdır.
- Kimlik kanıtı ile parmak izi kanıtı aynı referans olamaz; tanık ve kontrol zamanı
  atlanamaz.
- Ham kurum belgesi, özel anahtar veya sır verisi doğrulama makbuzuna alınamaz.
- Eski anahtarın `legacy_unverified` uyarısını gizlemek veya imzasız ardıl anahtarı
  `rotation_inherited` göstermek yasaktır.

## Build 183 bağlayıcı ek karar

- `docs/adr/ADR-056-automatic-clean-backup-rewrite-and-quarantine.md` ve
  `docs/AUTOMATIC_CLEAN_BACKUP_REWRITE_V1.md`, DEC-073'ün bağlayıcı mimari,
  güvenlik ve operasyon sözleşmesidir.
- Doğrulanmış yeni yedek oluşmadan eski yönetilen kopyayı silmek veya karantinaya
  taşımak belge çelişkisi ve güvenlik hatasıdır.
- Kesintiyi, etkin hedef yokluğunu veya yüksek yük ertelemesini sessiz başarı
  göstermek yasaktır.
- Manuel ve yönetilmeyen haricî kopyalar otomatik temiz yeniden yazım kapsamına
  alınamaz.

| `docs/adr/ADR-056-automatic-clean-backup-rewrite-and-quarantine.md` | DEC-073, otomatik temiz yedek yeniden yazımı, geri çekilme ve karantina | Bağlayıcı | `PPT-LIFECYCLE-STRICT-V1` |

## Build 184 bağlayıcı ek karar

- `docs/adr/ADR-057-atomic-clean-backup-rewrite-finalization-ledger.md` ve `docs/CLEAN_BACKUP_REWRITE_FINALIZATION_LEDGER_V1.md`, DEC-074'ün bağlayıcı teknik, güvenlik, UI ve test sözleşmesidir.
- Politika ile çalışma defterini ayrı veya sahiplik doğrulaması olmadan sonuçlandırmak belge çelişkisi ve veri bütünlüğü hatasıdır.
- Yalnız sahte repository testiyle gerçek SQLite sonuçlandırma kapısını PASS göstermek yasaktır.
- Tarihsel Build 183 belgeleri değiştirilmez; Build 184 aktif politika ve kaynak sözleşmeleri üstündür.

| `docs/adr/ADR-057-atomic-clean-backup-rewrite-finalization-ledger.md` | DEC-074, atomik sonuçlandırma ve kalıcı çalışma defteri | Bağlayıcı | `PPT-LIFECYCLE-STRICT-V1` |

## Build 185 bağlayıcı ek karar

- `docs/adr/ADR-058-monotonic-managed-backup-propagation-chronology.md` ve `docs/MANAGED_BACKUP_PROPAGATION_CHRONOLOGY_V1.md`, DEC-075'in bağlayıcı teknik, güvenlik ve test sözleşmesidir.
- Yayılım tamamlanma zamanını hedef işlemlerinden önce üretmek belge çelişkisi ve denetim bütünlüğü hatasıdır.
- Tombstone tamamlama zamanı kalıcı propagation çalışma tamamlanma zamanından farklı olamaz.
- Tarihsel Build 184 belgeleri değiştirilmez; Build 185 aktif politika ve kaynak sözleşmeleri üstündür.

| `docs/adr/ADR-058-monotonic-managed-backup-propagation-chronology.md` | DEC-075, monotonik yedek yayılım kronolojisi | Bağlayıcı | `PPT-LIFECYCLE-STRICT-V1` |

| `docs/CLEAN_BACKUP_REWRITE_LINKED_CHRONOLOGY_V1.md` | Bağlı temiz-yedek/propagation kronoloji sözleşmesi | Aktif teknik ve güvenlik sözleşmesi |
| `docs/adr/ADR-059-linked-clean-backup-rewrite-chronology.md` | Bağlı kronoloji mimari kararı | DEC-076 uygulama otoritesi |

## Build 187 yetki güncellemesi

| Kayıt | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-077` | Kesinti kurtarma güvenli zaman ve geri çekilme sırası | Ana karar |
| `docs/adr/ADR-060-restart-safe-clean-backup-rewrite-recovery.md` | Mimari gerekçe ve repository sınırı | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_RECOVERY_CHRONOLOGY_V1.md` | Uygulama/SQLite kurtarma sözleşmesi | Teknik sözleşme |

## Build 188 yetki güncellemesi

| Kayıt | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-078` | Yeni temiz-yedek çalışmasının geri alma güvenli sahiplenme zamanı | Ana karar |
| `docs/adr/ADR-061-rollback-safe-clean-backup-rewrite-claim.md` | Uygulama, repository ve SQLite sahiplenme sınırı | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_CLAIM_CHRONOLOGY_V1.md` | Güvenli claim, saklama kesimi ve kullanıcı tanısı sözleşmesi | Teknik sözleşme |

## Build 189 yetki güncellemesi

| Kayıt | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-079` | Aktif politika izolasyonu ve terminal durum bütünlüğü | Ana karar |
| `docs/adr/ADR-062-clean-backup-rewrite-operational-isolation.md` | Uygulama, repository ve SQLite operasyonel sınırı | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_OPERATIONAL_ISOLATION_V1.md` | Ayar kilidi, ledger-floor kurtarma ve terminal eşleme | Teknik sözleşme |


## Build 190 yetki güncellemesi

| Kayıt | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-080` | Yayılımsız temiz-yedek terminal ve retry zamanı | Ana karar |
| `docs/adr/ADR-063-monotonic-clean-backup-rewrite-terminal-chronology.md` | Monotonik saat mimarisi ve fail-closed sınırı | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_TERMINAL_CHRONOLOGY_V1.md` | Uygulama ve test sözleşmesi | Teknik sözleşme |

## Build 192 yetki güncellemesi

| Kayıt | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-082` | Otomatik politika kapalıyken manuel temiz-yedek kullanılabilirliği | Ana karar |
| `docs/adr/ADR-065-manual-clean-backup-rewrite-availability.md` | Servis, repository ve SQLite sahiplenme ayrımı | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_MANUAL_AVAILABILITY_V1.md` | Manuel/otomatik etkinlik ve güvenlik sözleşmesi | Teknik sözleşme |



## Build 193 yetkili sözleşmesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/CLEAN_BACKUP_REWRITE_RUNNING_LEDGER_IDENTITY_V1.md` ve `docs/adr/ADR-066-running-clean-backup-ledger-owner-identity.md` | Çalışan temiz-yedek defteri policy-owner kimliği ve SQLite fail-closed koruması | Build 193 bağlayıcı veri bütünlüğü sözleşmesi |
| `docs/adr/ADR-067-clean-backup-rewrite-claim-reservation.md` | Temiz-yedek claim rezervasyonu, tek kullanımlık sahiplik kanıtı ve değiştirilemez iş yükü başlangıç bağı | Build 194 / DEC-084 bağlayıcı mimari karar kaydı |


## Build 195 yetki güncellemesi

| Kayıt | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-085` | Aktif temiz-yedek sahiplik anlık görüntüsü | Ana karar |
| `docs/adr/ADR-068-immutable-active-clean-rewrite-ownership-snapshot.md` | Repository ve SQLite mutasyon sınırı | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_ACTIVE_OWNERSHIP_SNAPSHOT_V1.md` | Politika, rezervasyon ve çalışma defteri eşleşme sözleşmesi | Teknik sözleşme |

## Build 196 yetki güncellemesi

| Belge | Yetki |
|---|---|
| `DEC-086` | Aktif temiz-yedek politika parametre bütünlüğü ana kararı |
| `docs/adr/ADR-069-immutable-active-clean-rewrite-policy-parameters.md` | Repository ve SQLite mutasyon sınırı |
| `docs/CLEAN_BACKUP_REWRITE_ACTIVE_POLICY_PARAMETERS_V1.md` | Teknik sözleşme |

## Build 197 yetki güncellemesi

DEC-087 ve ADR-070 bağlayıcıdır. `CLEAN_BACKUP_REWRITE_ATOMIC_TERMINAL_TRANSITION_V1.md` atomik terminal geçişi için ürün ve teknik sözleşmedir.


## Build 198 yetki güncellemesi

DEC-088, ADR-071 ve `CLEAN_BACKUP_REWRITE_TERMINAL_CHRONOLOGY_MONOTONICITY_V1.md` bağlayıcıdır.

## Build 205 bağlayıcı ek karar

- `docs/17_MASTER_BUILD_LEDGER.md`, `config/master-build-ledger.json`, `config/master-build-ledger-policy.json` ve ADR-078 tek build süreklilik sözleşmesidir.
- Ana defter güncellenmeden, güncel build `COMPLETED` yapılmadan ve build sonrası durum bildirimi kaydedilmeden teslim tamamlanmış sayılamaz.
- Geçmiş tamamlanmış build satırları değiştirilemez; düzeltme yeni build kaydıyla yapılır.
- Yeni sohbet ve geliştirme oturumları ana build defterinden başlar.

## Build 208 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/18_PROJECT_CONSTITUTION_V4.md` | Build209 dönemindeki Proje Anayasası V4 çerçevesi (tarihsel temel) | V5 tarafından devralınan tarihsel temel |
| `config/project-constitution.json` | Makine okunur anayasa kapıları | Fail-closed |
| `config/ui-visual-reference-manifest.json` + `docs/ui/` | UI baseline | Silver öncesi zorunlu |
| `config/project-progress-model.json` | Build-sonu ilerleme/ETA modeli | Her build zorunlu |
| `PROJECT_ARTIFACT_INDEX.md/.json` | Tüm proje bilgi ve teslim indeksi | Her build zorunlu |
| `docs/current/MASTER_PROJECT_DOCUMENTATION_BUILD208.docx/.pdf` | Build208 kapanış paket dokümantasyonu (tarihsel) | Tarihsel kanıt |

20.07.2026 öncesi belge ve sohbetler bu proje için yetkili tarihsel kaynak dahi sayılmaz; proje yanıtlarında bağlam olarak kullanılmaz.

## Build 210 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `DEC-100` | Terminal clean-backup run ledger kanıt değişmezliği | Ana karar |
| `docs/adr/ADR-083-clean-backup-terminal-ledger-immutability.md` | SQLite UPDATE/DELETE/REPLACE fail-closed mimarisi | Bağlayıcı ADR |
| `docs/CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1.md` | Terminal/no-op/running→terminal davranış sözleşmesi | Teknik sözleşme |


## Build 214 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/17_MASTER_BUILD_LEDGER.md` + `config/master-build-ledger.json` | Güncel build, kural seti ve tek devam noktası | En üst yetkili devam kaydı |
| `docs/18_PROJECT_CONSTITUTION_V5.md` + `docs/18_PROJECT_CONSTITUTION_V5.json` | Aktif Proje Anayasası V5 / PR-171 | Ana Build Defteri ile birlikte en üst yönetişim |
| `docs/decisions/DEC-104-protected-side-artifact-encryption.md` + `docs/adr/ADR-087-protected-side-artifact-boundary.md` | OPEN-022 Protected Side Artifact güvenlik sınırı | Bağlayıcı karar ve ADR |
| `docs/decisions/DEC-105-pr171-atomic-work-segmentation.md` + `docs/adr/ADR-088-pr171-stepwise-validation-persistence.md` | PR-171 adımlı çalışma ve kalıcı kanıt | Bağlayıcı çalışma yöntemi |
| `docs/current/MASTER_PROJECT_DOCUMENTATION_BUILD214.docx/.pdf` | Build214 kapanış paket dokümantasyonu (tarihsel) | Build214 kapanış kanıtı |
| `PROJECT_ARTIFACT_INDEX.md/.json` | Build214 dönemindeki kaynak/belge/kanıt indeksi (tarihsel kayıt) | Build214 kapanış kanıtı |

## Build 215 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-106-windows-security-evidence-harness.md` | OPEN-021/022 gerçek Windows kapanış koşulları | Ana karar |
| `docs/adr/ADR-089-real-windows-efs-dpapi-packaged-evidence.md` | EFS/DPAPI/paketli Electron kanıt mimarisi | Bağlayıcı ADR |
| `docs/security/WINDOWS_SECURITY_EVIDENCE_BUILD215.md` | Windows çalıştırma ve PASS/NOT_RUN sınırı | Teknik güvenlik sözleşmesi |
| `scripts/run-bronze-final-windows-validation.ps1` | Güncel build dinamik resmî Windows evidence runner | Fail-closed doğrulama otoritesi |

## Build 216 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-107-windows-evidence-intake-source-binding.md` | Windows kanıt taşıma/kabul ve exact-source bağlama ana kararı | Ana karar |
| `docs/adr/ADR-090-windows-evidence-intake-and-source-binding.md` | Manifest/SHA, host takma kimliği ve fail-closed intake mimarisi | Bağlayıcı ADR |
| `docs/security/WINDOWS_EVIDENCE_INTAKE_BUILD216.md` | Windows kanıt üretim/taşıma/kabul prosedürü ve kapanış sınırı | Teknik güvenlik sözleşmesi |
| `scripts/lib/windows-evidence-intake.mjs` + `scripts/verify-build216-windows-evidence-intake.mjs` | Platform-bağımsız kanıt kabul kapısı | Fail-closed doğrulama otoritesi |


## Build 217 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-108-open021-isolated-windows-closure-gate.md` | OPEN-021 gerçek Windows kapanış kapsam izolasyonu | Ana karar |
| `docs/adr/ADR-091-open021-efs-only-real-windows-proof.md` | EFS-only real-Windows probe ve development/package yaşam döngüsü | Bağlayıcı ADR |
| `docs/security/OPEN021_WINDOWS_CLOSURE_BUILD217.md` | Tek tık çalıştırma, PASS şartları ve kapsam sınırı | Teknik güvenlik sözleşmesi |
| `OPEN021_WINDOWS_KAPAT.cmd` + `scripts/run-open021-windows-closure.ps1` | OPEN-021 resmî Windows kanıt üretim runner'ı | Fail-closed doğrulama otoritesi |


## Build 218 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-109-open022-isolated-windows-closure-gate.md` | OPEN-022 gerçek Windows kapanış kapsam izolasyonu ve provider/backend ayrımı | Ana karar |
| `docs/adr/ADR-092-open022-dpapi-protected-side-artifact-proof.md` | safeStorage/DPAPI + Protected Side Artifact real-Windows probe ve development/package yaşam döngüsü | Bağlayıcı ADR |
| `docs/security/OPEN022_WINDOWS_CLOSURE_BUILD218.md` | Tek tık çalıştırma, PASS şartları ve kapsam sınırı | Teknik güvenlik sözleşmesi |
| `OPEN022_WINDOWS_KAPAT.cmd` + `scripts/run-open022-windows-closure.ps1` | OPEN-022 resmî Windows kanıt üretim runner'ı | Fail-closed doğrulama otoritesi |


## Build 219 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-110-unified-bronze-windows-security-closure.md` | OPEN-021/022 birleşik gerçek Windows kapanış ana kararı | Ana karar |
| `docs/adr/ADR-093-unified-bronze-windows-security-lifecycle.md` | Tek build/install/uninstall ve bağımsız readiness mimarisi | Bağlayıcı ADR |
| `docs/security/BRONZE_WINDOWS_SECURITY_CLOSURE_BUILD219.md` | Tek tık Windows çalıştırma, exit-code ve evidence bundle prosedürü | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT.cmd` + `scripts/run-build219-bronze-security-closure.ps1` | Build219 resmî birleşik Windows evidence runner | Fail-closed doğrulama otoritesi |

## Build 220 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-111-build219-windows-failure-bootstrap-remediation.md` | Gerçek Build219 Windows failure evidence ve Build220 düzeltme kararı | Ana karar |
| `docs/adr/ADR-094-windows-packager-bootstrap-and-ps51-evidence-encoding.md` | İzole packager bootstrap, UTF-8 BOM ve process diagnostics mimarisi | Bağlayıcı ADR |
| `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD220.md` | Build220 tek tık Windows yeniden test prosedürü | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD220.cmd` + `scripts/run-build220-bronze-security-closure.ps1` | Build220 resmî birleşik Windows evidence retry runner | Fail-closed doğrulama otoritesi |
| `docs/decisions/DEC-112-build220-windows-failure-workspace-build-remediation.md` | Gerçek Build220 Windows failure evidence ve Build221 workspace-build düzeltme kararı | Ana karar |
| `docs/adr/ADR-095-workspace-package-build-before-windows-package.md` | Windows package lifecycle öncesi workspace build prerequisite mimarisi | Mimari karar |
| `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD221.md` | Build221 tek tık Windows yeniden test prosedürü | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD221.cmd` + `scripts/run-build221-bronze-security-closure.ps1` | Build221 resmî birleşik Windows evidence retry runner | Fail-closed doğrulama otoritesi |

## Build 222 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-113-build221-windows-failure-preload-typescript-remediation.md` | Gerçek Build221 Windows TS7017 failure evidence ve Build222 düzeltme kararı | Ana karar |
| `docs/adr/ADR-096-preload-global-lifecycle-typing.md` | Preload renderer yaşam döngüsü structural typing sınırı | Bağlayıcı ADR |
| `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD222.md` | Build222 tek tık Windows yeniden test prosedürü | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD222.cmd` + `scripts/run-build222-bronze-security-closure.ps1` | Build222 resmî birleşik Windows evidence retry runner | Fail-closed doğrulama otoritesi |


## Build 223 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-114-build222-windows-failure-preload-cjs-graph-remediation.md` | Gerçek Build222 Windows TS2307/TS7060 failure evidence ve Build223 düzeltme kararı | Ana karar |
| `docs/adr/ADR-097-preload-commonjs-staging-graph.md` | Preload CommonJS dependency staging ve CJS specifier mimarisi | Bağlayıcı ADR |
| `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD223.md` | Build223 tek tık Windows yeniden test prosedürü | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD223.cmd` + `scripts/run-build223-bronze-security-closure.ps1` | Build223 resmî birleşik Windows evidence retry runner | Fail-closed doğrulama otoritesi |

## Build 224 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-115-build223-windows-failure-license-rtf-sync-remediation.md` | Gerçek Build223 Windows stale NSIS license RTF failure evidence ve Build224 düzeltme kararı | Ana karar |
| `docs/adr/ADR-098-deterministic-nsis-license-source-sync.md` | Deterministik TXT→RTF generation/verification ve exact-source paketleme sınırı | Bağlayıcı ADR |
| `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD224.md` | Build224 tek tık Windows yeniden test prosedürü | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD224.cmd` + `scripts/run-build224-bronze-security-closure.ps1` | Build224 resmî birleşik Windows evidence retry runner | Fail-closed doğrulama otoritesi |

## Build 225-227 yetki güncellemesi

| Belge | Yetki alanı | Bağlayıcılık |
|---|---|---|
| `docs/decisions/DEC-116-build224-windows-security-root-cause-remediation.md` + `docs/adr/ADR-099-fail-closed-windows-efs-safestorage-startup-evidence.md` | Build225 EFS, backend davranışı ve fatal startup düzeltmeleri | Ana karar ve bağlayıcı ADR |
| `docs/decisions/DEC-118-build225-fresh-profile-device-identity-initialization-order.md` + `docs/adr/ADR-101-protected-device-identity-before-device-bound-maintenance-restore.md` | Build226 fresh-profile cihaz kimliği başlangıç sırası | Ana karar ve bağlayıcı ADR |
| `docs/decisions/DEC-119-build227-four-proven-windows-root-causes.md` + `docs/adr/ADR-102-build227-windows-persistence-and-closure-remediation.md` | Build227 dört kanıtlanmış Windows kök nedeni | Ana karar ve bağlayıcı ADR |
| `docs/security/WINDOWS_ROOT_CAUSE_REMEDIATION_BUILD227.md` | Build227 güvenlik kanıt sınırı | Teknik güvenlik sözleşmesi |
| `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD227.cmd` + `scripts/run-build227-bronze-security-closure.ps1` | Build227 resmî gerçek Windows kapanış runner'ı | Fail-closed doğrulama otoritesi |
