# 32-L PPK-016 türetilmiş veri politika mirası üst kapanışı

Durum: `COMPLETE / PASS`

> Nihai kapanış: `buildAiTimelineContext`, family-import payload cache'i, plaintext `.db` replica, automation semantik task/ledger ve archive semantik `resultJson` yolları kapatılmıştır. Read-time receipt provenance, exact recursive upstream lineage, monotonic policy rotation ve 512 ata/traversal kontrolleri uygulanmış; hedefli, tam regresyon, build ve bütünlük zinciri gerçek çalıştırmalarla geçmiştir. No-cache davranışı ve kriptografik koruma ayrı boundary'lerdir; kaynak politika mirasının tek başına kanıtı sayılmamıştır.

## Kapsam taksonomisi ve kanonik envanter

Kanonik kayıt `config/32-l-ppk-016-derived-data-production-inventory.json` dosyasıdır. PPK-016’nın doğrudan yönettiği sınıf, kullanıcı kaynaklarının semantik içeriğinden üretilen ve kaynak çağrısı sonrasında bağımsız adreslenebilen veya yeniden kullanılabilen **retained/reusable semantic materialization**’dır.

Aşağıdaki üretim sahiplikleri ayrı sınıflardır; tanımlarından sapıp reusable kullanıcı semantiği tutmadıkları sürece doğrudan türev payload repository’si sayılmaz:

- Tek çağrıda hesaplanan ve backend’de saklanmayan renderer okuma görünümleri `LIVE_PROJECTION`.
- Aynı kasa ve aynı ya da daha dar yetki sınırında atomik geri alma/bütünlük/audit tutan kayıtlar `TRANSACTION_JOURNAL`.
- Kendi resource kimliği, güncel PEP kararı ve yaşam döngüsü olan kayıtlar `PRIMARY_RECORD`.
- Kullanıcı semantik kaynağı taşımayan sağlık/tanı telemetrisi `OPERATIONAL_ARTIFACT`.
- Kaynak payload ile politika metadata ve receipt kayıtlarını birlikte taşıyan, bağımsız plaintext okuma sağlamayan korumalı `.pptbackup` `WHOLE_VAULT_BACKUP`.

Bu sınıflandırma muafiyet üretmez. Bir yol çağrılar arasında tekrar kullanılabilir kullanıcı semantiği saklamaya başlarsa merkezi inheritance policy, sealed binding, güncel PEP ve aynı policy-authorized transaction koşullarına girer.

## Kurulmuş foundation sınırları

- OCR metni, arama indeksi, küçük resim, AI hafızası, özet, embedding, çeviri, transkript, cache ve replica türevleri merkezi fail-closed politika/use-case sınırına bağlanır.
- Türev hassasiyeti kaynakların en yüksek seviyesinden düşük olamaz; veri sınıfları ve kısıtlayıcı yükümlülükler birleşim, erişim kümeleri kesişim, retention ise en erken kaynak sınırıyla belirlenir.
- Eksik veya pasif receipt; aile, politika sürümü/paketi, context ya da request uyuşmazlığı; boş erişim kesişimi; yinelenen kaynak, self-reference, döngü, aşırı derinlik ve hash bozulması callback açılmadan reddedilir.
- Kaynak authorization receipt zamanı, hedef producer transaction zamanından gelecekte olamaz ve en fazla 30.000 ms eski olabilir; repository ile migration trigger aynı creation-time stale-receipt penceresini fail-closed uygular.
- Her binding read-back işleminde tarihsel producer ve bütün source receipt zarfları hash, canonical record, request/context, kimlik, aile, karar, policy package ve zaman provenance bağlarıyla yeniden doğrulanır. Source receipt ile producer transaction arasındaki `0..30.000 ms` creation chronology tekrar hesaplanır.
- Read-time provenance güncel yetkinin yerine geçmez. Full binding okuması current target PEP, source-index okuması current source PEP ister; tarihsel receipt tek başına grant/revocation propagation kanıtı değildir.
- Türetilmiş source exactly-one sealed upstream bindinge `resourceType/resourceId/resourceVersion/contentSha256/familyId` üzerinden bağlanır. Upstream zinciri recursive doğrulanır; primary source yalnız depth=0/boş ata, ambiguous upstream ve lineage reseti ise fail-closed ret durumudur.
- Aynı yeni inheritance kararındaki source/target policy version ve package exact kalır. Tarihsel upstream ile current source arasındaki rotation exact sürüm/hash eşitliği istemez; bunun yerine current source hassasiyet, veri sınıfı, beş erişim ekseni, yükümlülük ve retention bakımından upstream target politikasından daha gevşek olamaz.
- Kanonik transitive ata kümesi ve kalıcı recursive traversal ayrı ayrı en çok 512 distinct kayıtla sınırlıdır; 513'üncü ata reddedilir ve 16 seviyelik derinlik sınırı ayrıca korunur.
- Source-set ve binding SHA-256 üretiminde locale-bağımsız kanonik metin sırası kullanılır; Unicode kimlik ve amaçlarda kaynak giriş sırası hash sonucunu değiştirmez.
- Migration 77 yalnız receipt-bağlı lineage/politika metadata tablolarını ekler. Binding `pending` başlar, eksiksiz kaynak setiyle `sealed` olur; sealed binding ve kaynak satırları değişmezdir.
- Tek yetkili SQLite repository adaptörü policy-authorized transaction context ister. Üretim kaynak çiti doğrudan türetilmiş-veri SQL, somut repository, persistence primitive ve yazma bypass yollarını sıfır istisnayla reddeder.
- Tipli durum IPC’si sıfır argümanlı ve no-cache’tir. Kaynak politika zarfı taşımayan genel türetilmiş renderer projeksiyonları paylaşım cache’ine alınmaz; PPK-012 çevrimdışı lease kontrollü hassas cache korunur.

## Yeniden açılma öncesi tarihsel ara doğrulamalar

> Aşağıdaki PASS sonuçları foundation’ın çalıştırılmış tarihsel ara kanıtlarıdır; açık üretim yolları kapatılmadan PPK-016 `COMPLETE / PASS` sayılmaz.

- PPK-016 hedefli politika/use-case/gerçek SQLite migration 77/repository/no-cache testleri: 54/54 PASS.
- PPK-012, PPK-013, PPK-014 ve PPK-015 paket hedefli güvenlik regresyonları: 66/66 PASS; ek location-sensitive IPC no-cache regresyonları: 3/3 PASS.
- Üretim türetilmiş-veri sınır taraması: 18 alan / 335 dosya / 0 bulgu; 11/11 kötü niyetli ve 4/4 iyi huylu öz-sınama PASS; yetkili gerçek türev üretici adaptörü 0.
- Migration 77 zincir runtime’ı: 9/9 PASS.
- TypeScript ön doğrulaması: 0 diagnostic.
- Yeniden açılma öncesindeki resmî PPK-016 sözleşmesi: 73/73 PASS; runtime demeti: 9/9 PASS. Bu sonuçlar sonradan belirlenen üretim kapsam açığını kapsamadığı için güncel kapanış kanıtı değildir.
- Tam Vitest: tek worker ile 65 dosya / 513 test PASS.
- Üretim zinciri: 18 workspace paketinin yanında Core Service ile Desktop Electron main/preload/renderer PASS.
- Platform Policy runtime: 8/8; Core Service sınırı: 8/8; Build162 IPC read-sharing runtime: 37/37 PASS.
- Lockfile bütünlüğü: 533 doğrulama / 18 workspace PASS.
- Supply kontrolü: 435 doğrulama / 135 kanonik dış tarball PASS.
- Workspace kontrolü: 499 doğrulama / 18 workspace; üretim grafiği döngüsüz PASS.
- Karar defteri: 278 kontrol / 51 karar PASS.
- Governed preflight: 1.712 dosya PASS; proje artifact index’i: 4.814 dosya / 3.109 belge PASS.
- Yeniden açılma öncesindeki Bronze audit: `PASS_WITH_OPEN_SCOPE`; resmî %25, strict %8,2857, implementation-chain %8,5429. Güncel ilerleme bu tarihsel yüzdelerden yeniden hesaplanmalıdır.

## Nihai doğrulama

- PPK-016 hedefli policy/use-case/gerçek SQLite migration 77/repository takımı: 75/75 PASS. Kapsam; 512/513 ata sınırı, exact upstream allow/lineage reset retleri, monotonic policy-package rotasyonu, upstream policy broadening retleri, iki read API için producer/source receipt tamperları ve read-back creation chronology doğrulamasını içerir.
- Tam Vitest: 66/66 dosya, 540/540 test PASS. Root TypeScript `--noEmit`: 0 hata PASS.
- Source gate: 18 zone / 335 production dosyası / 23 ilgili kaynak; 23/23 kötü niyetli ve 4/4 iyi huylu öz-sınama, 0 bulgu PASS.
- Production direct build: 18 workspace paketi + Core Service + Electron main/preload/renderer PASS.
- DataStore smoke: 14/14 PASS; migration 1–77 ve 83 tablo doğrulandı. Migration runtime: 9/9, latest 77 PASS.
- Runtime foundation 6/6; Platform Policy 8/8; Core Service boundary 8/8; Build162 IPC 37/37; Build96 8/8; Build214 10/10 PASS.
- Archive contract 90/90 ve archive runtime 66/66 PASS.
- PPK-012–PPK-015 güvenlik regresyonu 69/69; focused doğrulama 9 dosya/105 test PASS.
- Lockfile 533 kontrol/18 workspace; supply 435/135; workspace 499 kontrol/18 workspace ve döngüsüz üretim grafiği PASS.
- Karar defteri 278 kontrol/51 karar PASS; diff-check temiz.
- PPK-016 final contract 109/109 ve 15 komutluk runtime kanıt demeti 15/15 PASS.

## Üretim envanteri ve uygulanan düzeltmeler

- **Public AI helper:** `packages/domain/src/ai-memory.ts` kök `@ppt/domain` exportundan çıkarılmıştır. Production modül importu ve `buildAiTimelineContext` çağrısı kaynak kapısında fail-closed reddedilecek biçimde işaretlenmiştir. Dosyanın testlerden doğrudan kullanılması production yetkisi değildir.
- **Family-import preview cache:** `CachedPreviewLease` yalnız aile/aktör kimliği, süre, kaynak yolu/stat/SHA-256, hedef ID seed’i ve plan digest tutar. Kaynak metni, parse document, preview ve tam plan saklanmaz; `apply` dosyayı yeniden okuyup stat, SHA-256, parse ve plan digest bağlarını yeniden doğrular.
- **Plaintext `.db` replica:** Legacy `.db` hedefi reddedilir; production composition eski raw export use-case/adapterını kullanmaz. `exportBackup` yalnız korumalı tam yedek akışına delege olur.
- **Korumalı tam yedek:** `.pptbackup`, SQLite kasasını parçalayarak bağımsız bir türev üretmez. Kaynak payload, politika/receipt/lineage kayıtları ve şifreli arşiv bileşenleri aynı parola/cihaz korumalı konteynerde birlikte taşınır. Bu yalnız kriptografik/ayrı kasa sınırı kanıtıdır; PPK-016 inheritance kanıtı değildir.
- **Renderer summary/genealogy/snapshot ve katalog/arama görünümleri:** Backend’de çağrılar arasında saklanmayan `LIVE_PROJECTION`; her çağrıda mevcut backend yetkisi kullanılır ve mevcut no-cache çiti korunur.
- **Data-repair ve person-lifecycle before/after snapshotları:** Aynı kasa ve daha dar idari/lifecycle yetki altında atomik geri alma ve bütünlük sağlayan `TRANSACTION_JOURNAL`.
- **Family-import batch summary:** Kaynak text/parse payloadı değil, içeriksiz adet ve işlem metadata’sı taşıyan `TRANSACTION_JOURNAL`.
- **Automation life task — kapatıldı:** Yalnız LIFE kaynağı kabul edilir ve kaynak güncel receipt-bound LIFE PEP ile yeniden doğrulanır. Üretilen private `PRIMARY_RECORD` kaynak `title/dueAt` değerini taşımaz; bağımsız rule başlığı ile sabit not taşır.
- **Automation run ledger — kapatıldı:** Non-LIFE create/execute/list fail-closed kaldırılmıştır. Ledger API content-free kimlik/durum metadata’sıdır; title/dueAt kabul etmez, eski sütunları redacted title ve transaction `createdAt` ile doldurur. Görünür LIFE alanları güncel PEP joininden canlı gelir.
- **Archive `resultJson` — kapatıldı:** Semantik erişim ve replay kaldırılmıştır. Yeni yazım sabit `{status:completed}`, one-way `resultHash` ve işlem kimliğidir; retry exact güncel kalıcı receipt sonrası yalnız content-free conflict döndürür.
- **Health history ve diagnostic/archive yan artefaktları:** Kullanıcı semantik kaynağı taşımayan `OPERATIONAL_ARTIFACT` adayıdır. Production dosyalarının cihaz anahtarlı yan artefakt sınırı yalnız kriptografik/operasyonel boundary kanıtıdır; PPK-016 inheritance kanıtı değildir.

Envanter `status=COMPLETE`, `completionClaimed=true`, `activeUngovernedDerivedPayloadOwners=0`, `openBlockerCount=0` ve `finalValidationPending=false` durumunda kapanmıştır.

## Gerçeklik sınırı

- Gerçek OCR/AI/embedding/çeviri/transkript üretimi çalıştırılmamış; gerçek veri taşınmamış veya backfill edilmemiştir.
- Bu pakette gerçek bir governed derived payload repository/read yolu yoktur. Kaynak politika zarfı taşımayan mevcut generic IPC projeksiyonları, böyle bir zarf gelene kadar no-cache kalır; no-cache tek başına inheritance kanıtı değildir.
- Gelecekte türetilmiş payload sahibi eklendiğinde her erişim, kaynak politikalarının güncel PEP yeniden değerlendirmesinden geçmek; payload write/read işlemini sealed binding ile aynı policy-authorized transactiona bağlamak zorundadır. Tarihsel receipt tek başına grant/revocation propagation kanıtı değildir.
- Migration 77 payload, OCR metni, dosya/kasa yolu ya da secret saklamaz ve fiziksel silme yayılımı yetkisi sağlamaz.
- Desktop kasası ve etkin SQLite oturumu korunur; SQLite sahipliği Core Service’e aktarılmaz.
- Core Service family-data oturumu bağlanmaz, cutover otoritesi eklenmez ve DEC-171 kaldırılmaz.
- PPK-012 çevrimdışı capability lease/hassas önbellek ve policy-sensitive IPC no-cache çiti; PPK-013 doğrudan veri erişim yasağı; PPK-014 sürümlü Core API ve PPK-015 egress politikası gevşetilmez.

PPK-016 `COMPLETE / PASS` olarak kapanmıştır. Mevcut metadata/enforcement foundation korunmuş; üretim envanterindeki bütün bilinen semantik yollar content-free, current-PEP kontrollü veya retired sınıra çekilmiştir. Kapanış gerçek payload üretimi, gerçek veri taşıma/backfill, PPK-019 fiziksel silme yayılımı, Desktop vault/SQLite sahiplik aktarımı ya da cutover yetkisi vermez.
