
## DEC-226 - Gizlilik sahiplik veri haklari ve olay kontrolu

33-O dokuz requirement icin merkezi PEP/UoW, migration 92, yerel gozlem, sifreli export ve no-claim sinirlarini baglar. Ayrinti: docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md.

## Güncel uygulama notu — Core Service companion ve dağıtım gerçeği

DEC-168/169/190/195/203/205/248 sınırları altında Core Service, paketlenmiş Desktop tarafından ayrı Electron utility companion sürecinde başlatılır. Kalıcı politika anahtarı CurrentUser DPAPI korumalı yan-artifact içindedir; her açılışta yeni yerel named-pipe ve 48 baytlık bağlantı tokenı üretilir, gizli değerler komut satırı veya renderer'a verilmez. Güncel `win-unpacked` paketinde companion ASAR girdisi doğrulanmış ve aynı profilde iki ardışık normal açılış DPAPI `created`/`verified` sonucuyla PASS olmuştur. Eski `C:\\Program Files\\@pptdesktop` kurulumu kaldırılmış; güncel imzasız yerel paket koşulsuz `C:\\Program Files\\PPT\\AYM` hedefine kurulmuş ve masaüstü/Başlat hedefleri, dosya SHA-256 eşliği, yanıt veren ana pencere, renderer ve Core Service utility süreci doğrulanmıştır. Bu çalışma Desktop aile-verisi/SQLite sahipliğini Core Service'e taşımaz, Windows SCM hizmeti veya çoklu node cutover oluşturmaz. Production Authenticode sertifikası/yayıncı güven değerleri dışarıdan sağlanmadığı için çalıştırılabilir dosya `NotSigned`; signed installer, temiz işletim sistemi, upgrade/repair/yeni uninstall-veri koruma ve uzun süreli Windows yaşam döngüsü kanıtı `NOT_RUN` kalır.


## DEC-225 - Taslak ve asenkron durum UX

33-N; B3-02, B7-14 ve B7-15 icin merkezi form_draft PEP/UoW, immutable revision history, immediate undo, accessible validation ve fail-closed async state sozlesmesini baglar. Ayrinti: docs/decisions/DEC-225-draft-async-state-ux.md.

# Ana Karar Kaydı — Build 180

## DEC-224 — Erişilebilirlik tercih merkezi

33-M kapsamında B7-01–B7-13 tek kalıcı kişisel tercih merkezi olarak uygulanır. 16 px görünür metin tabanı, yüzde 100–225 uygulama ölçeği, reflow, klavye ve duyuru semantiği, forced-colors, azaltılmış hareket, 44 px hedefler, kolay okuma, beş profil, açık tema ve bilgi saklamayan yoğunluk kipleri aynı modelden yönetilir. Tercihler merkezi PEP/UoW, optimistic revision ve idempotent replay ile saklanır; uygulama işletim sistemi ayarlarına yazmaz ve ağ kanalı açmaz. Narrator, Magnifier, gerçek cihaz ve insan UAT çalıştırılmadıkça sertifika iddiası kurulmaz. Ayrıntı: `docs/decisions/DEC-224-accessibility-preference-center.md`.

## DEC-223 — Finans / Uzun Vadeli Portföy merkezi

33-L kapsamında LTP-001–LTP-008 tek paket olarak uygulanır. Finans altında ayrı
Uzun Vadeli Portföy menüsü; stable kimlikli ve sürümlü ürün kataloğu, tam %100
mühürlü aylık katkı/dağılım sürümleri, aynı kıymete devreden bütçe, değişmez
alım-satım ve kurumsal olay defteri, maliyet/P&L, grafikler ve 13 Ağustos 2032
nominal/reel senaryolarını içerir. Kıymetler arası aktarım tek atomik, adetsiz ve
aynı para birimli bütçe virmanıdır. Sistem broker emri, para hareketi veya canlı
fiyat teslimi yapmaz; yatırım tavsiyesi, getiri, vergi/hukuk doğruluğu ya da sonuç
garantisi vermez. Ayrıntı: `docs/decisions/DEC-223-long-term-portfolio-center.md`.

## DEC-222 — Gizlilik, süreli rıza ve kayıp cihaz kapatma merkezi

33-K kapsamında B5-06 ve EXT-039 birlikte uygulanır. Canlı konum paylaşım otoritesi varsayılan kapalı, açık rızalı, 15 dakika–30 gün süreli, görünür göstergeli, değerlendirme anında otomatik sona eren ve derhal iptal edilebilir yapıdadır. Kayıp cihaz işlemi güçlü yerel doğrulama ve merkezi PEP/UoW ile security_epoch, trusted_devices, offline lease ve rıza kayıtlarını atomik olarak kapatır. Uzaktan silme, MDM, ağ teslimi/teslim garantisi veya gerçek konum aktarımı değildir. Ayrıntı: `docs/decisions/DEC-222-privacy-consent-lost-device-control-center.md`.

**Aktif sürüm:** Bronze 04.08.2026.29

> Güncellik notu (17.08.2026): Bu dosyadaki ayrıntılı anlatım Build228'e kadar olan karar zincirini korur. DEC-121–DEC-250 dahil eksiksiz canlı karar dizini, kanonik kural ve paket durum eşlemesi `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md` içindedir; tarihsel satırlar silinmez.

**Belge kimliği:** `PPT-ADR-MASTER-146`  
**Ürün:** Anadolu Parsı Aile Yaşam Merkezi  
**Marka kimliği:** Panthera pardus tulliana  
**Sürüm:** `28.07.2026.146`  
**Aşama:** Bronze RC2 Active Development

## 1. Amaç

Bu belge, proje büyüdükçe farklı sohbetlerde, tarihsel PDF/DOCX paketlerinde,
ADR kayıtlarında ve Build 1–126 geliştirme notlarında oluşan bağlayıcı kararları
tek bir yetkili kayıtta birleştirir. Kararlar ilgili uzmanlık belgelerine de
aktarılmıştır; bu kayıt ise kararların kaynağı, önceliği ve etkisini izler.

## 2. Karar önceliği ve çelişki çözümü

Bir çelişki olduğunda aşağıdaki sıra uygulanır:

1. En son açık ve bağlayıcı kullanıcı kararı.
2. Güncel aktif kaynak sözleşmesi, `APP_META`, aktif Build durumu ve çalışan veri şeması.
3. Bu Ana Karar Kaydı ve Build 127 aktif belge manifestosu.
4. Güncel ADR, güvenlik, kapsam, test ve mimari belgeleri.
5. Tarihsel Build, sürüm notu, PDF/DOCX ve sohbet kayıtları.

Eski kararlar silinmez; tarihsel kanıt olarak korunur. Ancak aktif ürün davranışını
belirleyemez. Çelişki sessizce birleştirilmez; değişiklik kaydına işlenir.

## DEC-221 — Yönetişimli çevrimdışı acil kart, yazdırılabilir/PDF çıktı, şifreli belge paketi ve pil-duyarlı kip

33-J ile B5-03 ve EXT-016, 33-I'nin bağımsız `private` acil yardım profilini kaynak alan
tek bir yönetişimli çıktı diliminde birlikte uygulanmıştır. Kapalı alan seçimi,
yazdırılabilir/PDF çıktı, bağımsız parola anahtarlı şifreli belge paketi ve manuel
pil-duyarlı kip Migration 88 ile kalıcılaştırılır. Pil yüzdesi veya
otomatik düşük-pil tespiti iddia edilmez. Gerçek dosya çıktısı genel `no_export` ilkesini
gevşetmeden exact `file.share`, işleme bağlı güçlü kimlik doğrulama ve ayrı arşiv PEP
kararıyla sınırlandırılır. Ağ, mesaj veya bulut teslim kanalı eklenmez. Ayrıntılı karar:
`docs/decisions/DEC-221-family-emergency-card-portability.md`

## DEC-220 — Çevrimdışı özel acil sağlık/iletişim kartı ve yardım profili

33-I ile EXT-012 ve EXT-014 mevcut aile acil durum planına ilişkisel olarak bağlanan,
ancak planın aile görünürlüğünü yetki olarak miras almayan ayrı bir append-only LIFE
kökünde birlikte uygulanır. Bütün kartlar exact `private`; evcil hayvan profili aynı
ailedeki sorumlu kişiye aittir. Sağlık özeti, iletişim kişisi ve özel yardım talimatları
yalnız manuel/yerel veridir. Mevcut iki LIFE IPC kanalı korunur; sağlık sağlayıcısı,
mesaj/acil servis, dışa aktarım, PIN paylaşımı veya ağ kanalı açılmaz. Ayrıntılı karar:
`docs/decisions/DEC-220-family-emergency-assistance-card.md`

## DEC-219 — Çevrimdışı 72 saat çantası ve afet tatbikatı defteri

33-H ile EXT-011 ve EXT-015 mevcut aile acil durum planına bağlı tek append-only
hazırlık defterinde birlikte uygulanır. 72 saat çantası, maddeleri ve en son manuel
kontrol olayları ile deprem, yangın, sel ve elektrik kesintisi tatbikat geçmişi
aynı planın family/owner/privacy sınırını miras alır. Mevcut iki LIFE IPC kanalı
korunur; barkod/son kullanma doğrulaması, bildirim, sensör veya ağ kanalı açılmaz.
Hazır olma ya da acil müdahale garantisi verilmez. Ayrıntılı karar:
`docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md`

## DEC-218 — Çevrimdışı aile acil durum planı ve kişi durumu

33-G ile B5-07, EXT-009, EXT-010 ve EXT-013 tek append-only
`family_emergency_ledger` üzerinde birlikte uygulanır. Afet/tahliye planı,
birincil/alternatif buluşma noktaları, şehir dışı irtibat, kontrol listesi ve en son
üye `safe` / `needs_help` durumu yerel LIFE policy sınırında tutulur. Üye kendi
durumunu bildirebilir; merkezi politika ile yetkili başkası adına bildirim makbuz öznesi ve
`reportedByPersonId` ile açıkça bağlanır. Veri manuel ve çevrimdışı yereldir; harita,
canlı konum, mesaj teslimi veya acil servis çağrısı/garantisi yoktur. Ayrıntılı karar:
`docs/decisions/DEC-218-family-emergency-planning.md`

## DEC-217 — Ev envanteri, sayaç, tüketim, eşya, garanti ve servis defteri

33-F ile EXT-030 ve EXT-032, mevcut yönetilen `home` yaşam profilinin altında
append-only bir ev envanteri defteriyle birlikte uygulanır. Oda/alan, sayaç ve
integer milliunit okuma geçmişi; eşya, garanti, servis ve opaque belge bağlantısı
aynı kökün family/owner/privacy sınırını miras alır. Alt kayıtlar exact
`life_record/update` makbuzuna bağlanır; update/delete yerine yeni superseding olay
kullanılır. Veri yalnız manuel girilir; akıllı sayaç/garanti sicili sorgusu, OCR,
belge içeriği ifşası, servis sağlayıcı iletişimi ve ödeme icrası yapılmaz. Ayrıntılı
karar: `docs/decisions/DEC-217-home-inventory-utility-belongings.md`

## DEC-216 — Kategoriye özgü yaşam, ev ve araç defteri

33-E ile B5-04, EXT-031 ve EXT-034 Migration 83 ile tek append-only
`life_managed_ledger` üzerinde
kök profil, faaliyet ve opaque belge bağlantısı olarak birlikte uygulanır. Kök kayıt
exact `life_record/create`, alt kayıtlar exact `life_record/update` makbuzuna
bağlanır; family/owner/privacy kapsamı aynen miras alınır. Ev için kira, tapu, DASK,
konut sigortası ve servis; araç için ruhsat, sigorta, muayene, bakım, yakıt, şarj ve
gider akışları manual-only çalışır. Dış sicil sorgusu, sağlayıcı iletişimi, belge
içeriği ifşası veya ödeme icrası yapılmaz. Ayrıntılı karar:
`docs/decisions/DEC-216-b5-category-life-home-vehicle.md`

PPK-021 güncel ratchet 590 exact yüzey ve 297 use-case composition yüzeyidir;
PPK-022 güncel exact capability ratchet 254'tür.

## DEC-215 — Kontrollü finans içe aktarma ve ağsız ÖHVPS sınırı

33-D ile B4-13 ve B4-14 tek kontrollü içe aktarma teslimatında tamamlanır. CSV,
TSV, XLSX, OFX ve QFX dosyaları ana süreçte seçilir; dosya yolu ve ham içerik
renderer'a verilmez. Exact sütun eşleme, geçici önizleme, SHA-256 tekrar çiti ve
tek finance PEP işlemi içinde staging→committed seal uygulanır. Yerel
`ohvps-v1-local` adapter yalnız sentetik sandbox ve kontrollü dosya tabanlı manuel
fallback sunar; canlı banka bağlantısı, kimlik bilgisi, token, sertifika, dış rıza,
uzak eşitleme ve ödeme icrası yoktur. Migration 82 eklenir; PPK-021 543 exact
yüzeye ve 275 use-case composition yüzeyine çıkar, PPK-022 238 kalır. Ayrıntılı
karar: `docs/decisions/DEC-215-b4-controlled-import-open-banking.md`

## DEC-214 — B4 finans planlama, portföy ve analiz merkezi

33-C ile B4-10, B4-11 ve B4-12 tek append-only finans planlama defteri ve türetilmiş
okuma modelinde tamamlanır. Kategori, bütçe, nakit akışı, yinelenen işlem, hedef,
portföy ve değerleme geçmişi merkezi finance PEP ve exact kalıcı receipt altında
bağlanır. Net değer, borç oranı, bütçe sapması ve yaklaşan ödeme aile/kişi ile para
birimi bazında hesaplanır; kur dönüşümü, dış fiyat, banka eşitlemesi veya ödeme
icrası yapılmaz. Migration 81 eklenir; PPK-021 542 exact yüzeye ve 274 use-case
composition yüzeyine çıkar, PPK-022 238 kalır. Ayrıntılı karar:
`docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md`

## DEC-213 — B4 kredi ve ödeme geçmişi yönetimi

33-B ile B4-08 ve B4-09 tek korumalı kredi aggregate'ında tamamlanır. Kredi türü,
oran, vade, taksit, kalan anapara, yerel ödeme planı, erken kapama teklifi, gecikme,
sigorta, teminat ve append-only ödeme geçmişi merkezi finance PEP ve exact kalıcı
receipt altında bağlanır. Veriler manueldir; banka doğrulaması/senkronizasyonu,
resmi amortisman planı veya ödeme icrası iddia edilmez. Migration 80 eklenir;
PPK-021 540 exact yüzeye ve 272 use-case composition yüzeyine çıkar, PPK-022 238
kalır. Ayrıntılı karar:
`docs/decisions/DEC-213-b4-loan-management.md`

## DEC-212 — B4 kart ürünü ve takip otomasyonları

33-A ile B4-05 ve B4-06 tek korumalı kart aggregate'ında tamamlanır. Kurum, ürün,
kart ağı, tür/biçim, yalnız son dört hane, limit, kullanılabilir limit, borç,
ekstre, son ödeme, taksit özeti, otomatik ödeme takip modu, puan/mil, yıllık ücret
ve yerel uyarılar bağlanır. Tam PAN, CVV/CVC, PIN ve parola reddedilir; banka
talimatı veya ödeme icrası yapılmaz. Migration 79 eklenir; PPK-021 537 girdiye
çıkar ve PPK-022 238 kalır. Ayrıntılı karar:
`docs/decisions/DEC-212-b4-payment-card-management.md`

## DEC-211 — B4 banka kurumu, hesap, IBAN ve sır reddi temeli

32-Z ile TCMB 2026 Ödeme Sistemleri Katılımcıları kaynağına bağlı 71 kurum yerel
katalogda tutulur; uzak logo yerine yerel harf simgesi kullanılır. Banka hesabı
IBAN, tür, para birimi, alias, şube, sahiplik oranı, durum ve gizlilik alanlarıyla
merkezi finance PEP ve exact kalıcı receipt altında yazılır. Tam IBAN yalnız
korumalı SQLite içinde kalır; renderer maskeli görünüm, audit ve outbox içeriksiz
metadata alır. TR IBAN ülke, 26 karakter, MOD 97-10, beş haneli sağlayıcı, rezerv
alanı ve TCMB eşleşmesiyle yapısal olarak doğrulanır; gerçek hesap ve sahiplik
doğrulaması yapılmış sayılmaz. Tam PAN, CVV/CVC, PIN ve internet bankacılığı
parolası yeni hesap ve eski finans girişlerinde reddedilir. Migration 78 eklenir;
PPK-021 exact ratchet 535 girdiye çıkar, PPK-022 238 kalır. B4-01/02/03/04/07
tamamlanır; B4-05/06 açık kalır. Ayrıntılı karar:
`docs/decisions/DEC-211-b4-banking-foundation.md`

## DEC-210 — B2-05/B6-03 hassas veri rızası ve dışa gönderim önizlemesi

32-Y ile çocuk, sağlık, finans ve konum profilleri AI işleme ve dışa gönderim
amaçlarında ayrı, süreli, görünür ve varsayılan-ret izinlere bağlanır. Açık rıza
olmadan veya 15 dakika–30 gün sınırı dışında grant oluşmaz; iptal anında audit
edilir. Dışa gönderim önizlemesi yalnız kategori, kayıt sayısı ve alan etiketini
gösterir, hassas payload taşımaz ve `outboundTransferPerformed=false` kalır.
Yetki mevcut merkezi authorization service'in `administer` kararıdır; PPK-021
exact ratchet 531 girdiye ilerler ve doğrudan rol bypass sayısı sıfırdır. Mevcut
`ai_consents` şeması kullanılır; migration 77, Desktop vault ve SQLite sahipliği
değişmez. B2-05 ve B6-03 tamamlanır; gerçek dış aktarım, B2-02, PPK-025, B9-01,
Silver ve Bronze Final kapsam dışıdır. Ayrıntılı karar:
`docs/decisions/DEC-210-b2-05-b6-03-sensitive-data-consent-and-export-preview.md`

## DEC-209 — B2-03/B2-04 masaüstü oturum ve Electron güvenliği

32-X ile masaüstü oturumu 15 dakika gerçek kullanıcı etkinliği görülmediğinde
kilitlenir; son 60 saniye erişilebilir uyarı gösterilir. Arka plan işleri süreyi
uzatmaz, kilit React ağacını unmount etmez ve aynı hesap parola ile, etkinse TOTP
kodu da kullanılarak yeniden doğrulanır. Production renderer yalnız
`pardus-app://renderer` özel protokolünden ve köke hapsolmuş handler üzerinden
yüklenir; response CSP, sandbox/context isolation, Node kapatma ve izin/gezinme/
pencere varsayılan retleri zorunludur. Electron 43.2.0'ın dokuz fuse'u
`@electron/fuses 2.1.3` ile `strictlyRequireAllFuses` altında afterPack sırasında
yazılır ve bağımsız okunur. Eski sekiz-fuse aracının gerçek ikilide verdiği ret
maskelenmeden düzeltilmiş, dokuzuncu `WasmTrapHandlers` dahil 9/9 ikili kanıtı
alınmıştır. Yeni migration veya session tablosu yoktur; latest migration 77 kalır.
B2-03 ve B2-04 tamamlanır; B2-02, PPK-025, B9-01 ve genel Bronze kapanışı açık
kalır. Ayrıntılı karar
`docs/decisions/DEC-209-b2-03-b2-04-desktop-session-electron-security.md`
dosyasındadır.

## DEC-208 — B0-03/B0-04 ürün yüzeyi ve Feature Reality Gate

32-W ile masaüstü ürün yüzeyi tek domain sözleşmesinde 17 ürün modülü + 5 yönetişim yüzeyi = 22 rota olarak sabitlenir; renderer menüsü ve ekran dispatch zinciri aynı kaynaktan türetilir. Tarihsel 16 modül ifadesi, kontrol yüzeyleri ile kullanıcı iş akışlarını karıştırdığı için superseded kabul edilir. Main/preload'da kayıtlı fakat renderer tarafından çağrılmayan güncel exact 14 API kapalı taksonomiyle sınıflandırılır; yeni, eksik, duplicate veya sınıflandırılmamış rota/API drift'i pretypecheck ve prebuild'i fail-closed durdurur. Feature Reality Gate, `COMPLETE` gereksinimlerin 13 zincir alanının tamamını zorunlu tutar ve eksik zincir/sahte API/eksik rota negatif öz-testlerini çalıştırır. Yeni migration, veri taşıma, backfill, cutover veya sahiplik değişimi yoktur. B0-03 ve B0-04 birlikte tamamlanır; B9-01 ve genel Bronze kapanışı açık kalır. Ayrıntılı karar `docs/decisions/DEC-208-b0-03-b0-04-product-surface-governance.md` dosyasındadır.

## DEC-207 — PPK-026 typed policy SDK ve XPF-003 ortak finans/sağlık policy yolu

32-V ile `policy.authorize` ve `policy.verify` exact canonical schema'dan deterministik generated client olarak üretilir; kaynak veya manifest tek byte saparsa build durur. Ham Core Service policy sonuçları uygulamaya açılmaz; imzalı paket gözlemi, monotonic cluster fence ve provider mapping yalnız `CoreServicePolicySdk` içindedir. Unverified health, bozuk cevap veya gerileyen fence güvenilen paket ve fence durumunu temizleyerek fail-closed reddedilir. Arşiv, universal API, finans, sağlık, yaşam, konum ve timeline üretim consumer'ları tek typed PEP fabrikasına bağlanmıştır; doğrudan PEP kurulumu, ham wire metodu, ham sonuç tipi ve generated-client kaçışı pre-typecheck/pre-build AST kapısında reddedilir. Finans ve sağlık mevcut domain/repository/IPC/UI/menu zincirleriyle aynı provider/factory/obligation/receipt/fence yolunu kullandığı için PPK-026 ile XPF-003 birlikte tamamlanır. DHA-011'in HTTPS/WebSocket/gRPC/protobuf, OpenAPI/Protobuf codegen, N-1 ve dağıtık typed error kapsamı açık kalır. Yeni migration, veri taşıma veya sahiplik değişimi yoktur. Ayrıntılı karar `docs/decisions/DEC-207-ppk-026-typed-policy-sdk-and-xpf003.md` dosyasındadır.

## DEC-206 — PPK-025 fail-closed yazılım tedarik zinciri yayın kapıları

32-U; kök ve izole Windows packager lock graphlarını deterministik CycloneDX 1.6 SBOM, üçüncü taraf lisans/notice envanteri, üç ayrı güncel zafiyet taraması, iki registry-signature graphı, exact Electron/NSIS/NSIS-resources/winCodeSign hash pinleri ve DSSE/Ed25519 provenance kararı altında birleştirir. Eksik, stale, bozuk, kapsamı dar, imzasız veya hash/kimlik bağı uyuşmayan kanıt release'i fail-closed durdurur. `package:win` yalnız merkezi signed-release orkestratörüne gider; hem installer hem kurulu ana executable için gerçek Windows Authenticode `Valid`, exact publisher/certificate pini, code-signing EKU, güvenilir zincir ve timestamp zorunludur. Test/self-signed sertifika ve yalnız checksum production yetkisi değildir. Yeni migration, kullanıcı verisi taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Kod ve yerel kapılar uygulanmıştır; production code-signing sertifikası, repo dışı özel anahtar, trusted provenance key ve güncel imzalı PE artefaktları sağlanmadığı için release eligibility bilinçli olarak `DENY` ve PPK-025 kapanışı açık kalır. Ayrıntılı karar `docs/decisions/DEC-206-ppk-025-software-supply-chain-gates.md` dosyasındadır.

## DEC-205 — PPK-024 canlı policy-service availability runtime kapısı

32-T ile her korunan işlem authenticated Core Service health üzerinden yeniden availability değerlendirir; Core Service aynı gözlemde kendi policy paketini kernel HMAC ile doğrular. Startup health yalnız policy/paket sürümü ve paket SHA-256 pinidir; tarihsel receipt veya startup snapshotı güncel yetki değildir. Tam 30.000 ms yaş ve 5.000 ms future skew sınır içinde, 30.001/5.001 ms ilk ret değerleridir. Unavailable, malformed, invalid-signature, version/hash mismatch, future, stale, not-ready ve unsafe durumlarda hassas read ile mutation DENY edilir. READ_ONLY yalnız fresh, verified ve tutarlı non-writable ready/degraded durumda read için mümkündür; mutation açılmaz ve yetkili Core Service yolu imzalı `CLUSTER_NOT_WRITABLE` reddi üretir. Universal gate bootstrap'ı kapsar, PEP ikinci savunmadır; tek status IPC'si exact zero-argument/content-free/no-cache'tir ve kısıtlı mod hassas cache'i kilitler. Yeni migration, veri taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Final contract `71/71`, runtime `28/28`, tam Vitest `84/759` ve production workspace build `18/18` PASS ile PPK-024 tamamlanmıştır; PPK-025 açık kalır. Ayrıntılı karar `docs/decisions/DEC-205-ppk-024-policy-service-availability-runtime-gate.md` dosyasındadır.

## DEC-204 — PPK-023 uygulama güvenlik profili build kapısı

32-S ile on dört kanonik uygulama, exact `PlatformApplicationId` AST envanteri üzerinden ASVS 5.0.0, MASVS 2.1.0 ve final NIST SSDF 1.1 kontrol profillerine ve uygulama başına hash-bağlı threat model bölümüne bağlanır. Dört mobil Apple profili tam MASVS setini taşır; diğer profiller yalnız exact gerekçeli N/A kullanabilir. Yeni, eksik, duplicate, stale, sahipsiz workspace'li, sürümü/kontrolü sapmış veya hash'i bozuk profil build'i fail-closed durdurur. Eşleme uygunluk sertifikası, penetrasyon testi, native runtime PASS veya çalışma yetkisi değildir. Yeni migration, veri taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Ayrıntılı karar `docs/decisions/DEC-204-ppk-023-application-security-profile-gate.md` dosyasındadır.

## DEC-203 — PPK-022 imzalı capability manifest build/runtime kapısı

32-R ile kamera, mikrofon, dosya, OCR, AI, konum ve ağ kaynakları TypeScript/JSX AST üzerinde exact kaynak yüzeyi manifestine; çalışma zamanında ise imzalı uygulama manifestindeki exact capability kümesine bağlanır. Literal `executeJavaScript` içindeki korunan API'ler taranır ve çözülemeyen dinamik yürütme reddedilir. On dört kanonik uygulama eksiksiz listelenir; Windows Desktop `camera.access`, `file.access`, `microphone.access`, `network.access` ve `ocr.process`, Windows Core Service yalnız `file.access` ile `network.access` taşır. `ocr-worker`, `ai-worker` ve `communication-service` dahil diğer profiller boş ve yetkisizdir; Windows OCR için `lowPrivilegeSandboxVerified=false` gerçeği korunur. Çevrimdışı aile haritası bağı sonrası güncel ratchet 568 dosya / 428 exact yüzey ve `1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1` manifest SHA-256 değerine bağlıdır. Yeni beş yüzey yalnız sabit kullanıcı-verisi altındaki PMTiles paketinin salt-okunur ve bounded range okumasıdır; yeni ağ yüzeyi yoktur. Sabit `127.0.0.1:11434` döngüsel taşıması dışında genel uzak ağ yetkisi verilmez ve 26 bootstrap yüzeyi değişmemiştir. Bu aggregate Desktop kaydı genel uzak ağ, ayrı AI worker, fiziksel cihaz sertifikası veya çağrı teslimi iddiası değildir. Eksik, beklenmeyen, bozuk, hash/paket/uygulama/sürüm uyuşmazlıklı veya doğrulanmamış manifest fail-closed reddedilir. Desktop’ın Core Service el sıkışmasından önceki dosya bootstrap’ı ayrı sabit pin ile sınırlıdır; build manifesti tek başına runtime yetkisi değildir. Yeni veri taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Ayrıntılı karar `docs/decisions/DEC-203-ppk-022-capability-manifest-build-runtime-gate.md` dosyasındadır.

## DEC-202 — PPK-021 AST tabanlı fail-closed Platform Policy build kapısı

32-Q ile üretim TypeScript/JSX ağacındaki doğrudan SQL/SQLite, concrete repository/database, kripto, network, rol yetkilendirmesi ve use-case composition yüzeyleri `@babel/parser` AST üzerinde exact dosya+sembol manifestine bağlanır. Alias, destructuring, computed property, dynamic import, require ve `Reflect.construct` kaçışları taranır; parse hatası, wildcard, yeni veya stale yüzey build'i durdurur. Direct role authorization sıfır istisnalıdır; renderer rol koşulu yalnız presentation'dır. Çevrimdışı aile haritası bağı sonrası güncel ratchet 568 dosya / 889 exact yüzey ve `3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd` allowlist SHA-256 değerine bağlıdır. Harita kaynağı privileged AST yüzeyi eklemez; salt-okunur dosya importları PPK-022 içinde exact envanterlenir. Mevcut üç yüzey exact iki AI kullanım senaryosu composition'ı ile sabit `127.0.0.1` döngüsel HTTP taşımasıdır; gate runtime PEP/receipt/policy yerine geçmez ve genel uzak ağ yetkisi vermez. Yeni veri taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Ayrıntılı karar `docs/decisions/DEC-202-ppk-021-platform-policy-ast-fail-gate.md` dosyasındadır.

## DEC-201 — PPK-020 çok platformlu ortak policy conformance suite

32-P ile 14 kanonik uygulama/servis kimliğine aynı sıralı 22 vaka gerçek `PlatformPolicyKernel` üzerinden uygulanır. Signed package, strict context, application manifest ve device certificate baseline bağları zorunludur; target/case atlama ve sahte native runtime iddiası statik gate ile reddedilir. Yalnız Windows Desktop ile Windows Core Service deployed runtime sayılır; diğer on iki profil açıkça not-deployed/profile-only kalır ve referans harness üretim yetkisi vermez. Yeni migration, veri taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Ayrıntılı ve bağlayıcı karar `docs/decisions/DEC-201-ppk-020-cross-platform-policy-conformance-suite.md` dosyasındadır.

## DEC-200 — PPK-019 kaynak silme ve retention yayılımı

32-O ile kaynak kalıcı imhası; OCR metni, arama indeksi, thumbnail, AI hafızası, cache, replica ve yedek owner sınıflarına merkezi fail-closed planla yayılır. Üç runtime cache sahibi silme öncesi temizlenir; SQLite owner taraması iki kez yapılır; kaynak ve erişim metadata'sı aynı transactionda silinir, backup pending tombstone korunur. Yönetilen yedek pending kaydı yalnız doğrulanmış fresh korumalı yeniden yazım ve eski managed artefakt karantinası sonrası kapanır. Yönetilmeyen/harici kopya otomatik fiziksel imha edilmiş sayılmaz; quarantine destruction değildir. Yeni migration, gerçek veri taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yoktur. Ayrıntılı ve bağlayıcı karar `docs/decisions/DEC-200-ppk-019-source-deletion-propagation.md` dosyasındadır.

## DEC-199 — PPK-018 değişmez policy karar audit zinciri

32-N ile allow ve deny policy kararları; açık karar/ret nedeni, policy sürümü ve imzalı package bağı, exact yükümlülükler, request/context/receipt/record hashleri ile korumalı append-only journala yazılır. Ret dönüşü ve non-deferred izin operasyonu persistence öncesi açılamaz; yazım arızası fail-closed kalır. Yeni kayıtlar AES-256-GCM audit+receipt zarfı ve HMAC-SHA-256 journal zinciri kullanır; tarihsel direct receipt payloadları okunur fakat backfill edilmez. Yeni migration, gerçek veri taşıma, SQLite/vault sahiplik değişimi veya cutover yoktur; PPK-019 ayrı kapsamdır. Ayrıntılı ve bağlayıcı karar `docs/decisions/DEC-199-ppk-018-immutable-policy-decision-audit.md` dosyasındadır.

## DEC-198 — PPK-017 hassas log ve content-free tanı sınırı

32-M ile üretim logları, erken başlangıç kanıtları ve operasyonel tanı kayıtları merkezi fail-closed `SensitiveLogPolicy` sınırına bağlanır. Yalnız teknik kimlik, SHA-256, sonuç, correlation, sayaç, boolean, zaman ve sürüm metadata'sı kabul edilir; payload, OCR metni, serbest mesaj, stack, kalıcı yol, secret ve nested metadata yasaktır. Desktop üretim sink'i cihaz anahtarlı korumalı `.pplog` olarak kalır; diagnostic kaynak metni sabit teknik mesaj ve tek yönlü SHA-256 hash'e dönüştürülür. Yeni migration/backfill/cutover yoktur; PPK-018 değişmez audit zinciri ayrı kapsamdır. Ayrıntılı ve bağlayıcı karar `docs/decisions/DEC-198-ppk-017-sensitive-log-policy.md` dosyasındadır.

## 3. Ürün kimliği ve kapsam

### DEC-001 — Güncel resmî ürün adı

Aktif ürün adı **Anadolu Parsı Aile Yaşam Merkezi**’dir. Build 124 ile kurulum
kimliği, uygulama başlığı, veri yolu, yedek/dışa aktarma adları, lisans, kısayol
ve marka varlıkları bu ada taşınmıştır. Önceki `Panthera pardus tulliana Aile`
ve benzeri adlar tarihsel kayıtlarda kalabilir; aktif kullanıcı yüzeylerinde ve
yeni teslim belgelerinde kullanılmaz.

### DEC-002 — Ayrı yatırım uygulaması

Aile Yaşam Merkezi, bağımsız yatırım/otomatik alım-satım uygulaması değildir.
Broker, piyasa verisi, Matriks, İş Yatırım, Deniz Yatırım, otomatik emir ve
benzeri yatırım uygulaması kuralları bu projenin kapsamına alınmaz.

### DEC-003 — Kök varlık Aile’dir

Kişi, kullanıcı hesabı, aile, aile dalı, hane ve üyelik aynı kavram değildir.
Kişi birden fazla aile dalına veya haneye bağlanabilir. Kullanıcı hesabı kişiye
erişim sağlar; üyelik ve yetki ayrıca değerlendirilir.

### DEC-004 — Kullanıcı kapsamı

Uygulama yalnız çekirdek aileyle sınırlı değildir. Aile bireyleri, tüm kuşaklar,
eşler, nişanlılar, eski eşler, evlat edinilen kişiler, vasiler, yasal
temsilciler, çocuklar, bakıcılar, danışmanlar, aile dostları, misafirler ve
yetkilendirilen diğer kişiler uygun rol, amaç ve süreyle kullanabilir.

### DEC-005 — Veri sahipliği

Her yetişkin kendi özel verisinin sahibidir. Aile yöneticisi olmak sağlık,
finans, özel belge, konum veya kişisel zaman tüneli verilerine otomatik erişim
vermez. Yetki veri sahibi, nesne, işlem, aile dalı, amaç, süre ve açık ret
kurallarıyla belirlenir.

## 4. Ürün ve modül kararları

### DEC-006 — Aktif modül kataloğu

Güncel masaüstü kabuğu 16 gerçek modül içerir:

1. Gösterge Paneli
2. Aile
3. Soy Ağacı
4. Zaman Tüneli
5. Önemli Günler
6. Arşiv
7. Finans
8. Sağlık
9. Yaşam Merkezi
10. Bildirim ve Otomasyon
11. Raporlama
12. Konum
13. Yetkiler
14. Yapay Zekâ
15. Dijital Miras
16. Ayarlar

### DEC-007 — Zaman tüneli modeli

Kişisel ve aile zaman tünelleri ayrı veri kopyaları değildir. Ortak olay ağının
yetki filtreli görünümleridir. Olay; kişiler, tarih-saat, yer, gizlilik,
katılımcı, medya, belge, davetiye, not, tekrar, hatırlatma ve AI izniyle
ilişkilendirilebilir.

### DEC-008 — Kayıt yaşam döngüsü

Build 125 itibarıyla zaman tüneli ve önemli gün kayıtları oluşturma, arama,
filtreleme, ayrıntılı düzenleme, arşivleme ve geri alma yaşam döngüsüne sahiptir.
Arşivleme veri silmez; aktif görünüm arşivlenmiş kayıtları göstermez.

### DEC-009 — Arşiv ve dijital kanıt

Fotoğraf, video, ses ve belgeler içerik hash’i, sürüm, sahiplik ve erişim
bilgisiyle yönetilir. Etkinlik ile bağlı arşiv arasında doğrudan geçiş vardır.
İçe alınan ilk dosya sürümü değişmez kanıt olarak korunur.

### DEC-010 — Finans sınırı

Kişisel varlık ve borçlar başka bir aile üyesinin servetine otomatik katılmaz.
Ortak varlık/borçlar sahiplik yüzdesiyle hesaplanır. Finans ve sağlık ayrı,
yüksek hassasiyetli izin alanlarıdır.

### DEC-011 — Konum sınırı

Olay ve ikamet konumları haritada gösterilebilir. Canlı konum yalnız açık rıza,
amaç, süre ve görünür göstergeyle paylaşılır; süre sonunda otomatik kapanır ve
denetim kaydı üretir.

### DEC-012 — Dijital miras

Dijital miras ve zaman kapsülü işlemleri geri döndürülebilir tasarlanır.
Vefat sonrası erişim devri veya içerik açma gibi kritik işlemler en az iki
yönetici onayı, bekleme süresi, denetim ve iptal/geri alma kuralları kullanır.

## 5. Mimari ve veri kararları

### DEC-013 — Modüler monolit ve katman yönü

Başlangıç mimarisi modüler monolittir. Bağımlılık yönü
`UI → Application → Domain → Infrastructure` şeklindedir. Alan paketleri ve
port/adapter sözleşmeleri ileride platform veya servis ayrıştırmasına uygundur.

### DEC-014 — Repository ve SQL sahipliği

Application ve renderer katmanları ham SQL veya native SQLite yürütme yeteneği
taşımaz. Migration SQL sahipliği database paketindedir. Somut repository
implementasyonları tek composition root içinde oluşturulur ve açık repository
portlarını uygular.

### DEC-015 — Yerel öncelikli çalışma

Birincil veri kullanıcının cihazındadır. Bulut hesabı zorunlu değildir.
Çevrimdışı kullanım temel davranıştır. Büyük dosyalar şifreli içerik-adresli
kasada; metadata ve ilişkiler SQLite’ta tutulur.

### DEC-016 — Şema ve değişiklik izlenebilirliği

Veri şeması sürümlüdür. Geri döndürülemez migration, gerçek veri silme veya veri
mülkiyetini etkileyen işlem ayrıca kullanıcı onayı gerektirir. Her önemli veri
değişikliği aktör, zaman, eski/yeni değer ve gerekçeyle denetlenebilir olmalıdır.

### DEC-017 — Kaynak ve teslim bütünlüğü

Kaynak teslimi `manifest.json`, `SHA256SUMS.txt`, deterministik ZIP ve ayrık
SHA-256 kanıtıyla doğrulanır. Aynı kaynak ağacından üretilen iki arşiv byte
düzeyinde aynı olmalıdır.

## 6. Kimlik, güvenlik ve gizlilik kararları

### DEC-018 — Varsayılan reddetme

Kimlik, veri erişimi, IPC, dosya, indirme, yönlendirme, harici içerik, yedekleme
ve AI işlemlerinde varsayılan davranış reddetmektir. Yalnız açık, izlenebilir ve
en az yetkili erişime izin verilir.

### DEC-019 — Kimlik doğrulama

Windows Hello tercihli; güçlü yerel parola yedekli; TOTP, tek kullanımlık
kurtarma kodları ve FIDO2/WebAuthn desteklenir. İlk kurulumda parola koşulları,
kalan karakter ve eşleşme durumu canlı gösterilir.

### DEC-020 — Oturum ve saldırı sınırları

Varsayılan boşta kalma süresi 15 dakikadır. Beş başarısız giriş 15 dakikalık
kilit oluşturur. Oturum, kilit, parola ve cihaz işlemleri denetlenir.

### DEC-021 — Güvenilir cihaz

Cihaz kimliği kriptografiktir. Yeni cihaz eski cihaz güvenini devralmaz.
Yedekten geri yükleme otomatik yetki vermez. MFA kapatılması güvenilir cihaz
kayıtlarını iptal eder. Taşınabilir veri ile cihaz sırları ayrıdır.

### DEC-022 — Nesne düzeyi yetkilendirme

Rol tek başına yeterli değildir. `family_admin`, `adult_member`,
`limited_member`, `caregiver`, `advisor` gibi roller nesne sahipliği, işlem,
süre ve açık izin/ret kayıtlarıyla birlikte değerlendirilir. Açık ret her zaman
izin ve rol varsayımından üstündür.

### DEC-023 — Electron güven sınırı

Renderer `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
ile çalışır. IPC yalnız kayıtlı ana renderer, ana frame, güvenilir belge ve
merkezi payload bütçesinden geçer. Webview, izinsiz navigation, redirect,
download ve permission talepleri varsayılan reddedilir.

### DEC-024 — AI rızası ve insan onayı

AI sağlayıcısı varsayılan kapalıdır. AI yalnız erişim ve AI işleme izni bulunan
kayıtları kullanır. Sağlık, finans, çocuk ve canlı konum verileri yüksek
hassasiyetlidir. AI önerileri kullanıcı onayı olmadan kesin kayıt oluşturamaz;
kullanıcı AI hafızasını görebilir, düzeltebilir, sınırlandırabilir ve silebilir.

### DEC-025 — Güvenlik kontrolü zayıflatma yasağı

Bir güvenlik kontrolünün kaldırılması veya zayıflatılması; karar kaydı, etki ve
risk analizi ile ürün sahibi onayı gerektirir. Böyle bir çelişki çözülmeden Gold
yayını yapılamaz.

## 7. Yedekleme, taşıma ve kurtarma kararları

### DEC-026 — Bağımsız yedek hedefleri

Yerel disk, harici disk ve sağlayıcı adaptörlü bulut hedefleri birbirinden
bağımsız çalışır. OneDrive ilk öncelikli üretim bulut hedefidir; mimari iCloud,
Google Drive ve diğer sağlayıcıları adapter olarak destekleyebilir.

### DEC-027 — Hedef bazlı sağlık

Her hedef için bağlantı, boş alan, son başarı zamanı, doğrulama, boyut, hash,
hız ve hata ayrı izlenir. Bir hedefin hatası diğerlerini durdurmaz. Her zaman en
az bir tam ve doğrulanmış yedek korunur.

### DEC-028 — Güvenli geri yükleme

Yedekler şifreli ve doğrulanmış olmalıdır. Geri yükleme öncesi bütünlük kontrolü,
bozuk veri izolasyonu ve rollback bulunur. Yeni cihazda yeniden kimlik ve cihaz
yetkilendirmesi gerekir.

## 8. Platform, UI/UX ve erişilebilirlik kararları

### DEC-029 — Platform sırası

İlk gerçek platform Windows masaüstüdür. Mimari gelecekte macOS, iPhone, iPad,
Apple Watch ve Apple Vision Pro istemcilerine genişleyebilir. Mobil istemciler
ilk aşamada masaüstünden veri alan, okuma ağırlıklı companion istemcilerdir;
bağımsız işlem veya veri kaynağı değildir.

### DEC-030 — Apple esintili özgün arayüz

Arayüz Apple tasarım ilkelerinden esinlenir fakat özgün marka kimliği kullanır.
Build 123 ile işlevsel uygulama kabuğu, daraltılabilir menü, açık/koyu görünüm,
komut araması, bildirim merkezi ve profil menüsü oluşturulmuştur. Build 124 ile
ortak yüzey ve kontrol dili tüm modüllere yayılmıştır.

### DEC-031 — Merkezi tipografi

Build 126 ile merkezi Apple sistem font yığını ve semantik tipografi ölçeği
uygulanmıştır. Apple platformlarında yerel SF sistem fontu kullanılır; font
dosyası uygulamaya gömülmez. Güvenli fallback zinciri kullanılır.

Bağlayıcı ölçek:

- Büyük başlık: 34 px
- Sayfa başlığı: 28 px
- Bölüm başlığı: 22 px
- Alt başlık: 20 px
- Gövde: 17 px
- Kontrol/form: 15 px
- İkincil/dipnot: 13 px
- Mutlak minimum: 11–12 px
- Temel etkileşim hedefi: en az 44 px

Genel etiketlerde gereksiz tümü büyük harf dönüşümü kullanılmaz.

### DEC-032 — Erişilebilirlik

Klavye kullanımı, ekran okuyucu etiketleri, ölçeklenebilir metin, yüksek
kontrast, odak görünürlüğü ve renk dışı durum göstergeleri zorunludur. Hata
mesajı yalnız sorunu değil, kullanıcı eylemini de açıklamalıdır. Tema ve metin
ölçeği kullanıcı bazında saklanmalıdır.

## 9. Geliştirme, onay ve sürüm kararları

### DEC-033 — Genel teknik çalışma yetkisi

Geri döndürülebilir teknik iyileştirmeler ve kabul edilmiş öneriler tek tek onay
beklemeden uygulanabilir. Ancak kapsam değişikliği, geri döndürülemez işlem,
gerçek veri silme, hukuki/finansal taahhüt, güvenlik zayıflatma ve üretim yayını
ayrıca kullanıcı onayı gerektirir.

### DEC-034 — Sürüm kanalları

- Bronze: aktif geliştirme
- Silver: test, kabul ve geniş doğrulama
- Gold: üretim ve gerçek kullanım

### DEC-035 — Bronze, Silver ve Gold kanal sırası

Güncel aşama **Bronze RC2 Active Development**’tır. Tüm yeni geliştirmeler Bronze kanalında tamamlanır. Bronze kapsamı tamamlandığında Silver kanalına geçilir; Silver’da yeni özellik geliştirilmez, mevcut altyapı iyileştirilir ve bütün testler yürütülür. Silver doğrulamalarının tamamı başarılı olursa ve ürün sahibi onay verirse Gold üretim sürümü hazırlanır.

### DEC-036 — Dürüst doğrulama statüsü

Yalnız gerçekten çalıştırılmış doğrulama `PASS` veya `FAIL` olarak raporlanır.
Çalıştırılmayan compile, test, type-check, build, smoke, Windows launch,
installer, ekran görüntüsü veya kabul kapısı `NOT_RUN` kalır. Tanı amaçlı
`--no-sandbox` koşuları resmî PASS yerine geçmez ve `DIAGNOSTIC_PASS` olarak
ayrılır.

### DEC-037 — Ara sürüm doğrulama yaklaşımı

Ara Bronze artırımlarında kapsamlı kullanıcı kabul testi, toplu ekran görüntüsü
ve son kullanıcı dokümantasyonu, geliştirmeyi engellemediği sürece toplu final
hazırlığına ertelenebilir. Ancak hedefli mimari, güvenlik ve regresyon kontrolleri
gerçekten çalıştırıldığında raporlanır.

### DEC-038 — Silver doğrulama sırası

Final hazırlığında sırasıyla temiz `npm ci`, tam `tsc --noEmit`, tüm testler,
Electron production build, blocking smoke, Windows sandbox’lı gerçek açılış,
kurulum/açılış/kaldırma, installer doğrulaması, ekran görüntüleri ve kullanıcı
dokümantasyonu tamamlanmalıdır.

## 10. Dokümantasyon kararları

### DEC-039 — Belge etkisi zorunluluğu

Her mimari, veri şeması, güvenlik, UI/UX, platform, kapsam veya sürüm kararı
ilgili belgeye ve bu karar kaydına işlenir. Kod ile belge çelişemez.

### DEC-040 — Aktif ve tarihsel belge ayrımı

Aktif belgeler `docs/` ve kök teslim yüzeyleridir. Eski PDF/DOCX paketleri ve
Build raporları tarihsel kanıttır. Aktif belge manifestosu hangi belgenin
bağlayıcı olduğunu açıkça gösterir.

### DEC-041 — Karar izlenebilirliği

Her yeni karar benzersiz `DEC-xxx` kimliği, tarih, etkilenen belgeler, kod
karşılığı ve doğrulama kanıtıyla izlenir. Belge güncellenmeden kapsam
“tamamlandı” sayılamaz.

### DEC-042 — İşletim sistemi korumalı cihaz kimliği sırrı

Build 128 ile Ed25519 cihaz kimliğinin özel anahtarı açık JSON içinde
tutulmaz. Paketli uygulama ve Windows çalışma zamanı, Electron `safeStorage`
üzerinden işletim sistemi güvenli depolamasını kullanır; Windows tarafında bu
koruma DPAPI ile sağlanır. Açık eski cihaz kimliği dosyası ilk uygun açılışta
şifreli sürüm 2 zarfına atomik olarak taşınır. Koruma zorunlu olduğu hâlde
`safeStorage` kullanılamıyorsa uygulama açık anahtarla devam etmek yerine
varsayılan reddetme davranışıyla hata verir.

Şifreli zarf yalnız açık kimlik metadata'sını ve Base64 kodlu şifreli özel
anahtar yükünü içerir. Özel/açık anahtar eşleşmesi her yüklemede imzalı meydan
okuma ile doğrulanır. Yarım kalan geçiş için geri alma dosyası bulunur ve
başarılı geçişten sonra açık yedek kaldırılır.


### DEC-043 — İşletim sistemi korumalı TOTP MFA sırrı

Build 129 ile aktif ve bekleyen TOTP sırları veritabanında açık Base32 metin
olarak tutulmaz. Electron `safeStorage` ile işletim sistemi korumasına alınmış
sürüm 1 zarfı saklanır; Windows ve paketli uygulamada koruma zorunludur. Legacy
açık kayıtlar hesap okuma transaction'ı içinde beklenen eski değer koşuluyla
atomik olarak dönüştürülür. Koruma kullanılamazsa veya zarf açılamazsa kimlik
doğrulama açık sırla devam etmek yerine varsayılan reddetme uygular. Kurtarma
kodları yalnız hash olarak saklanmaya devam eder.


## 11. Güncel açık maddeler

- Normal Windows ortamında sandbox’lı gerçek uygulama açılışının resmî PASS kanıtı.
- Authenticode imzalı installer kararı ve sertifika.
- OneDrive ve diğer bulut sağlayıcılarının gerçek üretim bağlantıları.
- Apple istemcileri ve mağaza hesapları.
- Canlı konum, resmî sağlık/sigorta/kurum entegrasyonları.
- Gerçek aile verisine geçiş ve kabul planı.
- Silver kampanyasında UAT, erişilebilirlik, performans, restore ve ekran kanıtları.

Bu maddeler Bronze RC2 Active Development’ı otomatik olarak başka kanala taşımaz.

### DEC-044 — Parola korumalı tam yedek kapsayıcısı

Build 130 ile yeni tam yedekler açık JSON/Base64 bileşenleri olarak yazılmaz.
Veritabanı, dijital kasa anahtarı ve şifreli arşiv girdileri tek iç payload içinde
toplanır; PBKDF2-SHA512 ile türetilen 256 bit anahtar ve AES-256-GCM ile
şifrelenmiş sürüm 3 kapsayıcısına yazılır. Kapsayıcı başlığı AAD olarak doğrulanır;
yanlış parola, başlık değişikliği ve içerik bozulması varsayılan reddetme ile
sonuçlanır. KDF parametreleri güvenli alt/üst sınırlara tabidir.

Eski v1/v2 yedekler yalnız geriye dönük inceleme ve geri yükleme için desteklenir,
ancak açık biçim oldukları için `attention` risk seviyesinde işaretlenir. Yeni
manuel yedekte kullanıcı parolası zorunludur. Zamanlanmış yedek hedefleri için
rastgele üretilen yönetilen yedek parolası Electron `safeStorage`/Windows DPAPI
ile korunur ve açık metin olarak diske yazılmaz.

### DEC-045 — Dayanıklı geri yükleme işlemi ve zorunlu cihaz yeniden yetkilendirmesi

Build 131 ile tam yedek geri yükleme; veritabanı, dijital kasa anahtarı ve arşiv
bileşenlerini tek dayanıklı işlem günlüğü altında değiştirir. `prepared`,
`live-moved`, `staged-installed` ve `committed` aşamaları atomik ve fsync edilmiş
`restore-transaction.json` kaydında tutulur. Güvenli giriş işareti ve commit
günlüğü kalıcı yazılmadan rollback kopyaları silinmez. Yarım kalan işlem sonraki
uygulama açılışında ya eski doğrulanmış sete geri alınır ya da tamamlanmış commit
artıkları temizlenir.

Geri yüklenen staged SQLite dosyasındaki bütün aktif güvenilir cihaz kayıtları
commit öncesinde iptal edilir. `restore_reauthorization_required` metadata kaydı
ve işlem kimliğine bağlı `restore-required-login.json` işareti yazılır. Böylece
yedek aynı fiziksel cihazdan alınmış olsa bile önceki cihaz güveni otomatik olarak
devralınmaz; kullanıcı parola ve etkinse 2FA ile yeniden doğrulanır.


### DEC-046 — Fail-closed başlangıç güvenlik ön kontrolü ve Windows DPAPI süreç kanıtı

Build 132 ile Electron ana süreç, veri deposunu açmadan önce işletim sistemi sır
korumasını gerçek şifreleme–çözme turuyla doğrular. İlk güvenli açılışta
`startup-security-sentinel.json` adlı korumalı işaret atomik ve `0600` izinli
olarak oluşturulur; sonraki açılışta aynı işaret tekrar çözülür ve SHA-256
bütünlüğü sabit zamanlı karşılaştırmayla doğrulanır. İşaret bozuksa, farklı
koruma sağlayıcısına aitse veya koruma kullanılamıyorsa uygulama sessizce açık
metne düşmez ve fail-closed durur.

Normal çalışma `--no-sandbox`, `--single-process`, `--disable-gpu-sandbox` ve
renderer code-integrity/AppContainer kontrollerini kapatan seçenekleri reddeder.
Tanısal istisna yalnız açık Windows launch-test ortamında kullanılabilir ve
`DIAGNOSTIC_PASS` olarak sınıflandırılır. Renderer pencereleri tek güvenli tercih
fabrikasından oluşturulur; global `app.enableSandbox()` uygulanır.

Gerçek Windows kanıtı aynı kullanıcı veri dizinini kullanan iki ayrı süreç
çalıştırır. İlk süreç korumalı işareti oluşturmalı, ikinci süreç DPAPI ile tekrar
açmalıdır. Bu iki süreçli kanıt, paketli uygulama ve development açılışı için
ayrı ayrı çalıştırılmadan Windows promotion kapısı PASS sayılmaz.

### DEC-047 — Finans ve sağlık nesnelerinde mahremiyet önceliği

Build 133 ile finans kaydı, finans değerlemesi, sağlık kaydı, ilaç planı ve aile
sağlık geçmişi erişiminde kayıt mahremiyeti merkezi yetkilendirme kararının
zorunlu girdisidir. `private` ve `selected_members` kayıtları aile yöneticisi
dâhil hiçbir role otomatik açılmaz; yalnız veri sahibi veya etkin açık nesne izni
erişebilir. Etkin açık ret tüm sahiplik, rol ve izinlerden önce uygulanır.

`family` görünürlüğü bilinçli paylaşımı ifade eder ve yalnız tanımlı rol okuma
politikalarını açar. Finans değerlemeleri üst finans kaydının mahremiyetini
devralır. Hassas finans veya sağlık verisinin `ai_process` işlemi sahiplik veya
rol ile açılamaz; ayrıca açık nesne izni gerekir. Karar ADR-018 ve Build 133
sözleşme/runtime kanıtlarıyla izlenir.

### DEC-048 — Kalıcı erişilebilirlik tercihleri ve kritik klavye akışı

Build 134 ile metin ölçeği, yüksek kontrast ve hareket azaltma tercihleri yerel
profilde kalıcı olarak saklanır. Kayıt bulunmadığında işletim sisteminin
`prefers-contrast` ve `prefers-reduced-motion` tercihleri başlangıç değeri olarak
kullanılır. Standart, büyük ve çok büyük metin ölçekleri merkezi tipografi
tokenlarını değiştirir; arayüzün sabit piksel tipografi tabanı korunarak kullanıcı
tercihi üst katmanda uygulanır.

Bölüm değişimlerinde ana içerik odağı ve Türkçe canlı bölge duyurusu zorunludur.
Komut araması `listbox/option` semantiği, roving klavye odağı, Home/End,
yukarı/aşağı, Enter, Escape, Tab odak tuzağı ve kapanışta odak geri yükleme
uygular. Görünür odak halkası kaldırılmaz; forced-colors, yüksek kontrast ve
hareket azaltma ortamları desteklenir. Durum mesajları `polite`, kritik hatalar
`assertive` canlı bölge olarak duyurulur. Kaynak sözleşmesi ADR-019 ve Build 134
kanıtlarıyla izlenir; gerçek renderer, ekran okuyucu ve UAT kanıtları ayrı
promotion kapısıdır.

### DEC-049 — İşletim sistemi korumalı dijital kasa anahtarı ve taşınabilir yeniden sarma

Build 135 ile arşiv kasasının 32 baytlık ana anahtarı yerel diskte açık ikili
veri olarak tutulmaz. Anahtar, Electron `safeStorage` üzerinden işletim sistemi
korumasına alınmış sürüm 2 zarfında saklanır. Windows ve paketli uygulamada
koruma zorunludur; koruma kullanılamıyorsa uygulama açık anahtar oluşturarak veya
kullanarak devam etmez.

Legacy açık anahtar ilk güvenli açılışta aynı anahtar değeri korunarak geçici
dosya, `fsync`, atomik yeniden adlandırma ve geri alma kopyasıyla dönüştürülür.
Yarım kalan dönüşüm sonraki açılışta kurtarılır; başarılı dönüşümden sonra açık
geri alma kopyası kaldırılır. Zarf koruma sağlayıcısı, SHA-256 anahtar özeti ve
oluşturma zamanını taşır; sağlayıcı uyuşmazlığı veya bütünlük hatası fail-closed
reddedilir.

Tam yedek taşınabilirliği korunur. Ham kasa anahtarı yalnız parola korumalı
AES-256-GCM yedek payload’ı içinde bulunabilir. Geri yükleme staging aşamasında
anahtar hedef cihazın işletim sistemi korumasıyla yeniden sarılır; eski cihazın
DPAPI zarfı yeni cihaza kopyalanmaz. Karar ADR-020 ve Build 135 sözleşme/runtime
kanıtlarıyla izlenir. Gerçek Windows DPAPI migration ve paketli geri yükleme
kanıtı ayrı promotion kapısıdır.

### DEC-050 — Veri yaşam döngüsü, geri alınabilir arşivleme ve iki aşamalı kalıcı imha

Build 136 ile finans, sağlık, ilaç, aile sağlık geçmişi ve yaşam kayıtları için
merkezi veri yaşam döngüsü uygulanır. Varsayılan silme geri alınabilir
arşivlemedir; arşivlenen kayıt normal modül listelerinden çıkarılır ancak yetkili
kullanıcı tarafından geri alınabilir. Saklama politikası kayıt türünü, zorunlu
saklama süresini ve geri alma penceresini belirler.

Kalıcı imha yalnız saklama süresi dolduktan sonra iki ayrı açık onay ve güçlü
yeniden doğrulamayla çalışır. Hukuki/koruma bekletmesi imhayı engeller. Nesne
mahremiyeti ve açık izin/ret politikası her aşamada uygulanır; aile yöneticisi
başka yetişkinin özel kaydını rolü nedeniyle silemez. İmha edilen içerik yerine
sahiplik ve denetim bilgisi taşıyan içeriksiz tombstone bırakılır ve eski yedek
kopyaları için `backupPropagationPending` işareti tutulur.

SQLite güvenli silme ve WAL temizliği uygulanır; SSD, dosya sistemi, bulut ve
yedek kopyaları nedeniyle fiziksel imha en iyi çaba olarak belgelenir. Karar
ADR-021 ve Build 136 sözleşme/runtime kanıtlarıyla izlenir.

### DEC-051 — Yönetilen yedeklerde kalıcı imha yayılımı ve geri alınabilir karantina

Build 137 ile `backupPropagationPending` taşıyan kalıcı imha tombstone kayıtları,
yalnız uygulamada etkin olarak kayıtlı yönetilen yedek hedeflerine yayılır. Her
hedefte önce yeni parola korumalı tam yedek üretilir ve SHA-256 ile doğrulanır;
yayılım sırasında normal saklama temizliği devre dışı bırakılır.

Doğrulanmış taze yedek korunur. Hedef kökündeki önceki `.pptbackup` dosyaları
fiziksel olarak silinmez; işlem kimliğine bağlı, izinleri sınırlandırılmış
`.purge-quarantine` klasörüne atomik olarak taşınır. Manifest dosyası dosya özeti,
boyut ve yalnız SHA-256 tombstone parmak izlerini taşır; imha edilen kayıt kimliği
manifestte açık yazılmaz.

Tombstone üzerindeki bekleyen yayılım işareti yalnız bütün etkin yönetilen
hedefler başarıyla yenilendiğinde ve aktif yönetilmeyen yedek kalmadığında
kaldırılır. Manuel kopyalar, çevrimdışı medya, dosya sistemi snapshotları ve bulut
sürüm geçmişi otomatik kapsamın dışındadır. Karar ADR-022 ve Build 137 hedefli
sözleşme/runtime kanıtlarıyla izlenir.


### DEC-052 — Yedek karantinası için süreli saklama, hukuki bekletme ve güçlü doğrulamalı nihai imha

Build 138 ile Build 137 tarafından oluşturulan yönetilen yedek karantinaları
hemen veya yalnız klasör temizliğiyle yok edilmez. Her karantina grubu veritabanında
`retained`, `destroying` veya `destroyed` durumuyla izlenir. Varsayılan 90 günlük
süre operasyonel güvenlik varsayımıdır; yasal saklama süresi değildir ve hukuk/
gizlilik incelemesiyle değiştirilebilir. Politika değişikliği yalnız yeni kayıtlara
uygulanır.

Karantina süresi tamamlanmadan veya hukuki/koruma bekletmesi varken nihai imha
çalışmaz. Politika, bekletme ve imha işlemleri yalnız aile yöneticisi tarafından,
parola ve etkinse TOTP ile güçlü yeniden doğrulama sonrasında yapılabilir. İmha
için kayıt kimliğine bağlı `KARANTİNA İMHA <batchId>` kesin onay metni zorunludur.

Dosya sistemi işlemi atomik olarak `.destroying-*` dizinine sahiplenilir; manifestteki
boyut ve SHA-256 özetleri doğrulanmadan dosya içeriğine dokunulmaz. Dayanıklı durum
kaydı yarım işlemi sonraki çağrıda devam ettirir; tamamlanan işlem içeriksiz ve
izinleri sınırlandırılmış bir imha makbuzu bırakır. Tek geçişli sıfır yazma, `fsync`
ve unlink yalnız en iyi çaba dosya sistemi imhasıdır; SSD wear levelling, snapshot,
bulut geçmişi ve çevrimdışı kopyalar için mutlak fiziksel yok etme iddiası kurulmaz.
Karar ADR-023 ve Build 138 hedefli sözleşme/runtime kanıtlarıyla izlenir.

### DEC-053 — Uygulama dışı yedek envanteri, dönemsel teyit ve kullanıcı imha beyanı

Build 139 ile uygulamanın doğrudan yönetmediği manuel yedek dosyaları, çevrimdışı
harici diskler, optik medya, dosya sistemi snapshotları ve bulut sürüm geçmişleri
ayrı bir envanterde izlenir. Her kayıt; kopya türü, konum, sorumlu kişi, erişim
durumu, tarihsel veri taşıma riski, son teyit ve sonraki inceleme tarihini taşır.
Yönetilmeyen bir kopya, uygulama tarafından otomatik olarak silinmiş veya imha
edilmiş kabul edilmez.

Kayıt, teyit, hukuki/koruma bekletmesi ve imha beyanı yalnız aile yöneticisi
yetkisiyle çalışır. Teyit, bekletme ve imha beyanı parola ve etkinse TOTP ile
güçlü yeniden doğrulama gerektirir. Teyit ve imha işlemlerinde kayıt kimliğine
bağlı kesin onay metinleri kullanılır; durum geçişleri `updatedAt` karşılaştırmalı
güncellemeyle eşzamanlı değişikliklere karşı korunur.

Kullanıcının `destroyed_attested` beyanı otomatik fiziksel imha kanıtı değildir.
İsteğe bağlı SHA-256 kanıtı yalnız sunulan dosya veya makbuzun bütünlüğünü
belgeler; çevrimdışı cihazın, bulut sağlayıcısının veya üçüncü taraf kopyanın
gerçekte yok edildiğini tek başına kanıtlamaz. Karar ADR-024 ve Build 139 hedefli
sözleşme/runtime kanıtlarıyla izlenir. Gerçek çevrimdışı medya ve bulut sağlayıcı
sürüm geçmişi UAT/kanıtı ayrı promotion kapısıdır.

### DEC-054 — Güvenilen Ed25519 sağlayıcıları ve imzalı haricî yedek imha kanıtı

Build 140 ile uygulama dışı yedek envanterindeki kullanıcı imha beyanı ile
kriptografik olarak doğrulanmış imha makbuzu ayrı güven seviyeleri olarak
tutulur. Uygulama yalnız güvenilen sağlayıcı veya bağımsız denetçi Ed25519 açık
anahtarını kabul eder; özel anahtar hiçbir zaman uygulamaya verilmez veya
saklanmaz. Açık anahtar normalize edilir ve SHA-256 parmak iziyle izlenir.

İmzalı makbuz; sabit kanonik şema, makbuz kimliği, kopya kimliği, sağlayıcı
kimliği, düzenlenme zamanı, kanıt SHA-256 özeti ve `destroyed` beyanını imzaya
bağlar. Tekrar kullanılan makbuz, ileri tarih, kopya oluşturulmadan önceki tarih,
hukuki bekletme ve geçersiz imza fail-closed reddedilir. Sağlayıcı güveni iptal
edilirse bağlı kanıtlar ve kopya güven durumu `revoked` olur; kanıt geçmişi
silinmez.

Geçerli Ed25519 imzası makbuz kökenini ve bütünlüğünü kanıtlar; fiziksel imhanın
mutlak gerçekleştiğini tek başına kanıtlamaz. Sağlayıcı API'si, sözleşme ve gerçek
dünya doğrulaması ayrı promotion kapısıdır. Karar ADR-025 ve Build 140
sözleşme/runtime kanıtlarıyla izlenir.

### DEC-055 — İmzalı sağlayıcı anahtarı döndürme ve makbuz-zamanı güven sürekliliği

Build 141 ile imha kanıtı sağlayıcı anahtarları doğrudan değiştirilmez. Yeni
Ed25519 açık anahtarı, mevcut etkin anahtar tarafından sabit kanonik döndürme
makbuzu üzerinden imzalanarak yetkilendirilir. Makbuz; önceki sağlayıcı ve anahtar
parmak izini, ardıl etiket ve parmak izini, geçerlilik başlangıcını, benzersiz
makbuz kimliğini ve `authorize-successor-key` beyanını imzaya bağlar.

Önceki anahtarın `validUntil` değeri ile ardıl anahtarın `validFrom` değeri aynı
kesim anına atomik olarak bağlanır. Aynı anahtar, aynı makbuz veya daha önce
döndürülmüş/iptal edilmiş önceki anahtar yeniden kullanılamaz. Makbuz doğrulaması
aile yöneticisi, kesin onay, parola ve etkinse TOTP gerektirir.

İmha makbuzları sağlayıcının güncel durumuna göre değil, düzenlendikleri andaki
anahtar güven aralığına göre doğrulanır. Böylece kesim öncesi makbuz eski anahtarla,
kesim sonrası makbuz yalnız ardıl anahtarla geçerlidir. Anahtar iptali, iptal
zamanından önce doğrulanmış tarihsel kanıtı otomatik olarak geçersiz kılmaz; iptal
anında veya sonrasında düzenlenmiş makbuzlar reddedilir. Karar ADR-026 ve Build 141
sözleşme/runtime kanıtlarıyla izlenir.

### DEC-056 — İmzalı sağlayıcı iptal listesi, geri alma koruması ve süreli çevrimdışı güven önbelleği

Build 142 ile güvenilen imha kanıtı sağlayıcılarının iptal durumu yalnız yerel
kullanıcı işlemiyle belirlenmez. Uygulama, güven zincirindeki etkin Ed25519
anahtarıyla imzalanmış kanonik iptal listelerini kabul eder. Liste; kök güven
sağlayıcısını, benzersiz liste kimliğini, monoton sıra numarasını, `thisUpdate` /
`nextUpdate` geçerlilik penceresini ve iptal girdilerini imzaya bağlar.

Daha düşük veya eşit sıra numaralı liste geri alma/replay saldırısı olarak
fail-closed reddedilir. Süresi geçmiş, ileri tarihli, 31 günden uzun geçerlilikli,
zincir dışı hedef içeren, kendi imzalayan anahtarını iptal eden veya imzası
geçersiz liste uygulanmaz. Liste uygulanması aile yöneticisi, kesin onay, parola
ve etkinse TOTP ile güçlü yeniden doğrulama gerektirir.

Doğrulanmış liste yerel çevrimdışı önbelleğe kalıcı kanıt olarak yazılır; eski
`current` liste `superseded` olur. İptal girdisi sağlayıcı durumunu, bağlı imha
kanıtlarını ve uygulama dışı yedek envanterindeki güven seviyesini iptal zamanına
göre atomik olarak düşürür. Kaynak URL yalnız HTTPS metadata'sıdır; gerçek ağdan
otomatik indirme ve sağlayıcı API entegrasyonu bu buildde yapılmamıştır. Karar
ADR-027 ve Build 142 hedefli sözleşme/runtime kanıtlarıyla izlenir.


### DEC-057 — Sağlayıcıya bağlı HTTPS uç noktası profili ve sınırlı TLS SPKI pin döndürme

Build 145 ile imzalı iptal listesi alımı sırasında renderer tarafından serbest
URL veya TLS pini gönderilmez. Her ağ kaynağı, kök güven sağlayıcısına bağlı
kalıcı bir uç noktası profiliyle tanımlanır. Profil yalnız standart HTTPS/443
adresini, birincil SPKI SHA-256 pinini, isteğe bağlı geçiş pinini, geçiş
başlangıcını, birincil pin bitişini ve etkinlik durumunu taşır.

Profil oluşturma veya değiştirme yalnız aile yöneticisi tarafından, sağlayıcı
kimliğine bağlı `KANIT HTTPS KAYNAĞI <issuerId>` kesin onayı, hesap parolası ve
etkinse TOTP ile yapılabilir. Sağlayıcı kök güven kaydı değilse, iptal edilmişse,
pin biçimi geçersizse veya geçiş tarihleri tutarsızsa işlem fail-closed reddedilir.

Çift-pin geçiş penceresi en fazla 14 gün, ileri tarihli planlama en fazla 90
gündür. Ağ isteği yalnız o anda geçerli pin kümesiyle yapılır. Profil devre dışıysa
veya geçerli pin kalmamışsa bağlantı kurulmaz. Son alım başarısı veya hatası
profile yazılır; ancak TLS pin eşleşmesi imzalı iptal listesinin Ed25519, sıra
numarası ve tarih doğrulamalarının yerini tutmaz. Karar ADR-028 ve Build 145
hedefli sözleşme/runtime kanıtlarıyla izlenir.

### DEC-058 — Gerçek aile verisi için doğrulanmış ön izleme, atomik uygulama ve kontrollü geri alma

Build 146 ile aile verisi dosyasını renderer seçmez veya IPC üzerinden yol/içerik
göndermez; seçim Electron main process tarafından yapılır. Yalnız normal `.json`
dosyası, katı UTF-8, 25 MiB boyut sınırı, şema v1, bilinmeyen alan reddi, kayıt
sınırları ve dosya içi referans bütünlüğü sonrasında ön izlenebilir.

Ön izleme 15 dakika geçerlidir ve SHA-256, dosya stat bilgisi, deterministik hedef
kimlikleri ile eşleşme/oluşturma planını taşır. Uygulama öncesinde kaynak ve güncel
veritabanı planı yeniden doğrulanır. Aynı SHA-256 veya `exportId` ile uygulanmış ve
geri alınmamış paket replay olarak reddedilir. Uygulama aile yöneticisi ve güçlü
yeniden doğrulama sonrasında tek transaction içinde yapılır.

Her batch oluşturulan ve yeniden kullanılan kayıtları kaynak kimliğiyle izler.
Geri alma penceresi 24 saattir; yalnız batch tarafından oluşturulan kayıtlar silinir.
Sonradan kullanıcı, finans, sağlık, yaşam merkezi, ilişki, etkinlik, arşiv veya
otomasyon bağı oluşmuşsa işlem fail-closed engellenir. Karar ADR-029 ve Build 146
hedefli sözleşme/runtime kanıtlarıyla izlenir.


### DEC-059 — Büyük aile görünümünde anahtar tabanlı sayfalama ve sınırlı çizim

Build 147 ile soy ağacı, zaman tüneli ve arşiv ekranları tam veri kümesini açılışta
renderer belleğine alamaz. Her görünüm ayrı read-model repository ve main-process
servisi üzerinden varsayılan 80, en fazla 200 kayıtlık sayfalar ister. Offset
yerine soy ağacında `(generation, display_name, id)`, zaman tünelinde
`(start_at, id)`, arşivde `(created_at, id)` anahtarları kullanılır.

İmleçler şema sürümü ve görünüm türüyle doğrulanır; başka ekranın imleci, aşırı
uzun imleç veya sınırsız arama/filtre girdisi reddedilir. İmleç yetkilendirme
kanıtı değildir. Olay ve arşiv satırları repository sorgusundan sonra nesne bazlı
okuma izninden geçmeden kullanıcıya dönmez.

Renderer yalnız yüklenen sayfaları çizer ve sonraki sayfa kullanıcı isteğiyle
alınır. Arşiv içe aktarma sonucu tam listeyi state’e taşımak yerine revizyon
sinyaliyle sayfalı görünümü yeniler. Migration 25 büyük veri sıralamaları,
ilişki sayımları ve arşiv filtreleri için indeksleri ekler. Karar
`docs/LARGE_FAMILY_READ_MODEL_PERFORMANCE_V1.md`, ADR-030 ve Build 147 hedefli
runtime/query-plan kanıtlarıyla izlenir.

### DEC-060 — İçerik adresli npm bağımlılık talebi ve talep–yanıt–kabul izlenebilirliği

Build 154 ile çevrimdışı geliştirme makinesinden internet bağlantılı edinme
makinesine gönderilen bağımlılık talebi, aktif paket sürümü, `package-lock.json`
SHA-256 değeri, temel edinme planı, yalnız resmi npm kaynağına izin veren politika
ve gerekli tarball sayısından türetilen içerik adresli bir talep kimliği taşır.

Talep ZIP'i deterministik üretilir; içindeki lockfile, plan, politika, minimal Node
runtime'ı ve Bash/PowerShell yardımcıları payload boyutu ve SHA-256 envanteriyle
korunur. Bağlantılı makinede üretilen dönüş cache manifesti aynı
`handoffRequestId` değerini taşımak zorundadır.

Çevrimdışı kabul sınırı talep ZIP'ini, checksum yan dosyasını, aktif lockfile'ı,
dönüş ZIP'ini, 117 tarballın SHA-512 bütünlüğünü ve talep kimliğini yeniden
doğrular. Kimlik uyuşmazlığında cache içe aktarımı başlamaz; paket red makbuzuyla
karantinaya alınır. Geçerli kimlik kabul makbuzu ve aktif kabul pointerı boyunca
korunur. Dönüş paketi henüz yoksa durum `WAITING / BOUND_RESPONSE_NOT_PRESENT`
olarak tutulur ve geniş RC2 kapıları başlatılmaz. Karar ADR-031,
`docs/NPM_DEPENDENCY_HANDOFF_V1.md` ve Build 154 hedefli kanıtlarla izlenir.

### DEC-061 — Sınırlı başlangıç, bölümlü aile snapshot'ı ve ekran bazlı tembel yükleme

Build 155 ile oturum açılışında tam aile grafiği, zaman tüneli ve ikincil modül
listeleri aynı anda yüklenmez. Renderer başlangıçta yalnız kimlik, uygulama bilgisi
ve dashboard özetini alır. Aile verisi `graph` ve `timeline` bölümlerine ayrılır;
her bölüm yalnız ihtiyaç duyan ekran ilk kez açıldığında IPC üzerinden istenir.

Dashboard repository tam olay koleksiyonunu application katmanına taşımaz. Olay
sayıları SQLite agregalarıyla hesaplanır; yaklaşan önemli günler en fazla 6, son
olaylar en fazla 4 kayıtla sınırlandırılır. Aile görünürlüğü, katılımcı kimliği ve
etkin açık izin/ret kayıtları SQL sorgusunda uygulanır.

Aynı bölüm için eşzamanlı renderer istekleri tek uçuşta birleştirilir. Finans,
sağlık, yaşam merkezi, otomasyon, rapor ve arşivlenmiş olay listeleri ilgili ekran
ilk açılışına ertelenir. Karar ADR-032, `docs/BOUNDED_BOOTSTRAP_AND_LAZY_LOADING_V1.md`
ve Build 155 hedefli sözleşme/SQL runtime kanıtlarıyla izlenir.

### DEC-062 — Ortak kişi/olay seçimlerinde arama destekli keyset katalogları

Build 156 ile aile ekranı ve ortak kişi/olay seçim alanları tam `people` veya
`events` koleksiyonunu renderer belleğine almak zorunda değildir. Kişi kataloğu
`(display_name COLLATE NOCASE, id)`, olay kataloğu `(start_at, id)` anahtarlarıyla
sayfalanır. Sayfa boyutu 10–100, lookup kapsamı tür başına en fazla 100 kimliktir.

Katalog imleci kullanıcı hesabı ve etkin arama/filtrelerin SHA-256 kapsamına
bağlanır; farklı kullanıcı, arama, kişi filtresi, olay türü veya arşiv modunda
tekrar kullanılamaz. İmleç yetkilendirme kanıtı değildir. Olay sayfaları ve seçili
olay lookup sonuçları nesne bazlı okuma izninden geçer.

Aile ekranı 30 kişilik sayfalar ve seçili kişi için en fazla 10 olay kullanır.
İlişki/olay modalları, zaman tüneli kişi filtresi, arşiv olay filtresi ve bağlı kişi
seçimleri ortak katalog bileşenlerine taşınır. Karar ADR-033,
`docs/SEARCHABLE_ENTITY_CATALOGS_V1.md` ve Build 156 hedefli SQL/servis runtime
kanıtlarıyla izlenir.

### DEC-063 — Oturum güvenli asenkron state ve monoton mutasyon filigranı

Build 158 ile renderer'daki IPC yanıtları kapsam, oturum çağı ve monoton istek
sırasına bağlı bilet olmadan state yazamaz. Aynı kapsamda yeni istek veya oturum
değişimi önceki bileti geçersiz kılar. Kişi/olay katalogları, soy ağacı, zaman
tüneli, arşiv, snapshot bölümleri, yardımcı ekranlar, dashboard ve kimlik geçişleri
bu sınırı kullanır.

Mutasyon sonuçları benzersiz kimlik ve revizyon anahtarı bazlı monoton filigrandan
geçer. Aynı kimlik ya da ilgili anahtarlarda daha düşük/eşit revizyon taşıyan sonuç
uygulanmaz. Graph/timeline revizyonu, mutasyondan önce başlamış bölüm snapshot'ını
geçersiz kılar; bölüm henüz yüklenmemişse ekran yükü yeniden başlatılır. Karar
ADR-034, `docs/ASYNC_STATE_ORDERING_V1.md` ve Build 158 runtime/sözleşme kanıtlarıyla
izlenir.

## Build 159 — Uçtan uca IPC taşıma bağlamı

Renderer yarış korumasının yanında preload ve ana süreç arasındaki taşıma da benzersiz istek kimliği, renderer oturum kimliği, oturum çağı, sıra ve revizyon özetiyle bağlandı. Eski oturum yanıtları preload API sınırında, yinelenen/eski istekler ana süreçte reddedilir. Uygulama handler'ları taşıma metadata'sını görmez. Karar ADR-035 ve `docs/IPC_TRANSPORT_CONTEXT_V1.md` ile kayıt altına alındı.

### DEC-065 — İptal edilebilir ve süre sınırlı IPC istek yaşam döngüsü

Build 160 ile Build 159 taşıma zarfına bağlı isteklerin ana süreç yaşam döngüsü
merkezi olarak izlenir. Kişi/olay katalogları, sınırlı snapshot, dashboard, büyük
soy ağacı/zaman tüneli/arşiv okumaları ve güvenli iptal listesi senkronizasyonu
iptal edilebilir kanallardır. Aynı kanalda daha yeni bir `latest-wins` okuması
başladığında önceki istek `superseded`; süre sınırı dolduğunda `timeout` nedeniyle
iptal edilir.

İptal mesajı sender, renderer oturumu, oturum çağı, istek kimliği ve kanal ile
birebir eşleşmeden kabul edilmez. Oturum geçişi ve pencere kapanışı yalnız aynı
oturum çağındaki iptal edilebilir işleri topluca sonlandırır. Mutasyon kanalları
varsayılan olarak iptal edilemez. Kooperatif HTTPS senkronizasyonu AbortSignal'i
DNS sonrası kontrol, endpoint döngüsü ve Node HTTPS isteğine kadar taşır. Karar
ADR-036 ve Build 160 sözleşme/runtime kanıtlarıyla izlenir.

### DEC-066 — Revizyon kapsamlı IPC salt okuma eşleme ve kısa ömürlü cache

Build 162 ile yalnız açık allowlist'teki salt IPC okumaları aynı renderer oturumu,
oturum çağı, kanal, kanonik argüman ve bütün revizyon özeti birebir aynıysa
paylaşılır. Preload eşzamanlı aynı çağrıları tek Promise üzerinde birleştirir; ana
süreç göndericiye özel, kısa TTL'li ve boyutu sınırlı sonuç cache'i uygular.

Her tüketiciye ayrı yapılandırılmış klon döner. Mutasyon başladığında preload aktif
paylaşılabilir okumaları iptal eder ve cache'i temizler. Ana süreç sender cache
neslini artırır; mutasyondan önce başlamış bir okuma sonradan tamamlansa bile eski
nesille cache'i yeniden dolduramaz. Ağ senkronizasyonu ve yazma kanalları paylaşım
dışıdır. Karar ADR-037, `docs/IPC_READ_SHARING_V1.md` ve Build 162 hedefli
sözleşme/runtime kanıtlarıyla izlenir.

## Build 163 — Gizlilik güvenli IPC performans telemetrisi

IPC taşıma katmanı yalnız kanal ve toplu performans ölçümleriyle izlenir. Kullanıcı verisi,
argüman, istek kimliği ve renderer oturum kimliği telemetri kapsamı dışındadır. Karar:
`docs/adr/ADR-038-privacy-safe-ipc-performance-telemetry.md`.

## Build 164 — Fail-closed adaptif IPC kaynak bütçeleri

- Karar: Build 163 toplu telemetrisi üç modlu adaptif admission/cache bütçelerine bağlanır.
- Sınır: bütçeler yalnız daralabilir ve zaman kilitli iyileşmeyle Build 161/162 tabanına dönebilir; tabanı aşamaz.
- Güvenlik: geçersiz/yetersiz ölçüm büyüme üretmez; mod değişimi cache'i temizler.
- Kanıt: ADR-039, Build 164 sözleşme/runtime/sözdizimi raporları.

## Build 165 — Adaptif bütçe kalıcı durum kararı

- **Karar:** Adaptif IPC bütçeleri atomik durum dosyası ve SHA-256 zincirli karar günlüğüyle saklanır.
- **Gerekçe:** Çökme/yeniden başlatma sonrası doğrulanmış mod sürekliliği ve kurcalamaya karşı fail-closed geri yükleme.
- **Sınır:** Günlük kullanıcı verisi, IPC argümanı, payload, istek veya oturum kimliği içermez.
- **ADR:** `docs/adr/ADR-040-crash-safe-adaptive-budget-state-and-decision-journal.md`

## ADR-041 — Yetkili adaptif bütçe sıfırlama ve gizlilik güvenli tanı paketi

Build 166 ile adaptif IPC bütçesi yalnız açık oturum ve ana-süreç onayıyla `baseline` moda sıfırlanır. Teknik tanı paketi kullanıcı/oturum/payload verisi içermez, SHA-256 ile doğrulanır; karantina dosyaları yaş ve adet sınırıyla tutulur.

## ADR-042 — Tek kullanımlık adaptif bütçe bakım oturumları

Build 167 ile adaptif IPC bütçe sıfırlama ve tanı dışa aktarımı doğrudan çağrılamaz. İşlem türüne özel, 90 saniyelik ve tek kullanımlık bakım oturumu; sender, renderer oturumu ve mevcut kimlik bağlamına bağlanır. Replay, süre aşımı veya bağlam değişimi fail-closed reddedilir. Oturum açma, tüketme ve ret ayrı denetim olaylarıdır.


### DEC-067 — Adaptif IPC bakım oturumu öncesi güçlü yeniden doğrulama

Build 169 ile adaptif IPC kaynak bütçesini sıfırlama ve gizlilik güvenli tanı
paketi dışa aktarma işlemleri yalnız etkin `family_admin` oturumu ve güvenilir
cihazla yetinmez. Bakım oturumu açılmadan önce hesap parolası, hesapta TOTP
etkinse ikinci faktör kodu yeniden doğrulanır.

Ham parola ve TOTP kodu yalnız kısa ömürlü IPC girdisidir; bakım oturumuna,
parmak izine, denetim metadatasına, performans telemetrisine veya tanı paketine
yazılmaz. Renderer alanları sonuçtan bağımsız olarak temizler. Build 167'nin tek
kullanımlık 90 saniyelik işlem oturumu ve Build 168'in rol/güvenilir cihaz
politikası korunur. Karar ADR-039,
`docs/IPC_ADAPTIVE_BUDGET_MAINTENANCE_REAUTHENTICATION_V1.md` ve Build 169
sözleşme/runtime kanıtlarıyla izlenir.

## Katı yaşam döngüsü politikası — Build 180

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 179–180 bağlayıcı ürün kararları

### DEC-068 — Aktif sürüm kanalı menü renkleri

Menü metni, ikon, hover ve seçili durum renkleri uygulamanın aktif kanalından
türetilir. Bronze bakır/bronz, Silver gümüş, Gold altın tokenlarını kullanır.
Kanal adı yazıyla görünür; renk tek başına anlam taşımaz. Açık/koyu görünüm ve
erişilebilirlik sınırları korunur. Karar ADR-052 ve Build 179 kanıtlarıyla izlenir.

### DEC-069 — Varsayılan aile yakınlık kataloğu ve karşılıklı bağ

Aile bireyi ekleme akışı serbest metni varsayılan yöntem olarak kullanmaz.
Domain merkezli hazır katalog; anne, baba, eş, çocuk, torun, enişte, yenge,
gelin, damat ve geniş aile ilişkilerini kapsar. Kullanıcı ilişkinin kime göre
olduğunu seçer; ileri ve ters grafik bağları aynı unit-of-work içinde oluşturulur.
Özel ilişki ve eski serbest metin uyumluluğu korunur. Karar ADR-052 ve Build 179
kanıtlarıyla izlenir.

### DEC-070 — Katı Bronze geliştirme, Silver doğrulama ve Gold üretim politikası

`PPT-LIFECYCLE-STRICT-V1` değişmez kanal sözleşmesidir. Silver veya Gold için
planlanan bütün ürün geliştirmeleri Bronze’da tamamlanır. Yalnız gerçek haricî
servis hesabı, OAuth/sertifika, sağlayıcı onayı, kota/maliyet, hukuki sözleşme ya
da gerçek ağ ortamı gerektiren ağır API üretim adaptörü askıya alınabilir.

Erteleme; açık port, sağlayıcıdan bağımsız adaptör, yapılandırma/sır yönetimi,
yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı
Bronze kaynakta hazır değilse geçerli değildir. Silver yalnız mevcut altyapı
iyileştirmesi, hata düzeltme ve bütün testler; Gold yalnız başarılı Silver sonrası
üretim paketleme, imza, operasyon ve kritik üretim düzeltmeleri içindir.

Her önemli karar aynı build içinde Ana Karar Kaydı, Belge Yetki Matrisi, kapsam,
ürün kataloğu, teknik/güvenlik/UI/test belgeleri, ilgili ADR, makine politikası,
kaynak doğrulama sözleşmesi ve aktif teslim belgelerine işlenir. Karar ADR-053 ve
`docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md` ile izlenir.


### DEC-071 — Korumalı periyodik sağlayıcı iptal listesi eşitlemesi

`PPT-LIFECYCLE-STRICT-V1` kapsamında Build 181, sağlayıcı iptal listesi eşitleme ve bekleyen güçlü-onay payloadını işletim sistemi korumalı, atomik ve yeniden başlatmaya dayanıklı duruma getirir. Liste yokluğu, 24 saat içinde sona erme ve süre dolumu kaynak bazında görünürdür; uyarılar kalıcı anahtarla tekilleştirilir. Kaynak profili veya TLS pini değişirse bekleyen liste geri çekilir. Ayrıntılı karar `docs/adr/ADR-054-protected-periodic-revocation-sync-state.md` belgesindedir.

### DEC-072 — Kurum dışı çift kanıtlı sağlayıcı kök güveni

Build 182 ile bir haricî yedek/imha kanıtı sağlayıcısının kök Ed25519 anahtarı,
yalnız aile yöneticisinin anahtarı yapıştırmasıyla güvenilir hale getirilemez.
Sağlayıcının resmî tüzel kişi kimliği bir kurum dışı kaynaktan; anahtarın tam
SHA-256 parmak izi ise bundan farklı ve bağımsız ikinci bir kanaldan doğrulanır.
Uygulama, bağımsız kanaldan girilen parmak izini ayrıştırdığı gerçek Ed25519 açık
anahtarının parmak iziyle birebir karşılaştırır ve uyuşmazlıkta güçlü doğrulamaya
ve yazma işlemine geçmeden fail-closed reddeder.

Tanık adı, tanık kurumu/rolü ve kontrol zamanı zorunludur. İki kanıt referansı aynı
olamaz. Kayıt sabit kanonik `external-backup-evidence-root-trust-verification`
makbuzuna bağlanır ve makbuzun SHA-256 özeti saklanır; ham kimlik belgesi veya
özel anahtar saklanmaz. Geçmiş anahtarlar `legacy_unverified` etiketiyle görünür
uyarı taşır. Önceki güvenilen anahtarın geçerli Ed25519 döndürme imzasıyla gelen
ardıl anahtarlar `rotation_inherited` olarak işaretlenir. Karar ADR-055 ve Build 182
sözleşme/runtime kanıtlarıyla bağlayıcıdır.

### DEC-073 — Saklama süresi dolan yönetilen yedeklerin otomatik temiz yeniden yazımı

Build 183 ile kalıcı olarak imha edilmiş kayıtları içerebilecek yönetilen tam
yedekler süresiz tutulmaz ve doğrudan silinmez. Tombstone kaydının politika
saklama süresi dolduğunda sistem önce yeni tam yedek üretir ve bütünlüğünü
doğrular; yalnız başarıdan sonra eski yönetilen `.pptbackup` kopyasını manifestli
karantinaya taşır. Bütün etkin hedefler yenilenmeden tombstone tamamlanmış sayılmaz.

Çalışma sahipliği, tetikleyici, ara durum, hata ve sonraki deneme zamanı migrasyon
29 ile kalıcıdır. Kesilen `running` çalışma yeniden başlatmada başarısız kabul
edilir ve 360 dakika geri çekilir. Manuel başarısızlık 60 dakika, otomatik
başarısızlık 360 dakika geri çekilir; CPU veya bellek yüzde 85 ve üzerindeyse
30 dakika güvenli erteleme uygulanır. Etkin hedef yokluğu sessiz başarı değil,
`attention` durumu ve görünür tanıdır. Politika değişikliği güçlü yeniden
doğrulama gerektirir. Karar ADR-056 ve
`docs/AUTOMATIC_CLEAN_BACKUP_REWRITE_V1.md` ile bağlayıcıdır.

### DEC-074 — Atomik temiz yedek sonuçlandırma ve kalıcı çalışma defteri

Build 184 ile her sahiplenilmiş temiz yedek yeniden yazım denemesi başlangıçta kalıcı çalışma defterine yazılır. Politika satırı ile aynı `runId` taşıyan `running` defter kaydı aynı repository unit-of-work içinde birlikte sonuçlandırılır; ikisinden biri değişmezse işlem fail-closed hata verir. Başarı zamanı, hata sayacı, geri çekilme, propagation kimliği ve son durum kendi alanlarına yazılır. Gerçek SQLite bağlayıcı ve sütun semantiği regresyonu Bronze kaynak kapısıdır; sahte repository kanıtı tek başına yeterli değildir. Son denemeler Güvenlik Merkezi'nde görünürdür. Karar ADR-057 ve `docs/CLEAN_BACKUP_REWRITE_FINALIZATION_LEDGER_V1.md` ile bağlayıcıdır.

### DEC-075 — Monotonik yedek yayılım kronolojisi ve gerçek tamamlanma zamanı

Build 185 ile yönetilen yedek imha yayılımının `completedAt` değeri işlem başında
önceden üretilemez. Ana süreç duvar başlangıç zamanını ve `performance.now()`
başlangıcını birlikte alır; application use-case her karantina ve final zamanını
geçen monotonik süreye göre üretir. Final zaman bütün hedef işlemlerinden sonra
alınır ve tombstone tamamlama güncellemesiyle aynı değer olarak kullanılır.
Geçersiz, sonsuz veya geriye giden monotonik okuma fail-closed reddedilir. Karar
ADR-058 ve `docs/MANAGED_BACKUP_PROPAGATION_CHRONOLOGY_V1.md` ile bağlayıcıdır.

### DEC-076 — Bağlı temiz yedek ve propagation kronolojisi bütünlüğü

Build 186 ile otomatik temiz-yedek yeniden yazımının başarı veya kısmi sonucu,
bağlı yönetilen yedek propagation çalışmasının doğrulanmış `completedAt`
değeriyle sonuçlandırılır. `success` ve `partial` kayıtları propagation kimliği
olmadan saklanamaz. Migrasyon 31, eksik bağlantı, geçersiz tarih, çalışma
başlangıcından önce tamamlanma ve propagation tamamlanmasından önce üst
sonuçlandırmayı insert/update tetikleyicileriyle atomik reddeder. Hata yolunda
geriye giden duvar saati çalışma başlangıç tabanının altına inemez. Karar
ADR-059 ve `docs/CLEAN_BACKUP_REWRITE_LINKED_CHRONOLOGY_V1.md` ile bağlayıcıdır.

### DEC-077 — Yeniden başlatmaya dayanıklı temiz-yedek kesinti kurtarma kronolojisi

Build 187 ile kesilmiş otomatik temiz-yedek yeniden yazımı yalnız yeniden
başlatmada gözlenen duvar saatiyle sonuçlandırılmaz. Repository, kalıcı çalışma
defterindeki `started_at` değerini; yoksa politika `in_progress_started_at`
değerini güvenli taban olarak alır ve kurtarma zamanını
`max(observedAt, persistedStartedAt)` biçiminde üretir. 360 dakikalık otomatik
geri çekilme bu güvenli tamamlanma zamanından hesaplanır.

Yeni çalışma sahiplenilirken eski `next_attempt_at` temizlenir. Migrasyon 32;
çalışan politika sahipliği, çalışan/tamamlanmış defter durumu, zorunlu sonraki
deneme ve tamamlanma-sonraki deneme sırasını insert/update tetikleyicileriyle
atomik korur. Saat düzeltmesi gizlilik güvenli görünür tanı üretir. Karar
ADR-060 ve `docs/CLEAN_BACKUP_REWRITE_RECOVERY_CHRONOLOGY_V1.md` ile bağlayıcıdır.

### DEC-078 — Geri alma güvenli temiz-yedek sahiplenme kronolojisi

Build 188 ile yeni otomatik temiz-yedek yeniden yazım çalışmasının başlangıç
zamanı yalnız gözlenen duvar saatinden alınmaz. Gözlenen saat; kalıcı politika
`updated_at`, son deneme, son başarı ve varsa devam eden çalışma başlangıcıyla
karşılaştırılır, en ileri zaman güvenli sahiplenme tabanıdır. Bekleyen kayıt
durumu ve saklama kesimi bu güvenli zamanda yeniden hesaplanır. Gelecekteki
`next_attempt_at` güvenli tabana katılmaz ve geri çekilme erkenden aşılamaz.

Repository güvenli başlangıç, sayaçlar ve saklama kesimini doğrular. Migrasyon 33
politika ve çalışma defteri zaman gerilemesini, uyumsuz sahiplenme alanlarını,
çalışma başlangıcı/saklama kesimi değişikliğini ve aynı anda ikinci `running`
kaydı SQLite tetikleyicileri ve kısmi benzersiz indeksle fail-closed reddeder.
Karar ADR-061 ve `docs/CLEAN_BACKUP_REWRITE_CLAIM_CHRONOLOGY_V1.md` ile
bağlayıcıdır.

### DEC-079 — Aktif temiz-yedek çalışma operasyonel izolasyonu

Build 189 ile politika `running` iken kullanıcı tarafından değiştirilemez. Kesinti kurtarma zamanı; gözlenen saat, kalıcı politika kronolojisi ve çalışma defteri `started_at`/`updated_at` değerlerinin en ilerisine eşittir. Terminal çalışma durumu politika durumu, son sonuç, hata ve sonraki deneme alanlarıyla birebir eşleşir. Migrasyon 34 aktif ayar değişikliğini ve çelişkili terminal yazımı fail-closed reddeder. Karar ADR-062 ve `docs/CLEAN_BACKUP_REWRITE_OPERATIONAL_ISOLATION_V1.md` ile bağlayıcıdır.


### DEC-080 — Monotonik temiz-yedek terminal kronolojisi

Build 190 ile yayılım üretmeyen `deferred`, `attention` ve `failed` temiz-yedek yolları terminal zamanını sistem duvar saatinden yeniden okuyamaz. Güvenli claim duvar zamanı ve claim öncesi monotonik başlangıç birlikte alınır; tamamlanma zamanı geçen monotonik süreyle üretilir ve retry/erteleme bu zamana bağlanır. Geçersiz, negatif, sonsuz, okunamayan veya geriye giden monotonik saat fail-closed reddedilir. `success` ve `partial` için bağlı propagation tamamlanma zamanı yetkili kalır. Karar ADR-063 ve `docs/CLEAN_BACKUP_REWRITE_TERMINAL_CHRONOLOGY_V1.md` ile bağlayıcıdır.


### DEC-081 — Temiz-yedek geri çekilmesi çalışma tetikleyicisine bağlıdır

Manuel attention, partial, failed ve interrupted sonuçları 60 dakika; otomatik sonuçlar 360 dakika geri çekilir. Deferred sonucu 30 dakikalık yüksek yük ertelemesi kullanır. Kesinti kurtarması kalıcı `last_trigger` değerini esas alır. Politika ve çalışma defteri retry zamanı terminal tamamlanma + doğru gecikme olmak zorundadır; repository ve SQLite sapmayı fail-closed reddeder. ADR-064 ve `docs/CLEAN_BACKUP_REWRITE_TRIGGER_AWARE_BACKOFF_V1.md` bağlayıcıdır.

### DEC-082 — Manuel temiz-yedek çalışması otomatik etkinlik anahtarından bağımsızdır

`enabled=false` yalnız zamanlanmış otomatik çevrimi kapatır. Aile yöneticisinin açık manuel “Şimdi çalıştır” komutu; geri çekilme, tek çalışma sahipliği, saklama kesimi ve kronoloji kurallarına uyarak çalışabilir. Otomatik claim devre dışı politikada reddedilir. Migrasyon 36, `enabled=0` altında yalnız `last_trigger='manual'` ile `running` durumuna izin verir. ADR-065 ve `docs/CLEAN_BACKUP_REWRITE_MANUAL_AVAILABILITY_V1.md` bağlayıcıdır.



## DEC-083 — Çalışan temiz-yedek defteri sahip kimliği bütünlüğü

`running` çalışma defteri satırı; politika `in_progress_run_id`, `last_trigger`, `in_progress_started_at`, `last_attempt_at` ve claim `updated_at` kronolojisiyle birebir eşleşir. Yetim/mismatched satırlar ve aktif satır silme işlemi SQLite düzeyinde fail-closed reddedilir. `ADR-066` ve `docs/CLEAN_BACKUP_REWRITE_RUNNING_LEDGER_IDENTITY_V1.md` bağlayıcıdır.


### DEC-084 — Temiz-yedek claim rezervasyonu

Build 194 ile politika sahiplenmesi, çalışma defteri ve tüketilmiş claim rezervasyonu aynı kimlik, tetikleyici, başlangıç, saklama kesimi ve sayaçlarla bağlanır. Rezervasyonsuz veya uyumsuz sahiplenme SQLite düzeyinde reddedilir. ADR-067 bağlayıcıdır.


### DEC-085 — Aktif temiz-yedek sahiplik anlık görüntüsü değiştirilemez

Build 195 ile `running` politika sahibinin kimliği ve claim saatleri ile çalışma defterinin saklama kesimi, bekleyen kayıt sayısı, etkin hedef sayısı ve çalışma kronolojisi terminal geçişe kadar değiştirilemez. Tamamlama yalnız tüketilmiş rezervasyon, politika ve defter üçlüsü hâlâ birebir eşleşiyorsa kabul edilir. Migrasyon 39 ve ADR-068 bağlayıcıdır.

### DEC-086 — Aktif temiz-yedek politika parametreleri değiştirilemez

Build 196 ile `running` çalışma boyunca otomatik etkinlik, saklama günü, manuel/otomatik geri çekilme ve yüksek yük erteleme parametreleri terminal geçişe kadar değiştirilemez. Terminal geçiş cümlesi bu alanlarda değişiklik taşıyamaz. Migrasyon 40 ve ADR-069 bağlayıcıdır.

## DEC-087 — Atomik temiz-yedek terminal geçişi

Build 197 ile politika tek başına `running` durumundan çıkarılamaz. Terminal çalışma defteri güncellemesi, politikayı aynı SQLite cümlesi içinde eşleşen terminal duruma geçirir. Terminal cümlesinde iş yükü kimliği değiştirilemez. Migrasyon 41 ve ADR-070 bağlayıcıdır.


## DEC-088 — Terminal temiz-yedek kronolojisi monotoniktir

Build 198 ile terminal tamamlanma zamanı çalışma başlangıcından önce olamaz. Migrasyon 42 ve ADR-071 bağlayıcıdır.

## DEC-095 — Ana build defteri her buildde zorunlu olarak güncellenir

Build 205 ile 20 Temmuz 2026’dan itibaren bütün buildler ve kalan işler `config/master-build-ledger.json` ile `docs/17_MASTER_BUILD_LEDGER.md` içinde tek yetkili devam kaydında birleştirilmiştir. Her yeni build başlangıcında kayıt `IN_PROGRESS` açılır; build sonunda yapılan iş, kanıtlar, kalan iş durumu ve kullanıcıya verilen durum bildirimi kaydedilmeden build tamamlanmış veya teslim edilmiş sayılamaz. Geçmiş tamamlanmış buildler değiştirilemez. Yeni sohbet ve geliştirme oturumları ana build defterinden başlar. ADR-078 ve `PPT-BUILD-LEDGER-CONTINUITY-V1` bağlayıcıdır.


## DEC-096 — Bağlayıcı proje kural seti her sohbet ve build öncesi okunur

Build 206 ile 105 maddelik kesin proje kural seti `config/master-build-ledger.json` ve
`docs/17_MASTER_BUILD_LEDGER.md` içine alınmıştır. Yeni sohbet, geliştirme oturumu veya
yeni build; plan, kod veya değişiklik üretmeden önce güncel Ana Build Defteri'ni ve
yürürlükteki kural setini okumalıdır. Build başlangıcı, güncel kural setinin SHA-256
özetinin `--rules-ack` ile kabul edilmesi olmadan açılamaz. Kural değişikliği yalnız
yeni build içinde, açık kullanıcı kararıyla, yeni kural sürümü ve yeni hash üretilerek
yapılabilir; geçmiş kural sürümleri korunur. ADR-079 ve
`PPT-BUILD-LEDGER-CONTINUITY-V2` bağlayıcıdır.

## DEC-097 — Sohbet bağlam kapasitesi ve istisnasız yeni-sohbet devir eşiği

Build 207 ile her tamamlanan build sonrasında sohbet bağlamının tahmini kullanılan ve
kalan yüzdesi Ana Build Defteri build kaydına ve kullanıcı durum bildirimine eklenir.
%85–89 tahmini kullanım uyarı bölgesidir. %90 veya üzeri tahmini kullanım istisnasız
`HARD_STOP` eşiğidir: aynı sohbet içinde yeni build başlatma ve alternatif sürüm
yükseltme yolları fail-closed reddedilir. `HARD_STOP` durumunda son build/sürüm,
güncel kural seti ve SHA-256, yetkili Ana Build Defteri, sıradaki açık iş ve kalan
işleri içeren yeni-sohbet devir promptu zorunlu olarak üretilir. Yeni sohbet kuralları
kullanıcıdan yeniden istemez; Ana Build Defteri'nden okur. ADR-080,
`PROJECT-RULES-2026-08-01-V2` ve `PPT-BUILD-LEDGER-CONTINUITY-V3` bağlayıcıdır.

## DEC-098 — Proje Anayasası V3

20.07.2026 kaynak başlangıcı, marka/uygulama adı ayrımı, öneri etki analizi, build-sonu ilerleme tahmini, aktif sürüm eşliği, eski yatırım bağlamı yasağı, API P0/P1/P2 önceliği, UI Görsel Referans Manifestosu, Bronze Final işlevsellik/dead-code sınırı, boş production başlangıcı, Artifact Index, Master DOCX/PDF ve doğal kişi/aile kimliği yasağı kabul edilmiştir. ADR-081 uygulama otoritesidir.

## DEC-100 — Terminal temiz-yedek çalışma defteri değişmezliği

Build 210 ile `backup_clean_rewrite_runs` tablosunda `running` dışındaki satırlar değişmez tarihsel kanıt kabul edilir. Terminal satırda gerçek veri değiştiren UPDATE ve DELETE reddedilir; aynı terminal kimliğe INSERT girişi reddedilerek SQLite `INSERT OR REPLACE` bypassı `recursive_triggers=0` durumunda da kapatılır. No-op UPDATE ve normal `running → terminal` atomik sonuçlandırma korunur. Migrasyon 49, ADR-083 ve `docs/CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1.md` bağlayıcıdır.

- **DEC-101** — Clean install external access handoff: gerçek npm ci PASS olmadan OPEN-002 kapanmaz; 117-tarball doğrulanmış handoff kullanılır. (`docs/decisions/DEC-101-clean-install-external-access-handoff.md`)


## DEC-102 — Onaylı UI görsel baseline düzeltmesi

Build 212 ile Build208–211 teslimlerinde yanlışlıkla aktif baseline olarak taşınan koyu dashboard görseli kaldırıldı. Kullanıcının Anadolu parsı logosu ve önceki font/renk kurallarıyla onayladığı açık-tema manifesto SHA-256 ile sabitlenerek aktif görsel otorite yapıldı. ADR-085 ve `scripts/verify-build212-ui-visual-baseline-provenance-contract.mjs` bağlayıcı kanıttır.


## DEC-103 — Bellek-içi aktif kullanıcı verisi oturumu

Build 213 ile kimliği doğrulanmış oturumun aktif SQLite veritabanı düz disk dosyasından süreç belleğine taşındı. Kalıcı ana veri yalnız AES-256-GCM kullanıcı kasasıdır. Hydration/snapshot/restore için gereken kısa ömürlü SQLite görüntüleri Windows production'da önceden EFS ile korunan bounded staging alanında yürür; EFS kurulamazsa fail-closed durur. 30 saniyelik şifreli checkpoint uygulanır. Aynı kullanıcı/malware/admin için mutlak izolasyon iddia edilmez. ADR-086 ve `docs/security/IN_USE_USER_DATA_PROTECTION_BUILD213.md` bağlayıcıdır.

## DEC-104 — Hassas yan-artifactlar varsayılan şifreli kapsayıcıdır

Build 214 ile log, diagnostic/export, system health report, security receipt ve startup evidence kalıcı plaintext yüzey olmaktan çıkarıldı. `.pplog`, `.pptdiag` ve `.pptreport` AES-256-GCM kapsayıcıları; cihaz-korumalı yan-artifact anahtarı ve volatil browser/cache/temp/crash çalışma alanı bağlayıcıdır. ADR-087 ve `docs/security/PROTECTED_SIDE_ARTIFACTS_BUILD214.md` uygulama otoritesidir. Gerçek Windows safeStorage/DPAPI doğrulaması NOT_RUN'dır.

## DEC-105 — PR-171 adımlı çalışma ve kalıcı doğrulama

Build 214 sırasında uzun/zaman-aşımı riski taşıyan işler bağımsız küçük adımlara ayrılacak; her adım uygulanıp doğrulanacak, sonucu kalıcı kaydedilecek ve ancak kısa durumdan sonra sonraki adıma geçilecektir. ADR-088 bağlayıcıdır. Build214 kaynak-kurtarma sürecindeki V5 tarihsel handoff SHA uyuşmazlığı `artifacts/validation/build214-v5-rule-hash-recovery.json` içinde ayrıca korunur.

## DEC-106 — OPEN-021/022 gerçek Windows kanıt zinciri

Build 215 ile OPEN-021 ve OPEN-022 platform kapanışı gerçek Windows EFS, Electron `safeStorage`/DPAPI ve development + paketli Electron çift launch kanıtına bağlandı. Non-Windows/mock sonuçları resmî PASS değildir; diagnostic sandbox istisnaları resmî kapıyı değiştirmez. ADR-089 ve `docs/security/WINDOWS_SECURITY_EVIDENCE_BUILD215.md` bağlayıcıdır.

## DEC-107 — Windows evidence intake exact kaynak snapshotına bağlıdır

Build 216 ile gerçek Windows kanıt paketi; `manifest.json` ve `SHA256SUMS.txt` kaynak kök hashleri, her zorunlu kanıt dosyasının byte boyutu/SHA-256 değeri ve ayrı ZIP SHA-256 ile bağlanır. Platform-bağımsız intake doğrulaması bütün kanıtları fail-closed kontrol eder; PASS yalnız `READY_TO_CLOSE` üretir ve Ana Build Defteri'ni otomatik değiştirmez. ADR-090 ve `docs/security/WINDOWS_EVIDENCE_INTAKE_BUILD216.md` bağlayıcıdır.


## DEC-108 — OPEN-021 gerçek Windows kapanışı ayrı ve dar bir kapıdır

Build 217 ile OPEN-021; full RC2/Silver gate zincirinden ve OPEN-022 kapanışından ayrıldı. Exact Build217 kaynak bütünlüğü, gerçek Windows development launch, EFS-korumalı bellek-içi SQLite snapshot/staging ve kurulu/paketli Electron launch kanıtları tek başına OPEN-021 için `READY_TO_CLOSE` üretir. `npm ci` yalnız execution prerequisite olup OPEN-002'yi otomatik kapatmaz; OPEN-022 `UNCHANGED` kalır. ADR-091 ve `docs/security/OPEN021_WINDOWS_CLOSURE_BUILD217.md` bağlayıcıdır.


## DEC-109 — OPEN-022 gerçek Windows kapanışı ayrı ve dar bir kapıdır

Build 218 ile OPEN-022; OPEN-021 EFS kapanışından, full RC2/Silver gate zincirinden ve genel dependency audit kapsamından ayrıldı. Exact Build218 kaynak bütünlüğü, gerçek Windows Electron safeStorage backend=`dpapi`, stabil `electron-safe-storage-v1` key-envelope kimliği, şifreli `.pplog/.pptdiag/.pptreport`, şifreli startup-security evidence, volatil browser/crash yolları ve development + kurulu/paketli Electron kanıtları tek başına OPEN-022 için `READY_TO_CLOSE` üretir. `npm ci` yalnız execution prerequisite olup OPEN-002'yi otomatik kapatmaz; OPEN-021 `UNCHANGED` kalır. ADR-092 ve `docs/security/OPEN022_WINDOWS_CLOSURE_BUILD218.md` bağlayıcıdır.


## DEC-110 — OPEN-021 ve OPEN-022 tek Build219 Windows güvenlik kapanışında birleştirilir

Build219 ile OPEN-021 EFS ve OPEN-022 safeStorage/DPAPI + Protected Side Artifact gerçek Windows kapanışları tek Build219 source snapshotı, tek dependency bootstrap, tek installer build/install/uninstall ve tek evidence bundle altında birleştirilir. Readiness her OPEN için bağımsızdır; bir probe FAIL diğer kalemin geçerli PASS kanıtını silmez. Runner ledger mutasyonu yapmaz ve `npm ci` OPEN-002'yi otomatik kapatmaz. ADR-093 ve `docs/security/BRONZE_WINDOWS_SECURITY_CLOSURE_BUILD219.md` bağlayıcıdır.

## DEC-111 — Build219 gerçek Windows failure evidence ve Build220 bootstrap düzeltmesi

Build219 exact-source gerçek Windows testi source integrity ve root `npm ci` adımlarını geçti; installer build exit code 1 ile durdu. Build220, izole `tools/windows-packager` dependency graphını `npm run windows-packager:install` ile zorunlu bootstrap eder, builder CLI varlığını fail-closed doğrular, Windows PowerShell 5.1 için Build220 `.ps1` dosyalarında UTF-8 BOM kullanır ve bounded stdout/stderr tanı kanıtı üretir. OPEN-021/022 exact Build220 gerçek Windows evidence gelmeden kapanmaz. ADR-094 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD220.md` bağlayıcıdır.

## DEC-112 — Build220 gerçek Windows failure evidence ve Build221 workspace-build düzeltmesi

Build220 exact-source gerçek Windows koşusunda source integrity, root `npm ci` ve isolated `windows-packager` bootstrap PASS; installer build ise workspace `dist` çıktıları eksik olduğu için TS2307 hatalarıyla FAIL oldu. Build221 installer öncesinde `npm run build:packages` çalıştırır ve 13 workspace paketinin `dist/index.js` + `dist/index.d.ts` çıktısını fail-closed doğrular. OPEN-021/022 exact Build221 Windows evidence gelmeden kapanmaz. ADR-095 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD221.md` bağlayıcıdır.

## DEC-113 — Build221 gerçek Windows failure evidence ve Build222 preload TypeScript düzeltmesi

Build221 exact-source gerçek Windows koşusunda source integrity, root `npm ci`, isolated `windows-packager` bootstrap, workspace package build ve dist guard PASS; installer build ise `preload.ts` satır 146'daki doğrudan `globalThis.addEventListener` erişimi nedeniyle TS7017 ile FAIL oldu. Build222, DOM type yüzeyini genişletmeden dar bir `rendererLifecycleTarget` structural type adapter kullanır; mevcut `beforeunload` cancellation davranışı korunur. ES2024-only TypeScript A/B regresyonu eski ifadenin TS7017 verdiğini ve yeni adapter'ın derlendiğini kanıtlar. OPEN-021/022 exact Build222 gerçek Windows evidence gelmeden kapanmaz. ADR-096 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD222.md` bağlayıcıdır.


## DEC-114 — Build222 gerçek Windows failure evidence ve Build223 preload CommonJS graph düzeltmesi

Build222 exact-source gerçek Windows koşusunda source integrity, root `npm ci`, isolated Windows packager bootstrap, workspace package build ve dist guard PASS; installer build ise geçici `preload.cts` içine yalnız preload kaynak dosyası kopyalandığı için üç relative IPC modülünde `TS2307` ve `.cts` generic arrow sözdiziminde iki `TS7060` ile FAIL oldu. Build223 preload ile üç local IPC bağımlılığını kontrollü CommonJS TypeScript staging grafiğinde derler, staged relative IPC specifier'larını `.cjs` olarak yeniden yazar ve `.cts` generic arrow parametrelerini CJS-uyumlu biçime normalize eder. Focused compile/tamper runtime valid graph'ın dört `.cjs` çıktısını ürettiğini ve eksik dependency'de fail-closed davrandığını doğrular. OPEN-021/022 exact Build223 gerçek Windows evidence gelmeden kapanmaz. ADR-097 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD223.md` bağlayıcıdır.

## DEC-115 — Build223 gerçek Windows failure evidence ve Build224 NSIS lisans senkronizasyonu

Build223 exact-source gerçek Windows koşusunda source integrity, dependency bootstrap, isolated packager bootstrap, workspace build/dist guard, Electron main/preload build ve renderer build PASS; installer ön doğrulaması stale `LICENSE_TR.rtf` nedeniyle FAIL oldu. Build224 `LICENSE_TR.txt` kaynağını tek lisans içerik otoritesi yapar, generation/verification için ortak deterministic renderer kullanır ve `package:win` öncesinde `verify:license-sync` ile frozen source byte eşliğini fail-closed doğrular. Paketleme kaynak snapshotını sessizce değiştirmez. OPEN-021/022 exact Build224 gerçek Windows evidence gelmeden kapanmaz. ADR-098 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD224.md` bağlayıcıdır.

## DEC-116 — Build224 Windows security root-cause remediation

Build225, exact Build224 gerçek Windows tanısında kanıtlanan OPEN-021 PowerShell `$args[0]` null yol aktarımını, doğrulanmamış EFS staging/snapshot mirasını, OPEN-022 backend-name eşitliği kapısını ve fatal startup `app.quit()` exit-0 maskelemesini düzeltir. EFS her dosyada NTFS attribute ile fail-closed doğrulanır; safeStorage gerçek davranış turuyla kanıtlanır; fatal startup non-zero çıkar. OPEN-021/022 gerçek Windows development + installed PASS olmadan kapanmaz. ADR-099 bağlayıcıdır.

## DEC-117 — PR-172 yalnız platform-gerçek bağlam ölçümüne dayanır

Build225 ile yalnız platformun sağladığı gerçek kullanım `%90+` olduğunda HARD_STOP ve zorunlu aynı-yanıt devir uygulanır. Tahmin ve ölçüm yokluğu HARD_STOP üretmez; gerçek `%90` altı için devir zorunlu değildir. Constitution V6 ve ADR-100 bağlayıcıdır.

## DEC-118 — Fresh-profile cihaz kimliği başlangıç sırası

Build226, startup security preflight sonrasında korumalı cihaz kimliğini oluşturur/doğrular; cihaz-bağlı bakım durumu ancak bundan sonra restore edilir. Bozuk, yanlış sağlayıcılı veya açılamayan kimlik fail-closed kalır. ADR-101 bağlayıcıdır.

## DEC-119 — Build227 dört kanıtlanmış Windows kök nedeni

Build227 yalnız sandbox preload `node:crypto`, süreçler arası kalıcı Windows key-envelope sağlayıcısı, kısa ve dinamik installer lifecycle doğrulaması ve OPEN-022 stale backend-name sözleşmesini düzeltir. CurrentUser DPAPI iki bağımsız süreçte PASS veren üretim sağlayıcısıdır; Electron async safeStorage iki-süreç FAIL olduğu için seçilmemiştir. ADR-102 bağlayıcıdır.

## DEC-120 — Build228 OPEN-021/OPEN-022 resmî kapanışı

Build228 governance-only kapanış buildidir. `OPEN-021 = CLOSED` ve `OPEN-022 = CLOSED` kararları exact Build227 source SHA-256 `131091a153cf3a7eaf78b62f1dc2696761b8bde79cd7e3206264e10cb672d2c0` ile gerçek Windows evidence ZIP SHA-256 `efa151bb35b4ea0a027327052f735d42048f3e3c1f809175abf0cd5015549564` bağında alınmıştır. `NOT_RUN != PASS`, PR-172 ve Silver FAIL sonuçları değişmemiştir. DEC-120 ve ADR-103 bağlayıcıdır.

## DEC-171 — Family-data coexistence and default-deny cutover gate

31-J ile mevcut Desktop kasası ve aktif SQLite oturumu yetkili veri yolu olarak korunur. Yeni Core Service mimarisi gerçek aile verisini, korumalı oturumu veya yazma sahipliğini otomatik alamaz. `family-data-cutover.status`, Core Service bileşim kilidi ve Desktop başlangıç doğrulaması birlikte varsayılan-ret uygular. Gelecekteki geçiş; uçtan uca güvenlik, anahtar yaşam döngüsü, tek-yazıcı, geri dönüş tatbikatı ve açık kullanıcı onayının tamamı ayrı bir sürümlü kararla PASS olmadan açılamaz. DEC-171 bağlayıcıdır.

## DEC-172 — Monotonic cutover-readiness evidence and tamper-evident acceptance state

31-K ile beş zorunlu cutover kapısı ayrı, tam-sıralı epoch ve SHA-256 zincirli bir kanıt defterinde izlenir. Yeni PASS ancak güvenilir doğrulayıcıyla kabul edilir; dolu defter güvenilir epoch/dosya sayısı/head-hash ankrajı olmadan restore edilemez. Desktop zinciri yeniden hesaplar ve sahte toplu PASS, yetki eklenmesi, kayıt silinmesi/değişmesi veya hash çelişkisinde fail-closed durur. Bütün kapılar PASS olsa dahi DEC-171 kalkmaz, cutover `blocked` kalır ve ayrı sürümlü kullanıcı kararı gerekir. Üretim doğrulayıcısı ile kalıcı korumalı readiness journal henüz bağlı değildir; gerçek veri ve SQLite sahipliği taşınmaz. DEC-172 bağlayıcıdır.

## DEC-173 — Protected cutover-readiness journal port and detached default-deny boundary

31-L, DEC-172 readiness journal ve güvenilir ankrajı için asenkron `load`, compare-and-swap ve `seal` portunu tanımlar. Üretim bileşimi detached kalır; `available=false`, `protectionId=null` ve bütün işlemler `JOURNAL_UNAVAILABLE` ile fail-closed reddedilir. Port runtime veya readiness ledger'a bağlanmaz; filesystem, SQLite, Electron, ortam sırrı, kalıcı yol, koruma anahtarı ya da gerçek veri bağımlılığı eklemez. DEC-171 cutover yasağı ile DEC-172 kanıt kuralları değişmez. DEC-173 bağlayıcıdır.

## DEC-174 — Signed cutover-readiness evidence verifier public-key-only boundary

31-M, readiness kanıtı için yalnızca Node `KeyObject` türünde Ed25519 açık anahtar kabul eden, anahtar kimliğini sürümlü kanonik imza yüküne bağlayan ve hatalı claim'leri istisna fırlatmadan reddeden doğrulayıcıyı tanımlar. PEM metni, private key, imzalayıcı, anahtar üretimi/rotasyonu, ortam değişkeni, kalıcı yol, runtime bileşimi ve cutover yetkisi eklenmez. 64 bayt imza canonical unpadded Base64URL olarak ve tam claim anahtar setiyle doğrulanır. DEC-171 blocked kalır; DEC-172 ve DEC-173 zayıflatılmaz. DEC-174 bağlayıcıdır.

## DEC-175 — Synthetic single-writer proof harness detached non-authoritative boundary

31-N, başlangıçta DEC-171 ile uyumlu biçimde yalnız Desktop yazıcısını etkin gösteren saf sentetik bir durum makinesi tanımlar. Eski epoch, eski sentetik kanıt zinciri, tekrar kullanılan digest, hatalı sahip, çift-yazıcı, sıfır-yazıcı ve fazla alanlı geçişler fail-closed reddedilir; reddedilen geçiş durumu değiştirmez. Her snapshot açıkça sentetik ve yetkisizdir; gerçek `SINGLE_WRITER_PROOF` kapısını geçemez. Runtime, gerçek kasa, SQLite, üretim lease'i, crash/restart/rollback kanıtı ve cutover yetkisi eklenmez. DEC-171 blocked kalır; DEC-172, DEC-173 ve DEC-174 zayıflatılmaz. DEC-175 bağlayıcıdır.

## DEC-176 — Synthetic key lifecycle proof harness detached non-submittable boundary

31-O, gerçek anahtar üretmeden veya yüklemeden opak handle bağlantısı, en fazla bir sentetik plaintext lease, sealing ve lease bırakma sırasını modelleyen saf bir durum makinesi tanımlar. Tam input şekli, güncel epoch, geçerli yaşam döngüsü ve tekrar kullanılmamış SHA-256-format digest zorunludur. Candidate üretim `gateId` alanı taşımaz; yalnız modellenen kapıyı ve üretime sunulamaz olduğunu bildirir. Runtime, gerçek provider, gerçek anahtar, vault, SQLite, crash/restart/memory-clearing kanıtı veya cutover yetkisi eklenmez. DEC-171 blocked kalır; DEC-172–DEC-175 zayıflatılmaz. DEC-176 bağlayıcıdır.

## DEC-177 — Synthetic rollback and recovery drill detached non-submittable boundary

31-P, baseline sealing, salt-okunur aday, sentetik hata enjeksiyonu, geri alma başlangıcı, Desktop yazıcısının doğrulanması ve sentetik kurtarma doğrulamasını modelleyen saf bir durum makinesi tanımlar. Desktop her aşamada tek sentetik yazıcıdır; Core Service yazılabilir olmaz. Tam input şekli, güncel epoch, geçerli sıra ve tekrar kullanılmamış SHA-256-format digest zorunludur. Candidate üretim `gateId` taşımaz ve gerçek `ROLLBACK_DRILL` kanıtı olarak sunulamaz. Gerçek süreç çökmesi, yeniden başlatma, yedek geri yükleme, runtime, vault, SQLite, aile verisi veya cutover yetkisi eklenmez. DEC-171 blocked kalır; DEC-172–DEC-176 zayıflatılmaz. DEC-177 bağlayıcıdır.

## DEC-178 — End-to-end security evidence aggregator detached non-submittable boundary

31-Q, yedi kanonik güvenlik kontrolü için tam biçimli, doğrulayıcıya bağlı, global olarak benzersiz ve değiştirilemez sentetik gözlemleri toplayan saf bir birleştirici tanımlar. Her kontrol yalnız bir kez kaydedilir; başarısız gözlem PASS ile değiştirilemez. Candidate yalnız yedi kontrolün tamamı PASS olduğunda ve sabit kontrol sırasıyla üretilebilir. Üretim `gateId` taşımaz ve gerçek `END_TO_END_SECURITY_VALIDATION` kanıtı olarak sunulamaz. Birleştirici güvenlik tatbikatlarını çalıştırmaz, bağımsız süreç kanıtını doğrulamaz ve runtime, gerçek veri, SQLite veya cutover yetkisi eklemez. DEC-171 blocked kalır; DEC-172–DEC-177 zayıflatılmaz. DEC-178 bağlayıcıdır.

## DEC-260 — Ek kural toplu birleştirme ve doğrulanmış Git teslimi

20.08.2026 tarihinde 18.08.2026 ek karar tamponundaki EK-001–EK-019 kayıtları silinmeden tarihsel kaynak olarak korunmuş, çatışma ve daha yeni karar denetimiyle PR-218–PR-227 kanonik kurallarına ve aktif belge/iş listelerine bağlanmıştır. ParsYuva AYM marka kararı eski Anadolu Parsı kısayolunu superseded eder. Tam regresyon, typecheck, üretim derlemeleri, installer doğrulaması, yerel paket açılış-kapanış yaşam döngüsü ve GitHub + yerel yedek uzak depolarında aynı commit okunmadan teslim tamamlanmış sayılamaz. Authenticode, temiz makine, Gold üretim anahtarı ve hukuk/gizlilik/vergi/sağlayıcı UAT kanıtları dış kaynak olarak fail-closed açık kalır. DEC-260 bağlayıcıdır.

## DEC-261 — AYM kısaltmasının güncel ürün yüzeylerinden kaldırılması

20.08.2026 tarihinde güncel ürün adı `ParsYuva Aile Yaşam Merkezi` olarak kesinleştirilmiştir. `AYM` kısaltması ürün, pencere, kısayol, kurulum dosyası, yardım, sesli anlatım, aktif belge başlığı ve yeni kullanıcıya dönük metadata içinde kullanılamaz. Önceki `ParsYuva AYM` kararının güncel marka kısmı superseded edilmiştir. `C:\PPT\AYM` çalışma kökü, kararlı appId, eski kullanıcı veri dizini, tarihsel karar/kanıt kimlikleri ve özgün tarihsel içerik yalnız geriye dönük uyumluluk ile kanıt bütünlüğü için korunur ve güncel marka sayılmaz. DEC-261 bağlayıcıdır.

## DEC-263 — Kod değişikliğinde eski Windows kurulum artefaktlarının silinmesi

22.08.2026 tarihinde kaynak kod veya Windows paketleme davranışı değiştiğinde `apps/desktop/release` altındaki önceki ParsYuva installer EXE, blockmap ve SHA-256 dosyalarının yeni build öncesinde silinmesi kararlaştırılmıştır. Paketleme sonrasında yalnız güncel görünür sürüme ait en fazla bir installer seti kalabilir. Temizlik kurulu uygulamayı, kullanıcı verisini, kaynak arşivlerini veya tarihsel yönetişim kanıtlarını kapsamaz. DEC-263 ve PR-229 bağlayıcıdır.

## DEC-264 — Görünür sürüm kanalının tek kez gösterilmesi

22.08.2026 tarihinde kullanıcıya görünür sürüm satırlarında Bronze, Silver veya Gold kanal adının yalnız bir kez gösterilmesi kararlaştırılmıştır. Kanal adı kanonik `releaseLabel` içinde kalır; `stage` kanal-bağımsız yaşam döngüsü durumunu taşır ve kanal adı içeremez. Türkçe, İngilizce, ilk kurulum, güvenli başlangıç ve ana uygulama yüzeyleri bu kurala uyar. DEC-264 ve PR-230 bağlayıcıdır.

## DEC-265 — Her işlem öncesi zorunlu kural kontrolü

22.08.2026 tarihinde kod, dosya, yapılandırma, belge, test, derleme, paketleme, kurulum, silme, yayımlama veya dış sisteme yazma gibi her durum değiştiren işlemden önce güncel kural sicili, hash, kullanıcı onayı ve evrensel fail-closed enforcement bağının doğrulanması kararlaştırılmıştır. Kontrol PASS olmadan işlem başlayamaz; kural değişirse sonraki mutasyondan önce kontrol yenilenir. Waiver ve atlama yoktur. DEC-265 ve PR-231 bağlayıcıdır.

## DEC-266 — Özel kurulum, ilk aile, temiz paket ve çift yedek kabul zinciri

22.08.2026 tarihinde özel ParsYuva installer yüzeyi, 900x640 ölçekli ve üç pars aile kompozisyonlu ilk aile ekranı, Türkçe/İngilizce aynı dilde kadın ses önceliği ile erkek ses yedeği, belirgin pencere/tepsi simgeleri, atomik SQLite başlangıcı, veri koruyan yükseltme, eski installer temizliği, tüm workspace paketlerinin sıfırdan derlenmesi, paketli gerçek uygulama açılışı/sürümü, SHA-256/imza durumu, GitHub + haricî Git eşitliği ve D: haricî kaynak arşivi geri-okuması tek fail-closed kabul zinciri olarak kararlaştırılmıştır. Bu kararın üç pars ve statik karşılama hükümleri DEC-267 ile superseded edilmiştir.

## DEC-267 — Geçişli sesli kurulum, tek pars ve kasa kilidi düzeltmesi

22.08.2026 tarihinde installer karşılama yüzeyinin ilk kullanıcı oluşturma ekranının sakin görsel dilinde üç gerçek bilgi kartı arasında geçmesi, bu geçişlerin yüzde veya kurulum ilerlemesi gibi sunulmaması, kurulum seslendirmesinde Türkçe/İngilizce aynı dil kadın sesinin ve bulunamazsa aynı dil erkek/kurulu sesin kullanılması, ilk aile markasının eski tek parsa dönmesi, kilitli oturumun açık veri kasasını yok etmemesi ve ilk 2FA/güvenilir cihaz töreninin yalnız kapalı bootstrap kanal listesinde tamamlanması kararlaştırılmıştır. Veri koruyan yükseltme, eski installer temizliği, temiz tam derleme, paketli runtime, SHA-256/imza ve çift Git + haricî kaynak geri-okuma zinciri korunur. DEC-267 ve PR-233 bağlayıcıdır.

## DEC-268 — Windows installer timer callback ve tam ön yüz kullanıcı UAT teslimi

22.08.2026 tarihinde `.46` NSIS derlemesinde callback adresi bağlanmadığı için oluşan warning 6010 sonucu tarihsel FAIL olarak korunmuştur. Callback, compiler-bound `${NSD_CreateTimer}` ve `${NSD_KillTimer}` makrolarına alınır. `.47` eski dahili `@pptdesktop-*.nsis.7z` payload nedeniyle, `.48` ilk 2FA sonrası güvenilir cihaz policy authority hatası nedeniyle, `.49` ise kayıtsız iç vault checkpoint kanalı canlı kasayı mühürlediği için reddedilmiş ve çıktıları silinmiştir. `.50`, yerel parola ve TOTP/kurtarma koduyla cihaz güvenini ana uygulamadan önce doğrular, ilk güven töreni boyunca checkpoint'i erteler ve iç checkpoint kanalını Client Data Access siciline bağlar. Paketli ve kurulu runtime, sentetik ön yüz aile/yönetici akışı, 22 uygulama yüzeyi, tam regresyon, SHA-256/imza, GitHub, haricî Git ve geri-okumalı haricî arşiv gerçek sonuçlarına göre kaydedilir. Gerçek kullanıcı verisi kullanılmaz. DEC-268, DEC-267 ve PR-233 kabul zincirini uygular.

## DEC-269 — Bronze, Silver ve Gold kurulum, veri ve kaynak yalıtımı

23.08.2026 tarihinde Bronze, Silver ve Gold kanallarının kurulum dizini, ana EXE, kısayol, appId, productName, kullanıcı veri kökü ve kaldırma kapsamı ayrılmıştır. Kaynak kod her kanal için C:\PPT\AYM\06_KOD\kanallar\<Kanal> altında ayrı Git worktree ve branch kullanır. Bir kanal diğer kanalın programını, verisini veya build çıktısını değiştiremez. DEC-262 ve PR-228'in ortak kimlik hükümleri superseded edilmiştir; dağıtım EXE adı ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe ve görünür ana ürün adı korunur. DEC-269 ve PR-234 bağlayıcıdır.

## DEC-270 — Her mutasyon sonrası exact commit kanıtı ve taze kurulu EXE UAT teslim kapısı

23.08.2026 tarihinde en küçük kaynak, yapılandırma veya belge mutasyonundan sonra değişen dosyaların kanonik kural, karar, aktif belge, manifest, ratchet, test ve UAT etkileriyle eşlenmesi kararlaştırılmıştır. Kalıcı completion ve Windows paketi yalnız temiz kanal worktree'sindeki aynı exact commit, kural hash'i ve governed-source fingerprint'ine bağlı hedefli test, tam regresyon ve kaynak bütünlüğü PASS kanıtlarıyla oluşturulur. Installer teslimi ancak paket üretiminden sonra aynı paket provenance SHA-256'sı ve kaynak commitine bağlı gerçek kurulu ana EXE UAT PASS ile yapılır; kaynak/win-unpacked veya stale UAT kabul edilmez. DEC-270 ve PR-235 bağlayıcıdır.

Uygulama bağı mutasyondan önce kaydedilen clean Bronze baseline receipt'i, immutable Git tree/fingerprint readback'i, gerçek Vitest komutunu çalıştıran hedefli ve filtresiz tam regresyon receipt üreticileri ile tracked dosya yazmayan read-only postflight olarak güçlendirilmiştir. Baseline commit sonradan CLI ile seçilemez.

## DEC-271 — Kardeş kanal program kökleri ve legacy kaldırma güvenliği

24.08.2026 tarihinde Bronze, Silver ve Gold program kökleri legacy `C:\Program Files\PPT\ParsYuva` dizininin dışındaki `C:\Program Files\PPT\ParsYuva-<Kanal>` kardeş dizinlerine taşınmıştır. AppData `ParsYuva/<Kanal>` olarak ayrı kalır; kanal appId, EXE, kısayol, productName, kaldırma kapsamı ve worktree/branch yalıtımı korunur. Interactive per-machine kaldırma signed-in kullanıcı AppData bağlamına geçer ve her çıkışta all-users bağlamını geri yükler. Legacy 37–44 kökünde Bronze, Silver veya Gold dizini varsa recursive silme veri ve programı koruyarak fail-closed durur. Otomatik legacy kullanıcı verisi migration veya silme yoktur. DEC-269/PR-234'ün exact nested-path hükmü superseded, DEC-271 ve PR-236 bağlayıcıdır.

## DEC-272 — Açık tek seferli sürüm tahsisi ve önceden tahsisli paket kimliği

24.08.2026 tarihinde resmî aylık sürüm tahsisi paketlemenin örtük yan etkisi olmaktan çıkarılmıştır. Mutasyon tahsisi zorunlu expected release ID ister; hesaplanan kimlik uyuşmazsa lock/temp/yazım/installer temizliği başlamaz. Preview salt okunur, signed/local/dir paket girişleri allocator çalıştırmaz ve aynı önceden tahsisli current kimliğini tüketir. Aktif sürüm taşıyıcıları tek atomik planda güncellenirken tarihsel UAT/evidence/fixture kayıtları korunur. Bağlayıcı kayıt DEC-272 ve PR-237'dir.

## DEC-273 — Kanonik Windows kurulu yükseltme, maintenance ve ön yüz UAT zinciri

24.08.2026 tarihinde Windows installer teslimi tek kanonik iki-makbuz zincirine bağlandı. UAT110 gerçek N→N+1 yükseltme ve ayrı same-version maintenance fazlarında sentetik marker ile metadata-only Bronze/Silver/Gold/legacy veri korumasını, diğer kanal sıfır yazımını, exact installed/package kimliğini ve sibling registry yolunu kanıtlar. Schema2 UAT111 aynı installation-preservation SHA, package provenance, expected release ID ve source commit bağını taşır. NotSigned yalnız local-test sınırıdır. Bağlayıcı kayıt DEC-273 ve PR-238'dir.

## DEC-274 — Adversarial Windows paket, kurulum ve final teslim kanıt zinciri

24.08.2026 tarihinde PR-238, PR-239 ile superseded edildi. Teslim; canlı PR-235 geri-okumalı schema2 package provenance, Bronze 50 için previous paket/runtime kabul etmeyen bootstrap fresh-install + maintenance veya Bronze 51+ için immutable parent package arşiviyle exact canlı sibling N'den N→N+1 + maintenance üreten UAT110 V3 modunu yeniden türetir. Zorunlu installer-experience V2, parent-run bağlı UAT111 V3 ve final V3 kanıtları source/producer/path/hash/kronoloji/screenshot/secret bağlarıyla doğrulanır. Sabit tıklama sayısı kabul değildir; dinamik outcome matrisi sıfır residual ile kapanır. Legacy nested runtime predecessor sayılmaz. NotSigned veya Kaspersky koruması kapalı test üretim uygunluğu değildir.

## DEC-275 — En küçük değişiklikte tüm kayıt ve test kapanışı

24.08.2026 tarihinde her küçük mutasyonun etkilenen ana/kanal kaynakları, kural ve karar sicilleri, aktif/ticari belgeler, iş listesi, kapsam-envanter-ratchet-manifest-indeks, güncel ana DOCX/PDF ve kanıt sözleşmelerini aynı zincirde kapatması bağlandı. Hedefli ve filtresiz tam regresyon, typecheck, sözdizimi, kaynak bütünlüğü ile UI etkisinde bütün etkileşim ve görsel UAT zorunludur. Gerçek hata `wip(rejected)` checkpoint olarak kaydedilir; tam kapanıştan önce ara installer üretilemez. Bağlayıcı kayıt DEC-275 ve PR-240'tır.
