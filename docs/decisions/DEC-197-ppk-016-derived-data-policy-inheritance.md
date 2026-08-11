# DEC-197 — PPK-016 türetilmiş veri politika mirası

## Durum

32-L kapsamında karar kabul edilmiş ve gereksinim `COMPLETE` olarak doğrulanmıştır. Üretim envanteri, merkezi politika/use-case, migration 77, repository, read-time provenance, exact recursive lineage, hedefli test, tam regresyon ve bütünlük zinciri birlikte kapanış kanıtıdır.

## Karar

Her türetilmiş veri kaydı, merkezi `DerivedDataInheritancePolicy` ve application use-case üzerinden oluşturulur. Politika; kaynakların en yüksek hassasiyetini, veri sınıfı birleşimini, erişim kümelerinin kesişimini, kısıtlayıcı yükümlülüklerin birleşimini ve en erken retention sınırını hesaplar. Caller tarafından bildirilen daha gevşek hedef değerlerine güvenilmez. Eksik veya bozuk kaynak, stale receipt/context/request hash, politika paketi uyuşmazlığı, çapraz aile, kısmi yetki, yinelenen kaynak, self-reference, döngü ve aşırı derinlik callback açılmadan reddedilir.

## Kapsam sınıflandırması

PPK-016’nın yönettiği ana sınıf, bir veya daha fazla kullanıcı kaynağının semantik içeriğinden üretilen ve kaynak çağrısı bittikten sonra bağımsız adreslenebilen ya da yeniden kullanılabilen **retained/reusable semantic materialization**’dır. OCR metni, arama indeksi, thumbnail, AI memory, summary, embedding, translation, transcript, cache ve replica bu sınıfa adaydır.

Aşağıdaki komşu yollar, ancak kendi tanımlarını ihlal edip yeniden kullanılabilir semantik payload saklarlarsa PPK-016 türevi sayılır; salt varlıkları nedeniyle türev payload sahibi ilan edilmez:

- Aynı yetkili çağrı içinde hesaplanan, backend’de saklanmayan tek çağrılık `LIVE_PROJECTION`.
- Kaynak mutation’ın atomik geri alma, bütünlük veya audit durumu olan ve aynı kasa ile aynı ya da daha dar yetki sınırında kalan `TRANSACTION_JOURNAL`.
- Kendi resource kimliği, güncel PEP kararı ve yaşam döngüsü bulunan `PRIMARY_RECORD`.
- Kullanıcı semantik kaynağı taşımayan sistem sağlık/tanı telemetrisi niteliğindeki `OPERATIONAL_ARTIFACT`.
- Kaynak payload ile politika metadata/receipt kayıtlarını değiştirmeden birlikte taşıyan, dışarıda bağımsız plaintext okuma sağlamayan parola/cihaz korumalı `.pptbackup` `WHOLE_VAULT_BACKUP` konteyneri.

Kanonik üretim sınıflandırması `config/32-l-ppk-016-derived-data-production-inventory.json` dosyasıdır. Envanter “kapsam dışı” etiketini bir kaçış olarak kullanamaz: bir yol çağrılar arasında reusable kullanıcı semantiği tutmaya başlarsa sealed binding, güncel PEP ve aynı yetkili transaction kurallarına girer.

## Üretim yolları için karar

- `packages/domain/src/ai-memory.ts` içindeki latent yardımcı public kök exporttan çıkarılmıştır. Production kaynaklarında `ai-memory` importu veya `buildAiTimelineContext` kullanımı statik kapıda fail-closed reddedilir; test içi doğrudan kullanım production yetkisi değildir.
- Family-import preview cache artık kaynak metni, parse document, tam preview veya plan payloadı tutmaz. Süreli lease yalnız kimlik, kaynak stat/SHA-256, hedef seed ve plan digest taşır; `apply` dosyayı yeniden okuyup stat, SHA-256, parse ve plan digest bağlarını yeniden doğrular.
- Plaintext `.db` replica production export yolu kapatılmıştır. Legacy hedef `.db` ise reddedilir; eski raw export use-case/adapter production composition dışında tutulur.
- Tam kasa yedeği bağımsız plaintext replica değildir. Yalnız `.pptbackup` kullanır ve SQLite içindeki kaynak payload ile politika kayıtlarını, receipt/lineage metadata’sını ve şifreli arşiv bileşenlerini aynı korumalı konteynerde birlikte taşır. Bu kriptografik/ayrı kasa sınırı PPK-016 inheritance kanıtı değildir.
- Data-repair ve person-lifecycle before/after snapshotları ile family-import batch summary aynı kaynak mutation sınırındaki transaction journal olarak sınıflandırılır. System health history ile tanı artefaktları kullanıcı semantik kaynağı olmayan operasyonel artefakt adaylarıdır; cihaz anahtarlı korumaları yalnız ayrı kriptografik/operasyonel sınır kanıtıdır ve PPK-016 inheritance kanıtı değildir. Genealogy/summary/snapshot renderer görünümleri saklanmayan live projection’dır.

## Kapatılan üretim engelleri

Bağımsız incelemede bulunan üç yol retained/reusable kaynak semantiği taşımayacak şekilde kapatılmıştır:

- Automation yalnız LIFE kaynağını kabul eder; non-LIFE rule create/execute/list yolları `PPK016_SOURCE_BINDING_REQUIRED` ile fail-closed reddedilir. LIFE kaynağı güncel receipt-bound LIFE PEP üzerinden yeniden doğrulanır. Üretilen private `PRIMARY_RECORD`, kaynak `title` veya `dueAt` değerini kopyalamaz; bağımsız `rule.title` ve sabit notla oluşturulur.
- Automation run `TRANSACTION_JOURNAL` portu kaynak `title/dueAt` alanlarını kabul etmez. Eski kalıcı sütunlar redacted sabit başlık ve transaction `createdAt` ile doldurulur; listeleme yalnız content-free kimlik/durum metadata’sını alır ve kullanıcı görünümünü güncel LIFE PEP joininden canlı üretir.
- Archive operation `resultJson` semantik erişim/replay yolları kaldırılmıştır. Yeni kalıcı kayıt yalnız sabit `{status:completed}`, `resultHash` ve işlem kimliği taşır. Retry, exact güncel kalıcı receipt kaydedildikten sonra yalnız content-free conflict metadata döndürür; semantik replay yasaktır.

Bu kontroller ve tamamlanan final doğrulama sonucunda envanter `activeUngovernedDerivedPayloadOwners=0`, `openBlockerCount=0`, `status=COMPLETE` durumundadır. Herhangi bir yol yeniden retained kaynak semantiği taşırsa current-PEP, sealed binding ve aynı policy-authorized transaction zorunluluğu yeniden devreye girer.

Migration 77 yalnız türetilmiş veri politika metadata’sını taşıyan `derived_data_policy_bindings` ve `derived_data_policy_sources` tablolarını ekler. Payload, OCR metni, dosya yolu veya secret saklamaz; mevcut satırlara backfill yapmaz. Binding önce `pending` oluşturulur, bütün receipt-bağlı kaynaklar eklendikten sonra `sealed` olur. Sealed binding ve kaynak satırları değişmezdir. Yeni gerçek türev repository’leri payload yazımını aynı policy-authorized transaction ve sealed binding ile bağlamak zorundadır.

Kaynak receipt, context ve request hash’leri; aile/policy package bağları; kaynak kümesi hash’i ve binding hash’i kalıcı lineage’ın parçasıdır. Çok seviyeli türetim 16 seviye ile sınırlıdır. PPK-019 tamamlanana kadar bu metadata fiziksel silme yayılımı yetkisi sağlamaz.

Source-set ve binding SHA-256 üretimi locale-bağımsız kanonik metin sırasına bağlıdır; Unicode kimlik/amaçlar ve kaynak giriş sırası aynı mantıksal binding için aynı hash’i üretir.

Kaynak authorization receipt zamanı hedef producer transaction zamanından gelecekte olamaz ve en fazla 30.000 ms eski olabilir. Repository ile migration trigger bu creation-time stale-receipt penceresini ayrı ayrı fail-closed uygular.

Kalıcı bir binding her okunduğunda yalnız binding/source JSON ve SHA-256 değerleri değil, tarihsel producer receipt ile bütün source receipt zarfları da yeniden doğrulanır. Receipt hash'i imzalı receipt üzerinden yeniden hesaplanır; canonical record, request/context hash'leri, kaynak/hedef kimliği, aile, karar, policy package ve zaman bağlarından biri eksik ya da bozuksa okuma fail-closed reddedilir. Source receipt ile producer transaction arasındaki `0..30.000 ms` creation chronology ilişkisi read-back sırasında yeniden hesaplanır. Bu kontrol tarihsel receipt'i güncel bir grant yapmaz: okuma ayrıca aktif current target/source PEP transaction context'i ister.

Bir source kendisini türetilmiş olarak bildiriyorsa repository aynı `resourceType/resourceId/resourceVersion/contentSha256/familyId` için exactly-one `sealed` upstream binding bulmak ve o bindingin producer/source receipt zincirini recursive doğrulamak zorundadır. Upstream bulunmayan kaynak ancak `lineageDepth=0` ve boş ata kümesiyle primary source sayılır; çoklu/ambiguous upstream, lineage reseti, eksik/fazla ata, bozuk upstream, döngü veya uyuşmazlık reddedilir.

Aynı yeni inheritance kararındaki target ve source snapshot'ları tek current policy version/package üzerinde exact kalır. Buna karşılık tarihsel sealed upstream ile daha sonra alınan current source receipt arasında policy version/package hash eşitliği aranmaz; güvenli package rotasyonu, current source politikasının upstream target politikasından semantik olarak daha gevşek olmamasıyla kabul edilir. Hassasiyet ve veri sınıfları düşürülemez, beş erişim ekseni genişletilemez, yükümlülük kaldırılamaz ve retention uzatılamaz. Current receipt kendi sürüm ve paketine kriptografik olarak exact bağlı kalır.

Kanonik transitive ata kümesi ve kalıcı recursive traversal ayrı ayrı en çok 512 distinct binding/kaynakla sınırlıdır; 16 seviyelik derinlik sınırı ayrıca korunur. Read-time provenance, exact lineage, monotonic rotation ve 512 ata kontrolleri kodda uygulanmış; 75/75 hedefli test ve 540/540 tam Vitest dahil final zincirde doğrulanmıştır.

## Doğrulama kararı

Final doğrulama; 75/75 PPK-016 hedefli SQLite testi, 66/66 dosyada 540/540 tam Vitest, 0 TypeScript hatası, 18 zone/335 dosya/23 ilgili kaynak/23 kötü niyetli ve 4 iyi huylu öz-sınamada 0 bulgulu source gate, 18 workspace + Core Service + Electron main/preload/renderer production build ve migration 1–77/83 tablo kanıtlarını içerir. DataStore smoke 14/14, migration runtime 9/9, runtime foundation 6/6, Platform Policy 8/8, Core Service 8/8, Build162 37/37, Build96 8/8, Build214 10/10, archive contract/runtime 90/90 ve 66/66, PPK-012–015 regresyonu 69/69 ve focused 9 dosya/105 test PASS olmuştur. PPK-016 final contract 109/109 ve runtime kanıt demeti 15/15 PASS; lockfile 533/18, supply 435/135, workspace 499/18 döngüsüz, karar defteri 278/51 ve diff-check temiz sonuçlanmıştır.

Tipli `system:getDerivedDataPolicyBoundary` IPC'si yalnız güvenlik duruşunu gösterir; sıfır argümanlı ve no-cache'tir. Sistem ekranındaki kart ve “Türetilmiş veri güvenliği” menüsü payload, kaynak yol, kasa yolu, receipt veya secret göstermez.

Kaynak zarfı taşımayan genel renderer/main IPC okuma paylaşımları cache dışına alınır. PPK-012’nin capability lease ile korunan özel çevrimdışı cache sınırı kaldırılmaz; o sınır exact hesap/aile/cihaz/paket/süre bağlarını korumaya devam eder.

## Gerçeklik sınırı

Bu karar politika mirası ve lineage metadata omurgasını kurur. Gerçek OCR/AI/embedding/çeviri/transkript motoru çalıştırılmaz, gerçek kullanıcı verisi taşınmaz veya backfill edilmez, dış ağa veri gönderilmez, Desktop vault yapısı ve SQLite sahipliği değiştirilmez, Core Service family-data oturumu bağlanmaz ve DEC-171 cutover yasağı kaldırılmaz.

Bu pakette gerçek bir governed derived payload repository/read yolu yoktur. Kaynak politika zarfı taşımayan mevcut generic IPC projeksiyonları, böyle bir zarf gelene kadar no-cache kalır; no-cache tek başına inheritance kanıtı değildir. Gelecekte türetilmiş payload sahibi eklendiğinde her erişim kaynak politikalarının güncel PEP yeniden değerlendirmesinden geçmek ve payload write/read işlemini sealed binding ile aynı policy-authorized transactiona bağlamak zorundadır. Tarihsel receipt tek başına grant/revocation propagation kanıtı sayılmaz.

PPK-016 `COMPLETE` iddiası mevcut üretim yollarının kapatılması ile metadata/enforcement foundation kapsamıyla sınırlıdır. Gerçek payload üretim/okuma sahipliği veya PPK-019 fiziksel silme ve iptal yayılımı bu kararla tamamlanmış sayılmaz.

PPK-012 çevrimdışı lease/cache çiti, PPK-013 doğrudan veri erişim yasağı, PPK-014 sürümlü Core API sınırı ve PPK-015 egress politikası gevşetilmez.
