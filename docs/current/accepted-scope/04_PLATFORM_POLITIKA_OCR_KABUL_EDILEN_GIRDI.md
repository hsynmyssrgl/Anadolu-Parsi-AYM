# Anadolu Parsı Aile Yaşam Merkezi
## Planlanan Bronze 04.08.2026.27 — Platform Politika Çekirdeği ve OCR Güvenlik Sözleşmesi

> Durum: Kaynak denetimi ve bağlayıcı kapsam kararıdır. Henüz yeni kaynak derlemesi veya PASS kanıtı değildir.

## 1. Gerçek Build228 sonucu

### OCR

Build228 gerçek kaynak ağacında:

- OCR motoru,
- OCR provider/adapter portu,
- görsel veya taranmış PDF metin tanıma use-case'i,
- OCR veri tablosu,
- OCR tam metin indeksi,
- OCR kullanıcı ekranı,
- OCR testi

bulunmamıştır.

`package.json`, `package-lock.json`, `apps/**`, `packages/**`, `tests/**` ve `config/**` üzerinde yapılan taramada Tesseract, Windows OCR, Apple Vision, PDF OCR veya haricî Document AI bağımlılığı görülmemiştir.

Mevcut arşiv araması `title`, `original_name`, `mime_type` ve etiket metadata'sında çalışmaktadır. Dosyanın içindeki metni okuyup aramamaktadır. `aiProcessingAllowed` alanı vardır fakat gerçek OCR/AI işleme akışı değildir.

**Sonuç: OCR = YOK / BAŞLANMADI.**

## 2. Mevcut güvenlikte güçlü olanlar

Build228'de gerçek kod karşılığı bulunan başlıca korumalar:

- ortak `@ppt/security` paketi ve `CentralAuthorizationService`,
- parola, TOTP, kurtarma kodları ve cihaz kimliği,
- şifreli kullanıcı kasası ve korumalı yan artifactlar,
- Electron `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`,
- güvenilir renderer gönderen doğrulaması,
- IPC payload boyut/derinlik/prototip güvenliği,
- navigation, webview, permission ve download varsayılan reddi,
- archive hash/sürüm/audit ve uygulama içi güvenli önizleme,
- audit hash zinciri, yedek ve restore güvenlik sınırları.

Bunlar korunacaktır; yeni platform katmanı bunları zayıflatmayacak, merkezileştirip bütün uygulamalara zorunlu kılacaktır.

## 3. Evrensel politika uygulaması henüz tamamlanmış değildir

Kaynakta merkezi yetkilendirme kullanımı vardır; fakat `packages/application` ve `apps/desktop` içinde en az **22 doğrudan `family_admin` rol kontrolü** de bulunmaktadır. Bunların bazıları doğru admin-only işlemleri koruyor olabilir; bu bulgu doğrudan veri ihlali kanıtı değildir. Fakat bütün güvenlik kararlarının tek merkezi politika çekirdeğinden çıktığı henüz kanıtlanamaz.

Mevcut yetki bağlamında rol, eylem, nesne, sahip, açık allow/deny, süre, privacy ve finance/health hassasiyet bilgileri bulunur. Ancak bütün gelecekteki uygulamalar için zorunlu olan:

- uygulama ve servis kimliği,
- cihaz güven durumu,
- aile dalı/hane,
- işlem amacı,
- rıza ve hukuki işleme bağlamı,
- çocuk/iletişim/konum/miras sınıfları,
- maskeleme/no-cache/no-export/no-AI/no-record yükümlülükleri,
- çevrimdışı yetki süresi,
- politika paketi sürüm/hash uyumu

tek karar modelinde henüz tamamlanmış değildir.

## 4. Kesin karar: Platform Policy Kernel

Bütün Windows, macOS, iPhone, iPad, Watch, Vision Pro, Core Service, cluster-agent, OCR worker, AI worker, iletişim/media service, backup worker ve üçüncü taraf adapterleri aynı **PlatformPolicyKernel** kullanacaktır.

Hiçbir uygulama kendi rol tablosunu, gizlilik yorumunu veya “bu kullanıcı yöneticidir, geçsin” kararını yazamaz.

### Karar akışı

1. Uygulama yalnız imzalı app/device kimliğiyle istek oluşturur.
2. API gateway isteğin şema, payload ve capability manifestini doğrular.
3. Policy Enforcement Point tam `PolicyContext` üretir.
4. PlatformPolicyKernel allow/deny ve zorunlu yükümlülükleri döndürür.
5. Use-case yükümlülükleri uygular.
6. Repository yalnız policy receipt içeren transaction context kabul eder.
7. Audit kararın policy sürümünü, hash'ini ve sonucunu kaydeder.
8. Karar üretilemiyorsa işlem reddedilir.

### PolicyContext

- user/account/person
- deviceId, appId ve serviceId
- family, household ve familyBranch
- role ve membership durumu
- action, resourceType ve resourceId
- owner ve subject
- data classification
- purpose
- consent/recording consent
- startsAt/endsAt
- network/offline state
- cluster leader/quorum state
- policyVersion ve keyEpoch

### Policy obligations

Karar yalnız izin/ret değildir. Şunları zorunlu kılabilir:

- alan maskeleme,
- yalnız cihazda işleme,
- cache etmeme,
- clipboard engeli,
- dışa aktarım engeli,
- AI işleme engeli,
- kayıt engeli,
- watermark,
- belirli saklama süresi,
- online yeniden doğrulama,
- güçlü yeniden kimlik doğrulama,
- audit seviyesi,
- türev veriyi kaynakla birlikte silme.

## 5. Uygulamalar politikayı nasıl aşamaz?

### Derleme zamanında

- UI/Core Service dışı doğrudan repository ve SQL importu yasak.
- Merkezi kernel dışı rol kontrolü fail gate.
- Doğrudan crypto kullanımı fail gate.
- Allowlist dışı network endpoint fail gate.
- Capability manifestte olmayan kamera/mikrofon/OCR/AI/konum/dosya kullanımı fail gate.
- Policy çağrısı olmayan hassas use-case fail gate.
- Policy receipt olmadan repository transactionı derlenemez.
- Her app aynı conformance test paketini geçer.

### Çalışma zamanında

- İmzalı ve hash bağlı policy bundle.
- Policy sürümü uyuşmazlığında hassas işlemler reddedilir.
- Her app/service/device mTLS kimliği taşır.
- UI'da görünür olması yetki sağlamaz.
- Apple uygulaması tüm işlemleri Core Service'te yeniden yetkilendirir.
- Çevrimdışı cache, süresi sınırlı capability lease ile açılır.
- Cihaz/uygulama iptalinde anahtar ve capability anında geçersiz olur.
- Failover olan yeni leader aynı policy version ve revocation state olmadan yazı kabul edemez.

## 6. OCR güvenli tasarımı

### İşleme sırası

1. Dosya şifreli kasaya alınır.
2. MIME/magic-byte, boyut, sayfa/piksel limiti ve zararlı dosya taraması yapılır.
3. Kullanıcı kaynak belgeyi okuma ve `ocr_process` amacına sahip mi kontrol edilir.
4. Kaynak sınıfı ve OCR politikası belirlenir.
5. OCR ayrı sandbox worker'da yerel olarak çalışır.
6. Sonuç confidence ve koordinatlarla oluşturulur.
7. OCR metni kaynak belgenin bütün izinlerini ve hassasiyetini devralır.
8. Şifreli indeks oluşturulur.
9. Audit yalnız kimlik/hash/provider/sonuç tutar; metni tutmaz.
10. Kaynak silinir veya izin iptal edilirse OCR, indeks, AI hafızası ve cache de kapanır.

### Provider sırası

Windows:
1. Kararlı ve cihazda kullanılabilir Windows yerel OCR.
2. Denetlenmiş offline fallback.
3. Haricî servis yalnız ayrı kullanıcı kararı ve sözleşme ile.

Apple:
1. Vision `RecognizeTextRequest`.
2. Yerel/offline sonuç ve ortak OCR sözleşmesine dönüştürme.
3. Core Service policy yeniden değerlendirmesi olmadan senkronizasyon yok.

Yeni Windows AI OCR API'lerinin NPU gerektirebildiği ve bazı yüzeylerinin ön sürüm olabileceği dikkate alınacaktır. Bu nedenle tek API'ye bağımlı kalınmayacak; provider capability/readiness sistemi kullanılacaktır.

### OCR türetilmiş veri kaydı

- sourceArchiveItemId
- sourceVersionId
- sourceSha256
- pageNumber/frame
- recognizedText
- language
- confidence
- bounding polygons
- providerId ve providerVersion
- policyReceiptId
- classification ve owner
- retention policy
- createdAt/updatedAt
- user corrections
- derivedArtifactSha256

## 7. Mutlak güvenlik ifadesinin dürüst karşılığı

Hiçbir gerçek yazılım için “ihlal teknik olarak imkânsızdır” garantisi verilemez. Uygulanacak bağlayıcı hedef şudur:

- bilinen politika ihlaliyle build kapanamaz,
- policy kararı olmadan hassas işlem yapılamaz,
- politika altyapısı arızasında sistem fail-closed davranır,
- tespit edilen ihlal P0'dır ve Silver/Gold'u bloklar,
- güvenlik zayıflatma açık kullanıcı kararı ve yeni policy sürümü olmadan yapılamaz,
- çalıştırılmayan güvenlik testi PASS sayılamaz.

Bu, gerçekçi ve denetlenebilir “sıfır tolerans” yaklaşımıdır.

## 8. Mevcut ilerlemeye etkisi

OCR daha önce genel fikir olarak listelenmiş olsa da gerçek kodu yoktur. Platform Policy Kernel ise mevcut güvenlik paketinin genişletilmesi ve merkezileştirilmesidir.

Son geniş kapsam değerlendirmesi %33–36 idi. Bu kaynak denetiminden sonra:
- **genel Bronze gerçeklik aralığı: %31–34**
- **OCR: %0**
- **evrensel platform policy enforcement: yaklaşık %30–40 altyapı var, zorunlu kapanış yok**
- **Silver: %0 / HAZIR DEĞİL**

Tahmini ek odaklı iş:
- PlatformPolicyKernel ve policy receipt: 8–12 gün
- Bütün use-case/repository/API göçü: 10–18 gün
- Static/build/runtime policy gates: 6–10 gün
- OCR domain/provider/worker/index/UI: 10–16 gün
- Cross-platform conformance ve kötü niyetli dosya testleri: 6–10 gün

Paralel yürütmede ek etki yaklaşık **25–38 odaklı iş günü**dür. Bu iş, diğer modüllerde dağınık güvenlik kodunu azaltacağı için sonraki geliştirmelerin güvenli ve sürdürülebilir olmasını kolaylaştırır.

## 9. İlk kodlama sırası

1. `@ppt/platform-policy` sözleşmesi ve `PolicyContext/Decision/Obligation/Receipt`.
2. Core Service/API için merkezi Policy Enforcement middleware.
3. Repository transactionlarında zorunlu policy receipt.
4. Mevcut doğrudan `family_admin` kontrollerini sınıflandırıp merkezi politikaya taşıma.
5. AST tabanlı `PLATFORM_POLICY_GATE`.
6. Uygulama capability manifest ve app/service identity.
7. OCR domain, schema ve `OcrProviderPort`.
8. Sandboxed local OCR worker ve encrypted derived-text repository.
9. OCR UI, correction, encrypted search ve deletion cascade.
10. Windows/Apple/service policy conformance test paketi.

## 10. Zorunlu bitiş durumu

- Kanal: Bronze
- Sıradaki görünür kaynak sürümü: **Bronze 04.08.2026.27**
- Build228 OCR durumu: **YOK**
- Evrensel policy enforcement durumu: **KISMI / KAPANIŞ YOK**
- Bu aşamada kaynak kod değişikliği: **YAPILMADI**
- Güncel Bronze tahmini: **%31–34**
- Silver'a geçiş: **YASAK / HAZIR DEĞİL**
- Sonraki tek resmî iş: `@ppt/platform-policy` ve `PLATFORM_POLICY_GATE` kodlaması
- Bitiş cümlesi: Bu teslim kaynak denetimi ve bağlayıcı güvenlik sözleşmesidir; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
