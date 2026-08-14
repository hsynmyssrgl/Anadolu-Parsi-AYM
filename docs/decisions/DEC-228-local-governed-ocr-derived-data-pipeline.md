# DEC-228 — Yerel, yönetişimli OCR ve türetilmiş veri hattı

- Adım: `33-Q`
- Durum: `PLANNED / LOCAL_IMPLEMENTATION_STARTED`
- Requirement PASS: `false`
- Yerel uygulama: `PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED / ACCEPTANCE_INCOMPLETE`
- Yerel otomatik bileşen kanıtı: `14 dosya / 103 test PASS`
- Dış/manuel kanıt: `NOT_RUN`
- Persistent receipt: `NOT_RUN`

## Karar

33-Q, desteklenen belgeler için yerel öncelikli ve tamamen kapatılabilir OCR/metin indeksi tasarımını başlatır. Bu karar yalnız yönetişim başlangıç setidir. Aktif adım 33-P dış ve manuel kanıtlar nedeniyle `IN_PROGRESS` olduğundan registry, roadmap, iş planı ve aktif ledger değiştirilmez; 33-Q aktive edilmez ve hiçbir requirement kapanmış sayılmaz.

Yerel domain/repository-contract, migration 94 metadata şeması, merkezi PEP/UoW adapterı, bounded Windows child-process adapterı, owner-bound şifreli sealed-result vault/runtime, DataStore facade, dokuz dar renderer IPC yöntemi ve Arşiv ekranındaki tek OCR paneli kaynakta/testte composition’a bağlanmıştır. Bu, uçtan uca acceptance değildir. Başarılı üretim işlemi için kaynak okuma yetkisi ve `ocr_process` amacı, ayrı ve güncel `sensitive_processing` rızası, şifreli arşiv kasası, kaynak SHA-256 doğrulaması, zararlı dosya ve bounded format kabulü, doğrulanmış düşük yetkili yerel worker, OCR sonucu doğrulaması, PPK-016 türetilmiş politika mirası, şifreli sealed-result/index, PPK-019 silme-owner zinciri, içeriksiz audit/outbox ve PPK-022 build/runtime capability kapısı birlikte gereklidir. Varsayılan zararlı-dosya providerı yoktur; gerçek run fail-closed kalır.

## Exact kabul zinciri

| ID | Exact başlık | Exact kabul |
|---|---|---|
| B3-04 | Belge OCR/metin indeksi için yerel, izinli ve kapatılabilir sınır | Desteklenen belgelerde yerel indeks; ham belge dışarı gönderilmez. |
| OCR-001 | Build228’de gerçek OCR motoru ve kullanıcı akışı bulunmaması | Kaynakta provider, use-case, schema, UI ve test zinciri bulunmalıdır. |
| OCR-002 | Dosya önce şifreli kasaya alınır, hash ve zararlı dosya kontrolü tamamlanır | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-003 | OCR öncesi kaynak okuma + ocr_process amacı + AI/derived-data rızası değerlendirilir | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-004 | Windows yerel OCR ve Apple Vision yerel OCR; dış servis varsayılan kapalı | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-005 | NPU/yerel API yoksa denetlenmiş offline fallback; hiçbir zaman sessiz bulut gönderimi yok | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-006 | Belge ayrıştırıcı/OCR worker sandbox, düşük yetki, CPU/RAM/süre/sayfa/piksel limiti | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-007 | Görüntü OCR, PDF gömülü metin çıkarma ve taranmış PDF OCR yollarının ayrı tutulması | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-008 | Metin, dil, sayfa, koordinat, confidence, model/provider sürümü ve kaynak SHA ilişkisi | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-009 | OCR metni kaynak belgenin hassasiyet, sahiplik, izin, retention ve export politikasını devralır | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-010 | OCR metni ve indeksler şifreli; düz metin temp/log/cache yasak | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-011 | Yetki filtreli tam metin indeks; sonuç snippet’i dahi policy ve maskeleme yükümlülüğünden geçer | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-012 | Önizle, düzelt, yeniden çalıştır, dili seç, sil ve OCR’ı tamamen kapat | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-013 | Düşük confidence görünür; OCR sonucu resmî/sağlık/finans gerçeği gibi otomatik kabul edilmez | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-014 | Ayrı açık onay, veri önizleme/redaksiyon, bölge, saklama, silme ve sözleşme olmadan kapalı | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-015 | OCR metni AI’ya otomatik verilmez; ayrı ai_process kararı gerekir | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-016 | Talep, başlama, tamamlanma, hata, provider/model, kaynak/türev hash; içerik loglanmaz | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-017 | Yalnız yetkili türetilmiş indeks/özet Apple cihazlara; ham belge ve tam metin ayrı izinli | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-018 | Ekran okuyucu için belge metni, sayfa konumu ve kullanıcı düzeltmesi; görsel orijinal korunur | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-019 | Kötü amaçlı PDF, zip bomb, dev görüntü, bozuk font, çok dil, el yazısı, düşük kalite ve yetki sızıntısı testleri | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| OCR-020 | Kaynak imha/izin iptalinde OCR metni, indeks, embedding, cache ve türevler karantinaya/silmeye girer | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |
| XPF-001 | Çeviri, özet, transkript ve embedding türevleri kaynak politika mirasını zorunlu devralır | Kod, politika, test ve kanıt zinciri tamamlanmadan PASS verilemez. |

## Yeniden kullanım kararı ve sınırı

- PPK-002/arşiv temeli; şifreli vault member, korumalı vault anahtarı, bellek içi boyut/hash doğrulaması ve receipt-bağlı merkezi PEP/UoW/SQLite işlemi sağlar. Mevcut `materialize` yolu düz metin geçici dosya oluşturabildiği için OCR bu yolu kullanamaz; bounded `readBytes` veya eşdeğer sıfırlanan bellek/izole worker aktarımı tasarlanmalıdır. Mevcut arşiv girişi zararlı dosya taraması yapmaz ve tek başına OCR-002 kabulü değildir.
- Yeni archive import create receipt’i actor person `ownerPersonId` ile mühürlenir; 3/3 archive policy testi ve desktop typecheck bunu yerel kaynakta doğrular. Immutable eski create receipt’lerinde `ownerPersonId=null` ise OCR fail-closed kalır. Sahipliği tahmin eden veya receipt’i sessizce yeniden yazan bir yol yasaktır; legacy ownership re-attestation/backfill otoritesi tasarlanıp kanıtlanmadan eski arşiv OCR erişilebilirliği/acceptance kapanmaz.
- PPK-016; `OCR_TEXT`, `SEARCH_INDEX`, `SUMMARY`, `EMBEDDING`, `TRANSLATION`, `TRANSCRIPT`, `CACHE` ve `REPLICA` türleri için exact recursive lineage, retention ve erişim politikası mirası sağlar. OCR local binding entegrasyonu gate/testte vardır; gerçek arama/AI türev üretimi ve 33-Q acceptance açık kalır.
- PPK-019; OCR job/current metadata, mutation ve immutable source-deletion item ledger sınıfları ile owner-bound sealed-result purge zincirini tanır. Batch/rollback/replay ve source destroy failureında false ledger yazmama testlidir. Source-file success sonrası process-death crash penceresi durable auto-resume ile kapanmadığı için atomik/garantili propagation veya fiziksel silme iddiası yoktur.
- PPK-021 current gate 441 üretim dosyasında 679 privileged yüzeyi exact SHA-256 `c9e05bd1c77dd0f91d09f60f5a95a76faca0a2010882ea1c00b64d0d6be726eb` ile PASS ölçer (`17/17` targeted, `84/84` contract, `20/20` runtime). Bu build-time AST kanıtı runtime PEP veya OCR acceptance yerine geçmez.
- PPK-022 current gate 441 üretim dosyasında 339 capability yüzeyini exact SHA-256 `bba1167e470099c3af1d4363bdba117028b7ce0b61fb78c381e07f3d439ec399` ile PASS ölçer (`19/19` targeted, `110/110` contract, `24/24` runtime, `19/19` canonical availability). `windows-desktop` aggregate `ocr.process` capability’si ayrı `ocr-worker` uygulama kimliği veya düşük yetki sandbox kanıtı değildir; `ocr-worker=[]` korunur.
- B2-05/B6-03, 33-K/33-O ve PPK-017 süreli hassas veri rızası ile içeriksiz log temelleri sağlar. Production adapter `archive.ocr/process/ocr_process` PEP planını ayrı `sensitive_processing` rızasından ayırır; exact receipt ve runtime-authority lease yerel entegrasyon testlerinde doğrulanır. OCR rızası `ai_process` izni sayılmaz ve local test gerçek cihaz/UAT kanıtı değildir.

Kapanmış temel paketlerin yeniden kullanımı `REUSE_FOUNDATION_ONLY`, bunların üzerindeki OCR-specific production kaynakları ise `PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED / ACCEPTANCE_INCOMPLETE` statüsündedir; hiçbiri OCR requirement PASS üretmez.

## Yerel otomatik kanıt sınırı

Stabil yerel snapshot; core use-case/repository/transaction `3 dosya / 18 test`, security/input/worker/Windows `4/24`, sealed runtime `1/16`, PEP/UoW policy `2/10`, IPC `2/27`, UI `1/5` ve DataStore production facade `1/3` olmak üzere toplam `14 dosya / 103 test PASS` üretmiştir. Migration 94 kanonik SHA-256 değeri `6f2e62cb05808731f0a1ef014acb8cfb1f455974f734fd9a117f46e7dbe95cb1` ve migration verifier sonucu `9/9 PASS` durumundadır. Archive+PPK-016+PPK-019 regresyonu ayrıca `3 dosya / 108 test PASS` durumundadır. Bu sonuçlar yalnız kısmi yerel uygulama kanıtıdır; gerçek cihaz, dış/manual kabul, tam adversarial matris veya requirement kapanışı değildir.

## Yerel sağlayıcı ve fallback kararı

Windows Media OCR child-process adapterı, Job Object limitleri, in-memory PNG/JPEG smoke ve main-authority lease zinciri production facade’a yerel olarak bağlanmıştır. Varsayılan zararlı-dosya providerı yokken run fail-closed kalır; bu nedenle kaynakta composition olması provider readiness, düşük yetki sandbox veya gerçek cihaz UAT kanıtı değildir. Ayrı process olmak düşük yetkili sandbox sertifikası değildir. Process `windows-desktop` aggregate runtime kimliğini kullanır ve bu kimlikte `network.access` vardır; sonuçtaki `networkUsed=false` OS-enforced ağ izolasyonu sayılmaz. Apple Vision ve denetlenmiş offline fallback yalnız tasarım hedefidir. Harici sağlayıcı hiçbir zaman sessiz fallback değildir.

Harici OCR; ayrı açık rıza, gönderilecek veri önizlemesi ve redaksiyon, exact sağlayıcı yapılandırması, bölge, retention, silme ve sözleşme doğrulaması olmadan görünmez ve kullanılamaz kalır. Bu karar provider availability, ağ teslimi, bölgesel saklama veya uzaktan silme garantisi vermez.

## Worker, format ve kaynak sınırı

Belge parser/OCR, renderer veya ana Electron sürecinde sınırsız çalışamaz. Ayrı düşük yetkili süreç; exact kaynak kimliği/SHA, tek kullanımlık iş kimliği, izin verilen format lane’i, maksimum dosya/envelope boyutu, sayfa, piksel, CPU/RAM ve süre sınırlarıyla başlamalıdır. Ağ capability’si varsayılan kapalı kalır. Process crash/timeout/cancel durumunda düz metin dosya, log veya cache kalıntısı bırakılamaz.

Önceki cancellation transaction-topology açığı iki fazlı `job_run_begin` → detached main-only worker lease → `job_run` finalizasyonuyla kapatılmıştır. Begin kısa transactionı commit olduktan sonra worker çalışır; eşzamanlı `Cancel` ayrı yetkili kısa transactionda runtime’a ulaşır (`cancellationRuntimeCalls=1`), kalıcı `cancel_requested` state’i commit olur ve FIFO final transactionı bundan sonra terminal `cancelled` state’ini yazar. Production UoW + active-guard executor probe’u ve repository state-machine negatif testi PASS’tir. Bu local otomatik kanıt gerçek cihaz, accessibility veya human cancellation UAT değildir.

Görüntü OCR, PDF gömülü metin çıkarma ve taranmış PDF OCR ayrı format lane’leridir. PDF JavaScript, ek dosya, harici referans, font/parser saldırısı, zip bomb, aşırı sıkıştırma ve dev görüntü senaryoları açık negatif test olmadan desteklenmiş sayılamaz.

## Sonuç, arama ve kullanıcı kontrolü

OCR sonucu kaynak SHA/sürüm, sayfa, dil, koordinat, confidence, provider/model sürümü ve türev hash ile bağlanmalıdır. OCR metni ve indeksler şifreli kalır; düz metin temp/log/cache yasaktır. Tam metin indeks ve snippet sorgusu aynı merkezi yetki, sahiplik, policy, retention ve maskeleme kararından geçer.

Arşiv ekranındaki tek panel; oluşturma, çalıştırma, queued veya running iş için iptal, explicit sonuç gösterme, düzeltme, yeniden çalıştırma, silme ve global enable/disable için dokuz dar bridge yöntemini kullanır. `cancel_requested` yeniden tetiklenemez. Retry aynı `clientOperationId` ve original `expectedRevision` ile idempotent kalır; source-delete renderer’a açılmaz. Bu UI kaynak/test kanıtıdır, erişilebilirlik/human UAT veya requirement kapanışı değildir. Tam metin indeks ve policy-filtered/masked snippet henüz yoktur. OCR çıktısı resmî belge doğrulaması, sağlık teşhisi, finansal gerçek veya hukuki sertifikasyon değildir.

OCR metni AI’ya otomatik verilmez. Özet, çeviri, transkript ve embedding üretimi için ayrı `ai_process` kararı ve PPK-016 politika mirası gerekir.

## Silme, senkronizasyon ve audit sınırı

Kaynak imhası veya izin/rıza iptali OCR metni, tam metin indeksi, embedding, cache, özet, çeviri, transkript ve replica owner’larını karantina/silme planına almalıdır. Yönetilen yedek temiz yeniden yazımı doğrulanana kadar pending kalır. SSD/NTFS fiziksel secure erase, yönetilmeyen kopya veya ağ üzerinden silme garantisi verilmez.

Kaynak imhası ile OCR propagationı ayrı başarılı işlemler olarak garanti edilemez. DataStore artık prepare → doğrulanmış source-file destroy → OCR purge/ledger → archive mark sırasını izler; source destroy başarısızsa OCR ledgerında silindi iddiası üretilmez. Ancak dosya imhası başarılı olduktan sonra OCR propagationından önce process crash olursa türetilmiş sonuç kalabilir. Same-operation manuel retry testi durable otomatik devam kanıtı değildir. Crash-window state machine ve açılışta owner-bound/idempotent auto-resume tamamlanmadan residual risk `HIGH`, PPK-019 atomic/guaranteed propagation ile OCR-020/source-deletion evidence ve acceptance `false` kalır.

Bu sınır yalnız yönetişim metninde değildir: domain center truth ve güvenli IPC projector/validator `sourceDeletionAutoResumeGuaranteed:false` alanını exact taşır; renderer bunu garanti gibi sunamaz.

Object-permission veya `sensitive_processing` rıza iptal/expiry olayı yeni OCR admissionını fail-closed durdurur; fakat mevcut sealed OCR sonucunu ve ilerideki index/embedding/cache ownerlarını otomatik karantina/purge eden production propagation zinciri yoktur. “Yeni işlem reddedildi” mevcut türevin silindiği anlamına gelmez; bu yol tamamlanmadan OCR-020 kapanmaz.

Apple cihazlara yalnız exact policy-authorized türetilmiş indeks/özet gönderilebilir; ham belge ve tam metin ayrı izin ister. Gerçek çapraz cihaz teslimi yapılmış sayılmaz ve teslim sürekliliği garanti edilmez.

Audit/outbox ve mutation receipt’leri içeriksiz metadata ile sınırlıdır; corrected text request fingerprintine yalnız SHA-256 olarak girer. Belge adı, OCR metni, snippet, path veya kullanıcı içeriği loglanmaz. Bu local source/test gerçeği retention/human review acceptance değildir.

Retention metadata job/lineage üzerinde taşınır; ancak expiry sonrası sealed result ve gelecekteki index/cache türevlerini owner-bound otomatik purge eden scheduled maintenance PEP/wiring yoktur. Startup repair ve bounded orphan candidate traversal bu eksikliği kapatmaz; OCR-009 retention acceptance açık kalır.

## Açık engeller

- 33-P atomik kapanışı ve dış/manuel kanıtları tamamlanmamıştır.
- Yerel domain/application/repository, transaction, PEP/UoW, sealed vault/runtime, DataStore facade, IPC ve UI `14 dosya / 103 test PASS` ile `PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED / ACCEPTANCE_INCOMPLETE` durumundadır. Registry atomik kapanış kaydı bu kısmi snapshot için değiştirilmemiştir.
- Zararlı dosya providerı ve PDF rasterizer yoktur; child-process separation düşük yetki sandbox kanıtı değildir.
- Exact `ocr_process` receipt + ayrı `sensitive_processing` rızası, owner-bound sealed-result vault ve local metadata owner zinciri yerel testtedir; policy-filtered tam metin index/snippet ve gerçek cihaz acceptance yoktur.
- Owner-bound sealed-result purge ile source-delete çoklu iş batch/current-row/repository-derived immutable item-ledger ve rollback zinciri yerel testlerde doğrulanmıştır. Durable crash auto-resume olmadan OCR-020 kabulü yoktur.
- HIGH: DataStore fail-honest source-destroy-first sırasına alınmıştır; fakat source file success ile OCR propagation arasında crash olursa türev sonuç kalabilir. Durable auto-resume/recovery state machine yoktur; PPK-019 atomic/guaranteed propagation ve OCR-020/source-deletion acceptance `false` kalır.
- Permission veya `sensitive_processing` rıza iptal/expiry sonrasında mevcut OCR türevlerini otomatik purge eden propagation wiring/testi yoktur; OCR-020 acceptance `false` kalır.
- İki fazlı Run/Cancel local production-executor probe’u PASS’tir; running Cancel runtime’a ulaşır ve finalizasyon Cancel commit’inden sonra tamamlanır. Gerçek cihaz, accessibility ve human cancellation UAT yine `NOT_RUN` kalır.
- Sealed-result startup repair ve bounded orphan taraması bileşen olarak testlidir; distinct maintenance PEP/authority ile scheduled production sweep bağlanmamıştır.
- Retention expiry sonrası sealed result/türev otomatik purge zinciri kanıtlı değildir; OCR-009 retention acceptance `false` kalır.
- Yeni archive import receipt’leri ownerPersonId bağlıdır; fakat eski immutable receipt’lerde ownerPersonId null olduğunda OCR fail-closed kalır ve legacy ownership re-attestation/backfill otoritesi yoktur.
- Windows yerel OCR, Apple Vision, offline fallback, malicious PDF/zip bomb/dev görüntü/bozuk font, çok dil, el yazısı, düşük kalite, erişilebilirlik ve cross-device kanıtları `NOT_RUN` durumundadır.
- Harici sağlayıcı yapılandırılmamıştır; privacy/legal/security/human review ve persistent receipt `NOT_RUN` durumundadır.

Bu karar `COMPLETE`, requirement `PASS`, harici sağlayıcı sertifikasyonu veya persistent receipt iddiası değildir.
