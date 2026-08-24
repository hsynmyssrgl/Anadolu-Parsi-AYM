# Ana Build Defteri ve Kalan İşler

> **Tek yetkili devam noktası:** Yeni bir sohbet veya geliştirme oturumu bu dosyayı okuyarak başlar. Geçmiş buildleri yeniden araştırmak yerine `Güncel devam noktası` ve `Kalan işler` bölümleri esas alınır.

- Ürün: **ParsYuva Aile Yaşam Merkezi**
- Güncel build: **228**
- Güncel sürüm: **02.08.2026.228**
- Aşama: **Bronze RC2 Active Development**
- Tamamlanmış build kaydı: **228/228**
- Açık/in-progress iş: **19**
- Son güncelleme: **2026-08-02T20:02:11.708Z**

## BAĞLAYICI PROJE KURAL SETİ — HER SOHBET VE HER BUILD ÖNCESİ ZORUNLU OKUMA

> **Zorunlu başlangıç sözleşmesi:** Her yeni sohbet ve her build önce docs/17_MASTER_BUILD_LEDGER.md içindeki güncel Proje Anayasasını ve kural SHA-256 özetini okumalı; yalnız 20.07.2026 ve sonrası yetkili Anadolu Parsı Aile Yaşam Merkezi kaynaklarını kullanmalı ve kalıcı proje yolunu /Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi olarak kabul etmelidir.

- Güncel kural sürümü: **PROJECT-RULES-2026-08-02-V6**
- Kural SHA-256: **1387db550dd263e396404503b537808f21a37e446c3cbd8585361531bd983a15**
- Yürürlük başlangıcı: **Build 225**
- Kural değişikliği: Yeni build + açık kullanıcı kararı + yeni kural sürümü/hash olmadan yapılamaz.

### Kesin kurallar

PR-001. Tüm proje ailesinin üst markası Latince “Panthera pardus tulliana”dır. Uygulama adı üst markadan ayrıdır ve bu uygulamanın resmî adı “Anadolu Parsı Aile Yaşam Merkezi”dir; yeni uygulamalar “Anadolu Parsı” adına içeriklerini tanımlayan ek ad alır. Üst marka adı normal uygulama kullanıcı arayüzünde gösterilmez.
PR-002. Bu projenin tek geçerli kaynak başlangıcı 20 Temmuz 2026’dır. Bu tarihten önceki sohbet, dosya, karar, proje veya yatırım/otomatik alım-satım çalışması bu projeyle ilişkilendirilemez, bağlam kaynağı yapılamaz veya proje geçmişi olarak kullanıcıya sunulamaz.
PR-003. Sistemin kök iş varlığı Aile’dir; kişi, hesap, aile, aile dalı, hane ve üyelik ayrı kavramlardır.
PR-004. Kullanıcı kapsamı yalnız çekirdek aileyle sınırlı değildir; uygun rol, amaç ve süreyle yetkilendirilen diğer kişiler de sisteme dahil olabilir.
PR-005. Aktif ana ürün 16 modülden oluşur: Gösterge Paneli, Aile, Soy Ağacı, Zaman Tüneli, Önemli Günler, Arşiv, Finans, Sağlık, Yaşam Merkezi, Bildirim ve Otomasyon, Raporlama, Konum, Yetkiler, Yapay Zekâ, Dijital Miras ve Ayarlar.
PR-006. Her yetişkin kendi özel verisinin sahibidir.
PR-007. Aile yöneticisi olmak sağlık, finans, konum, özel belge veya kişisel zaman tüneli verilerine otomatik erişim sağlamaz.
PR-008. Yetkilendirme yalnız role göre yapılamaz; veri sahibi, nesne, işlem, aile dalı, amaç, süre ve açık izin/ret birlikte değerlendirilir.
PR-009. Açık ret, rol veya varsayılan iznin her zaman üzerindedir.
PR-010. Finans ve sağlık yüksek hassasiyetli veri alanlarıdır; kişisel varlık ve borçlar başka aile üyesine otomatik katılmaz, ortak varlık/borç sahiplik oranıyla ele alınır.
PR-011. Canlı konum yalnız açık rıza, amaç ve süreyle paylaşılır; görünür gösterge, otomatik sona erme ve audit kaydı zorunludur.
PR-012. Başlangıç mimarisi modüler monolittir ve gelecekte servis/platform ayrışmasına açık kalmalıdır.
PR-013. Temel bağımlılık yönü UI → Application → Domain → Infrastructure şeklindedir.
PR-014. Renderer ve Application katmanı doğrudan ham SQL veya native SQLite çalıştıramaz.
PR-015. Migration SQL sahipliği database katmanındadır.
PR-016. Somut repository implementasyonları merkezi composition root üzerinden oluşturulur.
PR-017. Ortak servislerin tek otoritesi Core Platform’dur; modüller içinde ikinci bağımsız ortak servis kopyaları oluşturulamaz.
PR-018. Sistem yerel öncelikli (local-first) çalışır.
PR-019. Birincil veri kullanıcının cihazındadır.
PR-020. Bulut hesabı temel kullanım için zorunlu değildir.
PR-021. Çevrimdışı kullanım temel davranıştır.
PR-022. Büyük dosyalar şifreli kasada, metadata ve ilişkiler SQLite’ta tutulur.
PR-023. Veri şeması sürümlüdür.
PR-024. Geri döndürülemez migration, gerçek veri silme veya veri mülkiyetini değiştiren işlem açık kullanıcı onayı olmadan yapılamaz.
PR-025. Önemli veri değişiklikleri aktör, zaman, eski/yeni değer ve gerekçeyle izlenebilir olmalıdır.
PR-026. Temel güvenlik ilkesi varsayılan reddetmedir; açık izin yoksa kritik işlem reddedilir.
PR-027. En az yetki ilkesi zorunludur.
PR-028. Windows Hello tercihli kimlik doğrulamadır; güçlü yerel parola yedek yöntemdir.
PR-029. TOTP, tek kullanımlık kurtarma kodları ve FIDO2/WebAuthn desteklenir.
PR-030. Varsayılan boşta kalma oturum süresi 15 dakikadır.
PR-031. Beş başarısız giriş 15 dakikalık kilit oluşturur.
PR-032. Giriş, kilit, parola ve cihaz işlemleri audit edilir.
PR-033. Yeni cihaz eski cihaz güvenini otomatik devralamaz.
PR-034. Yedekten geri yükleme yeni cihaza otomatik yetki vermez.
PR-035. Taşınabilir kullanıcı verisi ile cihaza bağlı güvenlik sırları ayrıdır.
PR-036. Güvenlik kontrolü sessizce kaldırılamaz veya zayıflatılamaz; karar kaydı, risk/etki analizi ve ürün sahibi onayı gerekir.
PR-037. Electron renderer nodeIntegration:false, contextIsolation:true ve sandbox:true ile çalışır.
PR-038. IPC yalnız kayıtlı ana renderer, ana frame ve güvenilir belgeden kabul edilir.
PR-039. IPC payload’ları merkezi boyut, derinlik ve güvenlik kontrolünden geçer.
PR-040. Webview, izinsiz navigation, redirect, download ve permission talepleri varsayılan reddedilir.
PR-041. AI sağlayıcısı varsayılan kapalıdır.
PR-042. AI yalnız kullanıcının hem veri erişimine hem AI işlemesine izin verdiği kayıtları kullanabilir.
PR-043. Sağlık, finans, çocuk ve canlı konum AI açısından yüksek hassasiyetlidir.
PR-044. AI önerileri insan onayı olmadan kesin veya otoritatif kayıt oluşturamaz.
PR-045. Kullanıcı AI hafızasını görebilmeli, düzeltebilmeli, sınırlandırabilmeli ve silebilmelidir.
PR-046. Yedek hedefleri yerel disk, harici disk ve bulut sağlayıcı adaptörü olarak birbirinden bağımsız çalışır.
PR-047. Bir yedek hedefinin arızası diğer hedefleri durduramaz.
PR-048. Her yedek hedefi için bağlantı, boş alan, son başarı, doğrulama, boyut, hash, hız ve hata ayrı izlenir.
PR-049. Her zaman en az bir tam ve doğrulanmış yedek korunmalıdır.
PR-050. OneDrive ilk öncelikli bulut hedefidir; mimari iCloud, Google Drive ve diğer sağlayıcılara adapter ile açık kalır.
PR-051. Yedek şifreli ve doğrulanmış olmak zorundadır.
PR-052. Restore öncesi bütünlük kontrolü yapılır.
PR-053. Bozuk veri izole edilir ve rollback imkânı bulunur.
PR-054. Yeni cihaz restore işleminden sonra yeniden kimlik ve cihaz yetkilendirmesi gerekir.
PR-055. İlk içe alınan dosya sürümü değişmez dijital kanıt olarak korunur.
PR-056. Arşivleme silme değildir; arşivlenen kayıt aktif görünümden çıkar fakat veri korunur.
PR-057. Kalıcı imha işlemleri güçlü doğrulama ve kayıt gerektirir.
PR-058. SSD/TRIM/wear-leveling gibi teknik sınırlar nedeniyle doğrulanamayan fiziksel silme için mutlak imha iddiası yapılamaz.
PR-059. Dijital miras işlemleri geri döndürülebilir tasarlanır.
PR-060. Vefat sonrası kritik erişim/içerik işlemleri en az iki yönetici onayı, bekleme süresi, audit ve iptal/geri alma mekanizması gerektirir.
PR-061. İlk gerçek geliştirme ve kullanım platformu Windows masaüstüdür.
PR-062. Mimari macOS, iPhone, iPad, Apple Watch ve Apple Vision Pro’ya genişlemeye uygun tutulur.
PR-063. Apple/mobil istemciler ilk aşamada Windows çekirdeğinden veri alan companion istemcilerdir.
PR-064. Mobil istemci bağımsız ana veri kaynağı veya bağımsız işlem motoru değildir.
PR-065. Arayüz Apple tasarım ilkelerinden esinlenir ancak özgün Anadolu Parsı marka kimliği kullanır.
PR-066. Apple font dosyaları uygulamaya gömülmez; yerel sistem fontu ve güvenli fallback zinciri kullanılır.
PR-067. Klavye kullanımı desteklenmek zorundadır.
PR-068. Ekran okuyucu etiketleri zorunludur.
PR-069. Ölçeklenebilir metin, yüksek kontrast, görünür odak ve renk dışı durum anlatımı zorunludur.
PR-070. Hata mesajı sorunu ve kullanıcının yapması gereken eylemi birlikte açıklamalıdır.
PR-071. Temel etkileşim hedefi en az 44 px olmalıdır.
PR-072. Geri döndürülebilir teknik iyileştirmeler için her seferinde ayrıca kullanıcı onayı gerekmez.
PR-073. Kapsam değişikliği ayrıca açık kullanıcı onayı gerektirir.
PR-074. Geri döndürülemez işlem ayrıca açık kullanıcı onayı gerektirir.
PR-075. Gerçek veri silme ayrıca açık kullanıcı onayı gerektirir.
PR-076. Veri mülkiyetini etkileyen değişiklik ayrıca açık kullanıcı onayı gerektirir.
PR-077. Hukuki veya finansal taahhüt ayrıca açık kullanıcı onayı gerektirir.
PR-078. Güvenlik kontrolünü zayıflatma ayrıca açık kullanıcı onayı gerektirir.
PR-079. Üretim yayını ayrıca açık kullanıcı onayı gerektirir.
PR-080. Bronze aktif geliştirme kanalıdır.
PR-081. Silver test, kullanıcı kabulü ve geniş doğrulama kanalıdır.
PR-082. Gold gerçek üretim ve gerçek kullanım kanalıdır.
PR-083. Hiçbir yayın aşamasına otomatik terfi yapılmaz.
PR-084. Güncel aşama kullanıcı tarafından değiştirilmedikçe Bronze RC2 Active Development olarak kabul edilir.
PR-085. Bronze Final, Code Freeze, Silver veya Gold kendiliğinden ilan edilemez.
PR-086. Çalıştırılmamış hiçbir test veya doğrulama PASS sayılamaz.
PR-087. Çalıştırılmayan compile, type-check, test, build, smoke, Windows launch, installer, screenshot veya UAT kapısı NOT_RUN kalır.
PR-088. Tanı amaçlı --no-sandbox çalıştırması resmî PASS değildir; yalnız DIAGNOSTIC_PASS olarak ayrılır.
PR-089. Ara Bronze buildlerinde hedefli regresyon, mimari ve güvenlik kontrolleri uygulanabilir; tam UAT ve toplu ekran görüntüleri final hazırlığına bırakılabilir.
PR-090. Final hazırlığında doğrulama sırası: temiz npm ci, tam tsc --noEmit, tüm testler, Electron production build, blocking smoke, sandbox’lı gerçek Windows açılışı, kurulum/açılış/kaldırma, installer doğrulaması, ekran görüntüleri ve kullanıcı dokümantasyonudur.
PR-091. Zorunlu doğrulama kapıları geçmeden Final, Silver veya Gold kararı verilmez.
PR-092. Her kaynak teslimi manifest ile doğrulanır.
PR-093. Her kaynak tesliminde SHA256SUMS.txt bulunur.
PR-094. Kaynak ZIP deterministik olmalıdır.
PR-095. Kaynak ZIP’in ayrı dış SHA-256 kanıtı bulunmalıdır.
PR-096. Aynı kaynak ağacından iki kez üretilen arşiv byte düzeyinde aynı olmalıdır.
PR-097. Kod ile bağlayıcı belge çelişemez.
PR-098. Mimari, veri şeması, güvenlik, UI/UX, platform, kapsam veya sürüm değişikliği ilgili belgelere işlenir.
PR-099. Her yeni bağlayıcı karar benzersiz DEC-xxx kimliğiyle izlenir.
PR-100. Karar kaydında tarih, etkilenen belgeler, kod karşılığı ve doğrulama kanıtı bulunur.
PR-101. Gerekli belge güncellenmeden ilgili kapsam tamamlandı sayılamaz.
PR-102. Tarihsel belgeler silinmez ancak güncel aktif belgelerin önüne geçemez.
PR-103. Ana Build Defteri projenin tek yetkili devam noktasıdır; yeni sohbet veya geliştirme oturumu önce bu dosyayı ve güncel kural setini okumalıdır.
PR-104. Her build Ana Build Defteri’ne işlenmeden, kural seti SHA-256 özetiyle kabul edilmeden ve build sonrası kullanıcı durum bildirimi kaydedilmeden tamamlanmış sayılamaz.
PR-105. Geçmiş build kayıtları geriye dönük değiştirilmez; düzeltme yeni build kaydıyla açıklanır ve yapılan/kalan işler tek Ana Build Defteri üzerinden yürütülür.
PR-106. Her build tamamlandıktan sonra sohbet bağlamının tahmini kullanılan ve kalan yüzdesi hesaplanır, Ana Build Defteri build kaydına yazılır ve build sonu kullanıcı durum bildiriminde açıkça belirtilir.
PR-107. Sohbet bağlamı için yüzde 85-89 tahmini kullanım uyarı bölgesidir; kullanıcıya yaklaşan sohbet devri bildirilir ve uzun yeni işlerin aynı sohbette başlatılmasından kaçınılır.
PR-108. Sohbet bağlamının tahmini kullanımı yüzde 90 veya üzerindeyse yeni build başlatılamaz; mevcut tamamlanmış build devir noktası olarak korunur ve build başlangıç kapısı işlemi reddeder.
PR-109. Yüzde 90 veya üzeri tahmini sohbet kullanımında yeni sohbet için kopyalanabilir devir promptu zorunlu olarak üretilir; prompt son build/sürüm/durum, güncel kural sürümü ve SHA-256, sıradaki açık iş, kalan işler, yetkili Ana Build Defteri ve kaynak paket konumunu içermelidir.
PR-110. Yeni sohbet, üretilmiş devir promptu ve Ana Build Defteri üzerinden devam eder; kullanıcıdan proje kurallarını veya nerede kalındığını yeniden öğretmesi istenmez.
PR-111. Yüzde 90 sohbet devri eşiği istisnasızdır; eşik aşıldığında teknik kolaylık, aciliyet veya küçük değişiklik gerekçesiyle aynı sohbette yeni build başlatma yolu açılamaz.
PR-112. 20 Temmuz 2026 öncesi bütün sohbet, belge, dosya, karar ve bağlam bu proje için FORBIDDEN_SOURCE kabul edilir; aynı bilgi ancak 20 Temmuz 2026 veya sonrasında açıkça yeniden kabul edilmiş bir kaynakta yer alıyorsa kullanılabilir.
PR-113. Eski sohbetler veya eski projeler silinemese dahi bu projeyle ilişkilendirilemez, bunlardan bilgi aktarılmaz, proje yanıtlarında gösterilmez ve yeni build planı türetilmez.
PR-114. Kullanıcı yeni bir öneri ilettiğinde öneri uygulanmadan önce kapsam, mimari, güvenlik, gizlilik, veri bütünlüğü, performans, UI/UX, erişilebilirlik, yedekleme, migration, rollback, test, platform, belge, süre ve teknik borç etkileri kapsamlı analiz edilir; optimize edilmiş öneri kullanıcıya sunulur ve kesin karar bu analiz üzerinden alınır.
PR-115. Her build sonunda tahmini kodlama tamamlanma yüzdesi, kalan kodlama yüzdesi, 20.07.2026 başlangıcından geçen süre, yakın dönem geliştirme hızı, tahmini Bronze Final/Silver/Gold veya genel bitiş tarihleri ve tahmin güven düzeyi hesaplanır; build sonu zorunlu bildirime ve Ana Build Defteri kaydına eklenir.
PR-116. Marka mimarisi zorunludur: üst marka “Panthera pardus tulliana”, kullanıcıya görünen uygulama adı “Anadolu Parsı Aile Yaşam Merkezi”dir; Latin üst marka adı normal uygulama ekranlarında kullanılmaz ve yeni uygulama adları “Anadolu Parsı + işlevsel ad” kuralını izler.
PR-117. Her buildde tüm aktif sürüm taşıyan kaynak, paket, APP_META, config, manifest, installer metadata, aktif belge ve teslim yüzeyi aynı build sürümüne yükseltilir; aktif alanda eski sürüm driftine veya build atlamasına izin verilmez. Tarihsel kanıt dosyaları kendi özgün build numarasını korur ve aktif dosyalardan açıkça ayrılır.
PR-118. 20 Temmuz 2026 öncesinde geliştirilmiş yatırım/otomatik işlem projesi, broker, Matriks, İş Yatırım, Deniz Yatırım, piyasa verisi veya otomatik emir kararları bu projede bağlam, tasarım veya gereksinim kaynağı olarak kullanılamaz.
PR-119. API geliştirme önceliği yaşamsal ihtiyaca göre P0/P1/P2 olarak sınıflandırılır: yedekleme, yapay zekâ ve sistemin zorunlu çalışması için gerekli API/adapter sınırları P0’dır; çekirdek işlevi tamamlayanlar P1’dir; banka ve diğer kurum entegrasyonları P2’dir ve proje kararlı üretime girdikten yaklaşık 5-6 ay sonra değerlendirilir.
PR-120. UI Görsel Referans Manifestosu ve 20 Temmuz 2026 sonrası onaylanmış görseller bağlayıcı görsel baseline’dır. Silver’a geçmeden önce gerçek ekranlar bu baseline ile doğrulanır; renk, tipografi, hiyerarşi, navigasyon, bileşen ve erişilebilirlik sözleşmeleri karşılanmadan Silver başlatılamaz.
PR-121. Bronze Final’e kadar kullanıcıya sunulan bütün menü, düğme, form, bağlantı ve akış işlevsel olmalıdır. İşlevsiz placeholder UI, boş handler, erişilemeyen özellik veya kullanıcı yüzeyinde atıl işlev bulunamaz. Kararı iptal edilmiş üretim kodu ve UI kaldırılır.
PR-122. Üretim uygulaması nötr ve boş başlangıçla açılır; production seed/demo aile, kişi, soy ağacı, finans, sağlık, belge, konum veya olay verisi içeremez. Test fixture’ları yalnız test alanında anonim/nötr olabilir ve üretim paketine giremez.
PR-123. Her build sonunda bu projeye ait güncel bilgi, belge, kaynak, kural, karar, test, kanıt, görsel ve teslim dosyalarının tamamını indeksleyen PROJECT_ARTIFACT_INDEX.md ve PROJECT_ARTIFACT_INDEX.json üretilir; kullanıcıya ana teslim bağlantıları ve Artifact Index bağlantısı paylaşılır.
PR-124. Alınan her karar aynı build içinde güncel kural setine, Ana Karar Kaydı’na, etkilenen aktif mimari/güvenlik/UI/kapsam/test belgelerine, makine okunur politikalara, kod karşılığına ve Ana Build Defteri’ne yansıtılır; kod ve belge arasında bilinen drift ile build tamamlanamaz.
PR-125. Her build sonunda güncel Master Proje Dokümantasyonu hem DOCX hem PDF olarak üretilir ve doğrulanır; etkilenmiş aktif belgeler güncellenmeden ve güncel Word/PDF paketi oluşmadan build COMPLETED olamaz.
PR-126. Üretim uygulamasında, aktif kaynakta, aktif belgelerde, görsellerde ve teslim paketlerinde gerçek kişi adı, soyadı, aile adı, kişisel kimlik izi veya özel aile temsili bulunamaz; geçmiş demo aile/kişi kimlikleri de kaynakta tutulamaz. Kullanıcı tarafından sonradan girilen gerçek veriler bu kaynak yasağının dışındadır.
PR-127. Geliştirici/üretici/owner/author/copyright metadata dahil aktif proje metadata’sında doğal kişi kimliği kullanılmaz; gerekli sahiplik ve üretici ifadeleri yalnız marka kimliği “Panthera pardus tulliana” ve ürün kimliği üzerinden tutulur.
PR-128. Bağlayıcı UI baseline gerçek kaynak sözleşmeleriyle tutarlı olmalıdır: Apple uyumlu sistem font zinciri kullanılır, proprietary SF font dosyası gömülmez; aktif kanal menü rengi Bronze için bakır/bronz, Silver için gümüş, Gold için altın tokenlarından gelir ve renk tek başına anlam taşımaz.
PR-129. UI Görsel Referans Manifestosu kişisel/demo içerikten arındırılmış marka ve boş durum referansıdır; örnek kişi, aile, dosya, sağlık, finans veya özel yaşam verisi görsel baseline’a konulamaz.
PR-130. Aktif dosyalar ile tarihsel kanıt dosyaları açıkça sınıflandırılır. Aktif dosyalar güncel build sürümünde olmak zorundadır; tarihsel kanıtlar özgün sürümünü korur ve aktif ürün davranışını belirleyemez.
PR-131. Her buildde VERSION_SWEEP_GATE çalıştırılır; aktif sürüm taşıyan dosyalarda eski build/sürüm bulunursa build kapanışı reddedilir.
PR-132. Her buildde PERSONAL_IDENTITY_SWEEP_GATE çalıştırılır; aktif kaynak, üretim bundle girdileri, aktif belge ve görsel metadata’sında yasak kişisel kimlik bulunursa build kapanışı reddedilir.
PR-133. Her buildde PRODUCTION_CLEAN_DATA_GATE çalıştırılır; üretim başlangıç seed’i, demo kullanıcı/aile/kişisel kayıt ve production fixture sayısı sıfır olmadan build kapanışı reddedilir.
PR-134. Bronze Final öncesi DEAD_CODE_DEAD_UI_GATE çalıştırılır; kullanıcıya görünen işlevsiz UI ve açıkça iptal edilmiş/erişilemeyen üretim kodu sıfır hedefidir ve tespit edilen kalıntı Final’den önce kaldırılır.
PR-135. DOCUMENTATION_CLOSURE_GATE her buildde zorunludur; kararların etkilediği aktif belgeler, Master DOCX/PDF, Ana Build Defteri ve Artifact Index güncel değilse build kapanışı reddedilir.
PR-136. ARTIFACT_INDEX_GATE her buildde zorunludur; güncel buildin bütün ana teslimleri ve proje bilgi/belge bağlantıları tek indeks üzerinden izlenebilir olmadan teslim tamamlanmış sayılamaz.
PR-137. PROJECT_PROGRESS_MODEL ölçülebilir ve açıklanabilir olmalıdır; kodlama yüzdesi yalnız build sayısından türetilmez, tamamlanan/açık kod işlerinin ağırlıkları ve geliştirme hızıyla hesaplanır; tahminler kesin tarih değil güven düzeyi belirtilmiş yönetim tahminidir.
PR-138. PROJECT_PROVENANCE_GATE her sohbet ve build başında zorunludur; 20.07.2026 öncesi kaynağa dayanma girişimi fail-closed reddedilir ve yeni sohbet yalnız Ana Build Defteri ile 20 Temmuz sonrası yetkili kaynaklardan devam eder.
PR-139. API_PRIORITY_GATE çekirdek projeyi banka/kurum entegrasyonları nedeniyle geciktiremez; P0 yaşamsal adapter/altyapı işleri önce tamamlanır, P2 kurum entegrasyonları kararlı üretim sonrası döneme ertelenir.
PR-140. Bu proje kural seti Proje Anayasasıdır. Güncel anayasa kuralları istisnasız bağlayıcıdır; teknik kolaylık, hız, geçmiş uygulama, eski belge veya sohbet gerekçesiyle aşılamaz, sessizce esnetilemez veya atlanamaz. Değişiklik yalnız açık kullanıcı kararı, yeni build, yeni kural sürümü ve yeni SHA-256 ile yapılabilir.
PR-141. Windows ilk kurulumunda normal uygulama ekranından önce Anadolu Parsı marka kimliğine uygun tek seferlik tanıtım ve ilk kullanım sihirbazı çalışır; kullanıcı isterse tanıtımı daha sonra Ayarlar üzerinden yeniden açabilir.
PR-142. İlk kullanım tanıtımı sesli Türkçe anlatım, görünür altyazı, sesi kapatma, anlatımı yeniden oynatma ve tanıtımı geçme seçeneklerini işlevsel olarak sunar; erişilebilirlik kullanıcı kontrolündedir.
PR-143. Marka anlatım sesi sakin, güven veren ve Anadolu Parsı kimliğine uygun olmalı; kesintisiz veya zorlayıcı ses kullanılmaz, kullanıcı sesleri tamamen kapatabilir.
PR-144. İlk kurulum tamamlandığında kısa ve rahatsız etmeyen Anadolu Parsı marka sesi ile onaylı geçiş animasyonu çalışır; sonraki açılışlarda bu efekt zorunlu değildir.
PR-145. İlk kurulum akışı kesintiye dayanıklıdır; tanıtım, kimlik oluşturma, güvenlik, kurtarma ve tamamlama adımları açık durum modeliyle yönetilir ve yarım kurulum normal uygulamaya geçemez.
PR-146. İlk kullanıcı yerel güçlü parola ile oluşturulabilir; parola koşulları ve eşleşme durumu yazım sırasında canlı ve erişilebilir biçimde gösterilir.
PR-147. Apple, Google ve Microsoft haricî kimlik sağlayıcıları aynı sağlayıcı-bağımsız OIDC katmanında tasarlanır; hiçbir sağlayıcı uygulama içi yetkilendirme veya aile verisine otomatik erişim vermez.
PR-148. Haricî OIDC akışları Authorization Code, PKCE, state ve nonce kontrolleri olmadan üretime açılamaz; tokenlar düz metin dosyada tutulamaz.
PR-149. Apple, Google veya Microsoft ile kimlik oluşturulsa bile çevrimdışı yerel erişim ve hesap kurtarma için Windows Hello, yerel parola veya eşdeğer cihaz-bağlı güvenli yöntem zorunlu olarak korunur.
PR-150. Yapılandırılmamış veya üretim kabulü tamamlanmamış haricî kimlik sağlayıcısı işlevsiz aktif düğme olarak gösterilemez; özellik fail-closed ve görünmez/kapalı kalır.
PR-151. İlk oluşturulan kullanıcı aile yöneticisi olabilir ancak bu rol diğer yetişkinlerin özel sağlık, finans, belge veya konum verilerine otomatik erişim hakkı vermez.
PR-152. İlk kurulumun güvenlik adımında Windows Hello uygun olduğunda önerilir; TOTP, tek kullanımlık kurtarma kodları ve FIDO2/WebAuthn destekleri mevcut anayasal güvenlik sınırlarıyla korunur.
PR-153. Kurtarma yöntemi oluşturulmadan ilk kimlik kurulumu güvenlik açısından tamamlanmış sayılmaz; kurtarma materyali kullanıcıya kontrollü biçimde sunulur ve production loglarına yazılmaz.
PR-154. Uygulama açılışında kullanıcı kimliği doğrulanmadan aile veritabanı, arşiv içerikleri, sağlık, finans, soy ağacı, zaman tüneli veya diğer kişisel veri depoları açılamaz ve okunamaz.
PR-155. Kalıcı kullanıcı verisi diskte AES-256-GCM veya eşdeğer güçlü doğrulanmış şifreleme altında tutulur; düz SQLite ana veritabanı uygulama kapalıyken kalıcı dosya olarak bırakılamaz.
PR-156. Kullanıcı veri anahtarının açılması hem kullanıcı sırrına/parolasına hem Windows safeStorage/DPAPI cihaz korumasına bağlanır; yalnız cihaz bağı veya yalnız parola tek başına kalıcı veri kasasını açmaya yetmez.
PR-157. Kasa başlığı kişisel veri içeremez; yalnız KDF parametreleri, rastgele tuzlar, anonim anahtar yuvası kimlikleri ve cihaz-korumalı şifreli anahtar zarfları gibi zorunlu kriptografik metadata tutulabilir.
PR-158. Başarısız parola veya kimlik doğrulama denemesinde şifresi çözülmüş kullanıcı verisi oturumu kalıcılaştırılamaz; geçici çalışma alanı derhal kapatılır ve silinir.
PR-159. Başarılı oturum kapatma, oturum zaman aşımı veya uygulama kapanışında veri deposu önce güvenli biçimde kapatılır, WAL checkpoint uygulanır, kalıcı kasa yeniden şifrelenir ve geçici düz çalışma dosyaları silinir.
PR-160. Geçici oturum verisi yalnız kimliği doğrulanmış aktif uygulama oturumu süresince oluşturulabilir; işletim sistemi izinleri mümkün olan en dar kullanıcı erişimiyle ayarlanır ve yol rastgele oturum kimliği taşır.
PR-161. Aynı Windows kullanıcı hesabı altında çalışan yönetici yetkili zararlı yazılıma karşı mutlak dosya erişim engeli iddia edilemez; Bronze Final öncesi sayfa-seviyesi/in-use şifreleme veya eşdeğer koruma değerlendirilip kanıtlanmalıdır.
PR-162. Arşiv belgesi şifresi çözülmüş geçici dosya olarak haricî uygulamaya shell/openPath ile verilemez; desteklenen türler yalnız uygulamanın güvenli önizleme yüzeyinde gösterilir ve geçici materyal mümkün olan en kısa sürede silinir.
PR-163. Desteklenmeyen belge türü güvenlik sınırını aşmak yerine fail-closed reddedilir; haricî uygulama açma ancak gelecekte açık kullanıcı kararı ve ayrı güvenlik tasarımıyla eklenebilir.
PR-164. Log, cache, diagnostic, export, migration backup, crash/evidence ve diğer yan artifactlar kişisel veya hassas içerik taşımayacak şekilde sanitize edilmeli veya şifrelenmelidir; bu kapanış Bronze Final kapısıdır.
PR-165. Uygulama öncesi oluşturulan runtime/log dosyaları yalnız kişisel olmayan operasyon metadata içerir; kimlik doğrulama öncesi hiçbir kişisel veri log, cache veya diagnostic alana yazılamaz.
PR-166. Parola değiştirildiğinde kullanıcı veri kasasının anahtar sarma bilgisi de atomik olarak yeni parolaya geçirilir; eski parola kasayı açmaya devam edemez.
PR-167. Haricî kimlik sağlayıcıları için gerçek üretim PASS iddiası sağlayıcı uygulama kaydı, Client ID/redirect URI, gerçek Windows oturumu, token kasası, iptal/çıkış ve hata senaryoları doğrulanmadan yapılamaz; aksi durum NOT_RUN/PENDING olarak raporlanır.
PR-168. Kalıcı proje kütüphanesi hiyerarşisi /Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi şeklindedir; bu uygulamaya ait yeni build, kaynak, belge, görsel, hash ve teslim kanıtları yalnız bu dal altında tutulur.
PR-169. Üst marka altındaki başka/eski proje dosyaları yalnız ad benzerliği nedeniyle Anadolu Parsı Aile Yaşam Merkezi klasörüne taşınamaz veya bağlam kaynağı sayılamaz; proje provenance sınırı fail-closed uygulanır.
PR-170. Build209 ve sonrasında onboarding, kimlik, veri kasası ve dosya erişimi güvenlik kapıları Anayasanın ayrılmaz parçasıdır; bu maddeler de diğer anayasa kuralları gibi yalnız açık kullanıcı kararı, yeni build, yeni sürüm ve yeni SHA-256 ile değiştirilebilir.
PR-171. Uzun veya zaman aşımı riski taşıyan geliştirme, doğrulama, belge üretimi, paketleme ve teslim işleri mümkün olan en küçük mantıksal ve bağımsız adımlara bölünmelidir. Her adım: 1. uygulanır, 2. doğrulanır, 3. sonucu kalıcı olarak kaydedilir, 4. kısa durum verilir, 5. ancak bundan sonra sonraki adıma geçilir. Tek seferde dev işlem zincirleri çalıştırma. Yalnız teknik olarak atomik olması zorunlu işlemler istisnadır. Bu kural anayasal ve aşılamazdır.
PR-172. PR-172 yalnız platform tarafından sağlanan gerçek sohbet bağlam kapasitesi yüzde 90 veya üzerindeyken HARD_STOP üretir. Tahmin, geçmiş build tahmini veya kullanılamayan platform sayacı HARD_STOP ya da zorunlu handoff sayılmaz. Gerçek kullanım yüzde 90 altındaysa zorunlu devir üretilmez. Gerçek HARD_STOP durumunda aynı sohbette yeni build başlatılmaz; aynı yanıt içinde tam kopyalanabilir devir metni gösterilir ve NEW_CHAT_HANDOFF_BUILDxxx.md oluşturulur.

## Kesin süreklilik kuralı

1. Her yeni build başlatıldığında bu deftere yeni build satırı açılır ve durum `IN_PROGRESS` yapılır.
2. Build tamamlanmadan önce yapılan iş, sürüm, kanıt dosyaları ve kalan iş durumu bu deftere yazılır.
3. Build sonrası kullanıcıya durum bilgilendirmesi yapılır; aynı bildirim `lastStatusNotification` alanına kaydedilir.
4. Güncel build `COMPLETED` değilse, ana defter güncel değilse veya durum bildirimi yoksa kaynak teslimi tamamlanmış sayılamaz.
5. Geçmiş build kayıtları değiştirilmez; düzeltme gerekiyorsa yeni build kaydıyla açıklanır.

## Güncel devam noktası

- **Sıradaki iş:** OPEN-002 — Temiz ve tekrarlanabilir bağımlılık kurulumu
- **Kanal:** Silver validation
- **Açıklama:** Resmî lockfile ile temiz npm ci kapısını gerçek erişilebilir ortamda PASS tamamla. Build211: bu yürütme ortamında resmî registry ve kabul edilmiş offline cache erişilemedi; 117 tarball acquisition planı ve doğrulanmış bağlı-makine handoff isteği hazırlandı. OPEN-002 yalnız gerçek npm ci PASS ile kapanır.

## Kalan işler — tek liste

- [x] **OPEN-001 — Terminal temiz-yedek çalışma defteri değişmezliği** · Bronze · Planlanan Build 210 · Durum: `COMPLETED`
  - Terminal clean-backup run ledger satırlarının UPDATE, DELETE ve INSERT OR REPLACE ile değiştirilmesini engelle; normal running→terminal geçişi ile no-op güncellemeleri koru.
- [ ] **OPEN-021 — Aktif oturumda sayfa-seviyesi kullanıcı verisi koruması** · Bronze · Planlanan Build 213 · Durum: `CLOSED`
  - Build228 resmî governance kapanışı: exact Build227 source snapshotına bağlı gerçek Windows evidence içinde development ve installed EFS probe PASS, independent verifier PASS ve NOT_RUN=0 doğrulandı. Yeni güvenlik özelliği eklenmedi.
- [ ] **OPEN-022 — Hassas yan-artifact şifreleme ve sanitizasyon kapanışı** · Bronze · Planlanan Build 214 · Durum: `CLOSED`
  - Build228 resmî governance kapanışı: exact Build227 source snapshotına bağlı gerçek Windows evidence içinde development ve installed CurrentUser DPAPI/protected-side-artifact probe PASS, independent verifier PASS ve NOT_RUN=0 doğrulandı. Yeni güvenlik özelliği eklenmedi.
- [ ] **OPEN-002 — Temiz ve tekrarlanabilir bağımlılık kurulumu** · Silver validation · Durum: `OPEN`
  - Resmî lockfile ile temiz npm ci kapısını gerçek erişilebilir ortamda PASS tamamla. Build211: bu yürütme ortamında resmî registry ve kabul edilmiş offline cache erişilemedi; 117 tarball acquisition planı ve doğrulanmış bağlı-makine handoff isteği hazırlandı. OPEN-002 yalnız gerçek npm ci PASS ile kapanır.
- [ ] **OPEN-003 — Tam TypeScript doğrulaması** · Silver validation · Durum: `OPEN`
  - Root ve bütün workspace için gerçek tsc --noEmit kapısını çalıştır ve PASS kanıtı üret.
- [ ] **OPEN-004 — Tam birim ve entegrasyon test zinciri** · Silver validation · Durum: `OPEN`
  - Final kaynak üzerinde bütün birim, repository, SQLite, IPC, güvenlik ve entegrasyon testlerini çalıştır.
- [ ] **OPEN-005 — Electron production build** · Silver validation · Durum: `OPEN`
  - Main, preload, renderer ve native bağımlılıklarla gerçek üretim paketini oluştur ve doğrula.
- [ ] **OPEN-006 — Blocking smoke zinciri** · Silver validation · Durum: `OPEN`
  - Açılış, oturum, veritabanı, migration, ana modüller, yedekleme, kapanış ve yeniden açılış senaryolarını çalıştır.
- [ ] **OPEN-007 — Gerçek Windows açılış ve güvenlik migration testleri** · Silver validation · Durum: `OPEN`
  - Development ve paketli açılış; DPAPI sentinel, cihaz kimliği, TOTP ve açık kasa anahtarı legacy migration kanıtlarını gerçek Windows ortamında tamamla.
- [ ] **OPEN-008 — Windows installer yaşam döngüsü** · Silver validation · Durum: `OPEN`
  - Temiz kurulum, yükseltme, onarma, kurulu açılış, kaldırma ve rollback testlerini gerçek Windows üzerinde tamamla.
- [ ] **OPEN-009 — Farklı cihaz yedek geri yükleme ve anahtar yeniden sarma** · Silver validation · Durum: `OPEN`
  - Parola korumalı tam yedeği başka Windows cihazında geri yükle; kasa anahtarını hedef cihaz korumasıyla güvenli biçimde yeniden sar.
- [ ] **OPEN-010 — Felaket kurtarma ve dayanıklılık provası** · Silver validation · Durum: `OPEN`
  - Gerçek dosya sistemi, zorunlu yeniden başlatma, süreç sonlandırma, elektrik kesintisi, disk dolması ve bağlantısı kesilen harici disk senaryolarını doğrula.
- [ ] **OPEN-011 — Erişilebilirlik ve kullanıcı kabul testleri** · Silver validation · Durum: `OPEN`
  - Ekran okuyucu, klavye, kontrast, %100/%125/%150 DPI, büyütülmüş metin ve kritik kullanıcı akışları UAT kanıtlarını tamamla.
- [ ] **OPEN-012 — Performans ve uzun süreli kararlılık** · Silver validation · Durum: `OPEN`
  - Büyük soy ağacı, arşiv ve zaman tüneli; bellek sızıntısı, uzun süreli çalışma ve büyük veri performans testlerini tamamla.
- [ ] **OPEN-013 — Saklama ve imha hukuk/gizlilik incelemesi** · Legal/privacy · Durum: `OPEN`
  - Türkiye ve hedef kullanım ülkeleri için veri, yedek ve karantina saklama/imha sürelerini yetkili hukuk ve gizlilik incelemesiyle kesinleştir.
- [ ] **OPEN-014 — NTFS, SSD ve adli kalıntı sınırlarının doğrulanması** · Security/forensics · Durum: `OPEN`
  - Dosya kilidi, snapshot, TRIM, wear levelling ve fiziksel/adli kalıntı sınırlarını bağımsız olarak doğrula; mutlak imha iddiasından kaçın.
- [ ] **OPEN-015 — Gerçek aile verisi aktarım planı** · Data readiness · Durum: `OPEN`
  - Gerçek aile verisi için içe aktarma, doğrulama, hata izolasyonu ve kontrollü rollback planını uygulama öncesi tamamla.
- [ ] **OPEN-016 — AI sağlayıcısı, maliyet ve mahremiyet sınırı** · AI governance · Durum: `OPEN`
  - Sağlayıcı seçimi, veri işleme sınırı, açık rıza, maliyet kotası, loglama ve çevrimdışı fallback kararlarını kesinleştir.
- [ ] **OPEN-017 — Bulut ve haricî sağlayıcı üretim adaptörleri** · External integration · Durum: `OPEN`
  - OneDrive üretim bağlantısı; ardından iCloud/Google Drive, harita/konum, sağlık, sigorta ve resmî kurum adaptörlerini sağlayıcı onayı ve güvenlik sınırlarıyla tamamla.
- [ ] **OPEN-018 — Haricî OIDC kimlik sağlayıcıları** · Identity integration · Durum: `OPEN`
  - Apple, Google ve Microsoft OIDC sağlayıcılarını yerel yetkilendirmeden ayrık; Authorization Code + PKCE + state/nonce, güvenli token kasası, logout/revoke ve gerçek Windows sağlayıcı testleriyle tamamla.
- [ ] **OPEN-019 — Apple ekosistemi istemcileri** · Future platforms · Durum: `OPEN`
  - Windows çekirdeği korunarak macOS, iPhone, iPad, Apple Watch ve Vision Pro istemcilerini ayrı platform gereksinimleriyle geliştir.
- [ ] **OPEN-020 — İmzalı üretim ve operasyon paketi** · Gold · Durum: `OPEN`
  - Authenticode/kod imzası, imzalı installer, SBOM, lisans, gizlilik, rollback, destek, son kullanıcı kılavuzu ve nihai ekran görüntülerini tamamla.

## Sohbet bağlam kapasitesi

- Gerçek platform bağlam yüzdesi: **UNAVAILABLE**
- Ölçüm niteliği: **platform_actual_unavailable — tahmin HARD_STOP üretmez**
- Seviye: **UNMEASURED**

## Proje ilerleme tahmini

- Tahmini kodlama tamamlanma: **%97.6**
- Tahmini kalan kodlama: **%2.4**
- Proje başlangıcı: **2026-07-20**
- Geçen süre: **13 gün**
- Tarihsel build hızı: **17.54 build/gün**
- Tahmini Bronze Final: **2026-08-07**
- Tahmini Silver: **2026-08-16**
- Tahmini Gold/genel bitiş: **2026-08-20**
- Tahmin güveni: **Orta**

## 20 Temmuz 2026’dan bugüne build geçmişi

### 2026-07-20

- [x] **Build 1 — 20.07.2026.1** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Koyu temalı Windows masaüstü uygulama kabuğu; 12 modüllü ana navigasyon; Gerçek SQLite yerel veritabanı ve başlangıç migrasyonu
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP1.md`
### 2026-07-21

- [x] **Build 2 — 21.07.2026.2** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Önemli günlerde tek seferlik / yıllık tekrar seçimi; 30, 14, 7, 1 gün önce ve aynı gün hatırlatma seçenekleri; Yaklaşan önemli günlerden türetilen bildirim merkezi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP2.md`
- [x] **Build 3 — 21.07.2026.3** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: İlk aile yöneticisi kurulumu, scrypt parola doğrulaması, yerel oturum açma, gerçek soy ağacı ilişki editörü ve SHA-256 doğrulamalı dijital arşiv içe aktarma eklendi.
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP3.md`, `BUILD_STATUS_MVP3.md`
- [x] **Build 4 — 21.07.2026.4** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Arşiv dosyalarının AES-256-GCM ile şifreli kasada saklanması; Cihaza özel 256 bit kasa anahtarı; Arşiv dosyası açılırken geçici çözme ve SHA-256 bütünlük doğrulaması
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP4.md`, `BUILD_STATUS_MVP4.md`
- [x] **Build 5 — 21.07.2026.5** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Beş başarısız girişten sonra 15 dakikalık hesap kilidi; Başarısız giriş ve hesap kilidi denetim kayıtları; RFC 6238 uyumlu 6 haneli TOTP doğrulama
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP5.md`, `BUILD_STATUS_MVP5.md`
- [x] **Build 6 — 21.07.2026.6** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: pptbackup tam yedekten geri yükleme; Geri yükleme öncesi otomatik tam güvenlik yedeği; SQLite başlığı ve PRAGMA integritycheck doğrulaması
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP6.md`, `BUILD_STATUS_MVP6.md`
- [x] **Build 7 — 21.07.2026.7** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Çok kullanıcılı aile hesabı modeli; Aile yöneticisi, yetişkin üye, sınırlı üye, bakım veren ve danışman rolleri; Başlangıç ve bitiş tarihli süreli üyelik
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP7.md`, `BUILD_STATUS_MVP7.md`
- [x] **Build 8 — 21.07.2026.8** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Yetkiler modülü gerçek yönetim ekranına bağlandı; Aile hesapları ve üyelik rolleri görüntüleniyor; Tek kullanımlık süreli davet kodu oluşturma ve davet iptali arayüzden çalışıyor
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP8.md`, `BUILD_STATUS_MVP8.md`
- [x] **Build 9 — 21.07.2026.9** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Sağlık ve finans kayıtlarında gerçek veri sahibi alanı; Özel, seçili üyeler ve aile gizlilik seviyeleri; Sağlık kayıtları: randevu, ilaç, tanı, aşı ve not türleri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP9.md`, `BUILD_STATUS_MVP9.md`
- [x] **Build 10 — 21.07.2026.10** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: İlaç ve tedavi planları: doz, kullanım saati, hekim, başlangıç ve bitiş tarihleri; Aile sağlık geçmişi kayıtları ve kişiye bağlı gizlilik denetimi; Finans kayıtlarında para birimi, sembol, vade ve kalan anapara
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP10.md`, `BUILD_STATUS_MVP10.md`
- [x] **Build 11 — 21.07.2026.11** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Birleşik Yaşam Merkezi; Görev merkezi kayıtları; Sigorta poliçesi ve yenileme takibi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP11.md`, `BUILD_STATUS_MVP11.md`
- [x] **Build 12 — 21.07.2026.12** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Bildirim ve Otomasyon Merkezi; Önemli gün, yaşam kaydı, finans kaydı ve ilaç planı kaynak türleri; 0-365 gün aralığında hatırlatma kuralı
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP12.md`, `BUILD_STATUS_MVP12.md`
- [x] **Build 13 — 21.07.2026.13** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Gelişmiş soy ağacı analiz özeti: nesil, dal, eksik ebeveyn bağı ve birleşik aile zaman çizgisi; Arşiv kategori, etiket, hassasiyet ve AI işleme onayı veri modeli; Kategori oluşturma ve arşiv sınıflandırma işlemleri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP13.md`, `BUILD_STATUS_MVP13.md`
- [x] **Build 14 — 21.07.2026.14** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Etkin otomasyon kurallarını çalıştıran veri katmanı; Önemli gün, yaşam kaydı, finans kaydı ve ilaç planı kaynak taraması; Aynı kaynak için yinelenen otomatik görev üretimini engelleyen benzersizlik kontrolü
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP14.md`, `BUILD_STATUS_MVP14.md`
- [x] **Build 15 — 21.07.2026.15** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Dijital miras yürütme isteği ve durum takibi; İlk yönetici onayının otomatik kaydı; İki farklı aile yöneticisi onayı zorunluluğu
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP15.md`, `BUILD_STATUS_MVP15.md`
- [x] **Build 16 — 21.07.2026.16** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Ayrıntılı Dijital Miras Yönetim ekranı; Plan listesi ve durum görünümü; Plan sahibi, emanetçi ve yetki paketleri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP16.md`, `BUILD_STATUS_MVP16.md`
- [x] **Build 17 — 21.07.2026.17** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Arşiv başlığı, dosya adı, MIME türü ve etiketlerde arama; Kategori, hassasiyet, etiket ve MIME türü filtreleri; Belge sürüm geçmişi veri modeli
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP17.md`, `BUILD_STATUS_MVP17.md`
- [x] **Build 18 — 21.07.2026.18** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Gelişmiş Doküman Merkezi ekranı; Başlık, dosya adı, MIME türü ve etiket araması; Kategori, hassasiyet, etiket ve MIME türü filtreleri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP18.md`, `BUILD_STATUS_MVP18.md`
- [x] **Build 19 — 21.07.2026.19** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Donanım ve işletim sistemi profili: platform, mimari, CPU modeli ve çekirdek sayısı; Toplam/boş bellek ve kullanım yüzdesi; SQLite veritabanı ve şifreli arşiv boyutu
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP19.md`, `BUILD_STATUS_MVP19.md`
- [x] **Build 20 — 21.07.2026.20** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Gerçek yedek hedef çalıştırıcısı; Yerel, harici ve bulut klasör hedeflerinin bağımsız yürütülmesi; Hedef başına hata izolasyonu
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP20.md`, `BUILD_STATUS_MVP20.md`
- [x] **Build 21 — 21.07.2026.21** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Hedef bazında manuel, saatlik, günlük, haftalık ve aylık yedekleme zamanlaması; Bir sonraki çalışma zamanının kalıcı olarak tutulması; Hedef bazında 0–5 otomatik yeniden deneme
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP21.md`, `BUILD_STATUS_MVP21.md`
- [x] **Build 22 — 21.07.2026.22** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Electron yaşam döngüsüne bağlı otomatik arka plan zamanlayıcısı; Her 60 saniyede zamanı gelen yedek hedeflerini denetleme; Her 5 dakikada otomatik CPU, bellek ve veri büyüklüğü örnekleme
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP22.md`, `BUILD_STATUS_MVP22.md`
- [x] **Build 23 — 21.07.2026.23** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Kritik, yüksek, normal ve düşük öncelikli merkezi görev kuyruğu; Adaptif kaynak kapasitesine göre görev yürütme ve erteleme; Görev yeniden deneme ve kalıcı çalışma durumu
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP23.md`, `BUILD_STATUS_MVP23.md`
- [x] **Build 24 — 21.07.2026.24** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Merkezi görev öncelik kuyruğunun Sistem Yönetimi ekranına bağlanması; Kritik, yüksek, normal ve düşük önceliklerin görünür izlenmesi; Görev kuyruğunu manuel çalıştırma ve sonuç özeti
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP24.md`, `BUILD_STATUS_MVP24.md`
- [x] **Build 25 — 21.07.2026.25** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: 0–100 aralığında sistem sağlık puanlama modeli; Mükemmel, iyi, dikkat ve kritik sağlık dereceleri; Veritabanı bütünlüğü, sistem durumu, bellek baskısı, başarısız yedekler, uzun görevler ve aktif bildirimlere göre puan kesintileri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP25.md`, `BUILD_STATUS_MVP25.md`
- [x] **Build 26 — 21.07.2026.26** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Sistem sağlık puanı geçmişinin kalıcı olarak kaydedilmesi; Günlük/haftalık/aylık aralıklar için sağlık eğilim analizi; Ortalama, minimum, maksimum ve değişim değerleri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP26.md`, `BUILD_STATUS_MVP26.md`
- [x] **Build 27 — 21.07.2026.27** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Sistem sağlık puanı geçmişi için uygulama içi grafik görünümü; 30 günlük sağlık eğilimi, ortalama, minimum ve değişim göstergeleri; Son 24 saat performans anomalilerinin yönetim ekranında gösterimi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP27.md`, `BUILD_STATUS_MVP27.md`
- [x] **Build 28 — 21.07.2026.28** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Sağlık grafiğinde 7, 30, 90 ve 365 günlük zaman aralığı seçimi; Performans anomalilerinde 24 saat, 7 gün ve 30 günlük değerlendirme aralığı; İki tanılama raporunun sağlık puanı, sistem durumu ve üst düzey bölümler bakımından karşılaştırılması
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP28.md`, `BUILD_STATUS_MVP28.md`
- [x] **Build 29 — 21.07.2026.29** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Bakım işlemleri için kalıcı sonuç geçmişi; İşlem kaynağı, başlangıç/bitiş zamanı, süre, başarı ve hata kaydı; Tanılama raporlarında bölüm bazlı ayrıntılı karşılaştırma
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP29.md`, `BUILD_STATUS_MVP29.md`
- [x] **Build 30 — 21.07.2026.30** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Bakım geçmişinde işlem, sonuç, kaynak ve tarih aralığı filtreleri; Filtrelenmiş bakım geçmişini JSON/CSV dışa aktarma; Dışa aktarımlarda SHA-256 ve dosya boyutu özeti
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP30.md`, `BUILD_STATUS_MVP30.md`
- [x] **Build 31 — 21.07.2026.31** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: JSON, CSV ve PDF dışa aktarımları için kalıcı geçmiş, dosya bütünlük kaydı ve dışa aktarım doğrulama akışları eklendi.
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP31.md`, `BUILD_STATUS_MVP31.md`
- [x] **Build 32 — 21.07.2026.32** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Uygulama adı, sürüm, sahiplik ve aşama bilgileri APP_META tek doğruluk kaynağında birleştirildi; workspace, lockfile, Electron ve renderer metadata sürümleri eşitlendi.
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP32.md`, `BUILD_STATUS_MVP32.md`
- [x] **Build 33 — 21.07.2026.33** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Tam yedek biçimi v2'ye yükseltildi; Veritabanı, dijital kasa anahtarı ve her arşiv girdisi için ayrı SHA-256 bütünlük kaydı eklendi; Arşiv girdilerine boyut doğrulaması eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP33.md`, `BUILD_STATUS_MVP33.md`
- [x] **Build 34 — 21.07.2026.34** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Tam yedek seçimi için geri yüklemeden bağımsız kullanıcı görünür ön inceleme akışı eklendi; İnceleme sonucu beş bileşen denetimini, risk seviyesini ve önerilen işlemi gösteriyor; Eski v1 yedekler dikkat seviyesiyle işaretleniyor ve v2 yedeğe yükseltme öneriliyor
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP34.md`, `BUILD_STATUS_MVP34.md`
- [x] **Build 35 — 21.07.2026.35** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Windows NSIS yardımcı kurulum yapılandırması standardize edildi; Kullanıcı bazlı kurulum (perMachine: false) ve yönetici yetkisi istemeyen asInvoker çalışma seviyesi tanımlandı; Kurulum dizini seçimi, masaüstü ve Başlat menüsü kısayolları etkinleştirildi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP35.md`, `BUILD_STATUS_MVP35.md`
- [x] **Build 36 — 21.07.2026.36** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Renderer için ortak UI bileşen katmanı eklendi (ui.tsx); PageHeader, Button, EmptyState ve Modal bileşenleri ana uygulama dosyasından ayrıştırıldı; Yeni Surface, SectionHeader, StatRow ve StatusMessage bileşenleri eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP36.md`, `BUILD_STATUS_MVP36.md`
- [x] **Build 37 — 21.07.2026.37** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: SQLite WAL çalışma profili synchronous=NORMAL, 5 saniyelik busy timeout, bellek içi geçici tablolar, 20 MiB sayfa önbelleği ve 256 MiB mmap üst sınırıyla iyileştirildi; Aile olayları, finans, sağlık, yaşam, arşiv, tanılama, performans, yedekleme, görev kuyruğu, denetim ve bakım geçmişi için yeni ...
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP37.md`, `BUILD_STATUS_MVP37.md`
- [x] **Build 38 — 21.07.2026.38** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Denetim kayıtları SHA-256 bağlı kayıt zincirine geçirildi; Her kayıt önceki kaydın özetini, işlem sahibini ve kendi bütünlük özetini taşır; Eski denetim kayıtları ilk geçişte geriye dönük olarak zincire alınır; mevcut zincir sonradan sessizce yeniden yazılmaz
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP38.md`, `BUILD_STATUS_MVP38.md`
- [x] **Build 39 — 21.07.2026.39** · Bronze MVP Active Development · Durum: `COMPLETED`
  - Yapılan: Klavyeyle doğrudan ana içeriğe geçiş bağlantısı eklendi; Ana gezinmeye açıklayıcı erişilebilirlik etiketi ve etkin sayfa bildirimi eklendi; Modal pencerelere Escape ile kapatma, odak hapsetme ve kapandıktan sonra önceki odağa dönme davranışı eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP39.md`, `BUILD_STATUS_MVP39.md`
- [x] **Build 40 — 21.07.2026.40** · Bronze MVP Code Freeze Baseline · Durum: `COMPLETED`
  - Yapılan: MVP-40 Code Freeze Baseline
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP40.md`, `BUILD_STATUS_MVP40.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-23

- [x] **Build 41 — 23.07.2026.41** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: B060-WI-001 kapsamında MVP-40 baseline manifesti oluşturuldu; Mevcut 124 main IPC kanalı, 124 preload çağrısı ve 40 SQLite tablo bildirimi envantere alındı; @ppt/core, @ppt/contracts, @ppt/config, @ppt/logging, @ppt/database, @ppt/repositories ve @ppt/events workspace paketleri eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP41.md`, `BUILD_STATUS_MVP41.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 42 — 23.07.2026.42** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Electron başlangıcına bağlı merkezi configuration bootstrap; Data, archive, cache, logs ve temp klasörlerinin ayrıştırılması; Mevcut panthera-family.db ile geriye uyumlu merkezi database path çözümlemesi
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP42.md`, `BUILD_STATUS_MVP42.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 43 — 23.07.2026.43** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Merkezi SQLite connection factory ve başlangıç PRAGMA uygulaması; Sürümlü, checksum doğrulamalı migration runner; schemamigrations ve databasemetadata altyapı tabloları
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP43.md`, `BUILD_STATUS_MVP43.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 44 — 23.07.2026.44** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: SqliteRepository ortak repository tabanı; SqlitePersonRepository; SqliteAuditRepository
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP44.md`, `BUILD_STATUS_MVP44.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 45 — 23.07.2026.45** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Milestone: B060-M5 — Event Dispatcher & Idempotency
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP45.md`, `BUILD_STATUS_MVP45.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 46 — 23.07.2026.46** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Milestone: B060-M6 — Family Application Use Cases
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP46.md`, `BUILD_STATUS_MVP46.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 47 — 23.07.2026.47** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Milestone: B060-M7 — Genealogy Read Model
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP47.md`, `BUILD_STATUS_MVP47.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 48 — 23.07.2026.48** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Milestone: B060-M8 — Timeline & Important Days Application Migration
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP48.md`, `BUILD_STATUS_MVP48.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 49 — 23.07.2026.49** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Milestone: B060-M9 — Dashboard Query & Navigation State
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP49.md`, `BUILD_STATUS_MVP49.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 50 — 23.07.2026.50** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: AuthApplicationUnitOfWork; GetAuthStateUseCase; SetupAdminUseCase
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP50.md`, `BUILD_STATUS_MVP50.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 51 — 23.07.2026.51** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: TOTP base32 kodlama ve doğrulama primitive’leri; Kurtarma kodu üretme, hash’leme ve tek kullanımlık tüketim; Ed25519 cihaz anahtar çifti, fingerprint ve imza doğrulama
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP51.md`, `BUILD_STATUS_MVP51.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 52 — 23.07.2026.52** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: CentralAuthorizationService; EvaluateAuthorizationUseCase; ListObjectPermissionsUseCase
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP52.md`, `BUILD_STATUS_MVP52.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 53 — 23.07.2026.53** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: SqliteInvitationRepository; SqliteNotificationStateRepository; Aile daveti listeleme, oluşturma, iptal ve kabul use-case’leri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP53.md`, `BUILD_STATUS_MVP53.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 54 — 23.07.2026.54** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: SqliteHealthRepository; Sağlık query portu ve transaction unit-of-work adapter'ı; Sağlık kaydı listeleme ve oluşturma use-case'leri
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP54.md`, `BUILD_STATUS_MVP54.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-24

- [x] **Build 55 — 24.07.2026.55** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Finans kayıtları ve değerlemeler FamilyDataStore içindeki doğrudan SQL akışından application/repository mimarisine taşındı. Varlık, borç, gelir ve gider kayıtları artık kişi doğrulaması, merkezi yetkilendirme, audit ve outbox ile tek transaction içinde yazılır
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP55.md`, `BUILD_STATUS_MVP55.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 56 — 24.07.2026.56** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Arşiv içeriği AES tabanlı mevcut kasa şifrelemesiyle saklanmaya devam eder; Açılan dosyanın SHA-256 değeri metadata ile karşılaştırılır; Metadata, ilk sürüm, audit ve outbox tek transaction içindedir
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP56.md`, `BUILD_STATUS_MVP56.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 57 — 24.07.2026.57** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Dijital miras işlemlerindeki doğrudan DataStore SQL erişimleri repository ve application use-case mimarisine taşındı. Plan sahibi ve emanetçi doğrulaması, yönetici onayları, yürütme bekleme süresi, geri alma penceresi ve nesne izinlerinin aktarımı transaction sınırına alındı. Audit zinciri ve tra...
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP57.md`, `BUILD_STATUS_MVP57.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 58 — 24.07.2026.58** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Görev, sigorta, eğitim, abonelik ve resmî işlem kayıtları application/repository mimarisine taşındı
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP58.md`, `BUILD_STATUS_MVP58.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 59 — 24.07.2026.59** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Sistem sağlığı ve tanılama operasyonları için OperationalHealthApplicationContext, query/write portları ve use-case katmanı eklendi; Performans örneği kaydetme/listeleme ve performans eğilimi hesaplama doğrudan SQL akışından application katmanına taşındı; Tanılama kaydı oluşturma ve listeleme Sql...
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP59.md`, `BUILD_STATUS_MVP59.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 60 — 24.07.2026.60** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: BackupApplicationContext, query/write portları ve yedekleme use-case'leri eklendi; SqliteBackupRepository ve RepositoryBackedBackupAdapter oluşturuldu; Hedef listeleme, hedef bulma, hedef ekleme/güncelleme, çalışma geçmişi, etkin hedefler ve zamanı gelen hedef sorguları repository katmanına taşındı
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP60.md`, `BUILD_STATUS_MVP60.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 61 — 24.07.2026.61** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: packages/application/src/task-use-cases.ts; packages/repositories/src/task-repository.ts; apps/desktop/src/main/task-application-adapter.ts
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP61.md`, `BUILD_STATUS_MVP61.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 62 — 24.07.2026.62** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Operational health maintenance migration
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP62.md`, `BUILD_STATUS_MVP62.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 63 — 24.07.2026.63** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: exportartifacts kayıt, listeleme ve tekil bulma işlemleri application/repository katmanına taşındı; diagnosticreports kayıt, listeleme ve tekil bulma işlemleri application/repository katmanına taşındı; Dosya sistemi işlemleri, içerik üretimi ve SHA-256 doğrulaması masaüstü servis sınırında tutuldu
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP63.md`, `BUILD_STATUS_MVP63.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 64 — 24.07.2026.64** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Sistem sağlık geçmişinin tarih eşiğine göre sorgulanması application/repository katmanına taşındı; getSystemHealthTrend doğrudan SQL kullanmadan yeni use-case üzerinden çalışacak biçimde güncellendi; Bakım geçmişi listeleme application use-case hattına bağlandı
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP64.md`, `BUILD_STATUS_MVP64.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 65 — 24.07.2026.65** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Tanılama arşivi kayıt, listeleme ve tekil bulma işlemleri application/repository sınırına taşındı; Arşivlenen tanılama kayıtlarını kesim tarihine kadar temizleme repository katmanına taşındı; archiveDiagnostics, listDiagnosticArchives, readDiagnosticArchive ve verifyDiagnosticArchive doğrudan dia...
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP65.md`, `BUILD_STATUS_MVP65.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 66 — 24.07.2026.66** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Denetim günlüğü listeleme sorgusu DataStore doğrudan SQL katmanından çıkarıldı; AuthorizationQueryPort içine denetim kayıtlarını listeleme portu eklendi; ListAuditEntriesUseCase ile aktif hesap ve yönetici yetkisi denetimi application katmanına taşındı
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP66.md`, `BUILD_STATUS_MVP66.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 67 — 24.07.2026.67** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Aile hesaplarını listeleme işlemi ListFamilyAccountsUseCase üzerinden application katmanına taşındı; Hesap rolü, durumu, kişi bağlantısı ve üyelik tarihlerini güncelleme işlemi UpdateFamilyAccountUseCase üzerinden yürütülüyor; Yönetici hesabının kendi yöneticilik yetkisini veya aktif durumunu kal...
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP67.md`, `BUILD_STATUS_MVP67.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 68 — 24.07.2026.68** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Automation rule management migration
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP68.md`, `BUILD_STATUS_MVP68.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 69 — 24.07.2026.69** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Automation execution migration
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP69.md`, `BUILD_STATUS_MVP69.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 70 — 24.07.2026.70** · Bronze Development · Durum: `COMPLETED`
  - Yapılan: Politika oluşturma ve imha yalnızca etkin aile yöneticisine açık; Saklama süresi dolmadan imha engelleniyor; Daha önce imha edilmiş kayıt tekrar işlenemiyor
  - Kanıt: `RELEASE_NOTES_BRONZE_MVP70.md`, `BUILD_STATUS_MVP70.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 71 — 24.07.2026.71** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bu paket kaynak kod teslimidir. Bronze Final, Silver, Gold veya çalıştırılabilir Windows installer değildir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD71.md`, `BUILD_STATUS_BRONZE_RC2_BUILD71.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 72 — 24.07.2026.72** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bu paket kaynak kod teslimidir. RC2 Final, Code Freeze, Silver veya Gold paketi değildir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD72.md`, `BUILD_STATUS_BRONZE_RC2_BUILD72.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 73 — 24.07.2026.73** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: SqliteAiConsentRepository eklendi; AI izin listeleme ve kimlik çözümleme repository katmanına taşındı; İzin ekleme/güncelleme ve etkin izin sorguları repository katmanına taşındı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD73.md`, `BUILD_STATUS_BRONZE_RC2_BUILD73.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 74 — 24.07.2026.74** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Report summary application/repository migration
  - Kanıt: `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 75 — 24.07.2026.75** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bakım önerisi kararları GetMaintenanceRecommendationsUseCase içine taşındı; Başarısız yedekleme sayımı OperationalHealthQueryPort üzerinden okunuyor; DataStore içindeki doğrudan backupruns sayım SQL'i kaldırıldı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD75.md`, `BUILD_STATUS_BRONZE_RC2_BUILD75.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 76 — 24.07.2026.76** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Konum oluşturma doğrulaması CreateFamilyLocationUseCase içine taşındı; Konum kaydı SqliteLocationRepository.insert üzerinden gerçekleştiriliyor; Kayıt ve denetim izi aynı transaction/unit-of-work sınırında atomik hale getirildi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD76.md`, `BUILD_STATUS_BRONZE_RC2_BUILD76.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 77 — 24.07.2026.77** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aşama: Bronze RC2 Aktif Geliştirme
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD77.md`, `BUILD_STATUS_BRONZE_RC2_BUILD77.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 78 — 24.07.2026.78** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Arşiv arama ölçütleri SearchArchiveItemsUseCase içinde normalleştirildi; Arşiv arama SQL'i SqliteArchiveRepository.search metoduna taşındı; Arama sonuçları merkezi nesne bazlı okuma yetkilendirmesinden geçirildi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD78.md`, `BUILD_STATUS_BRONZE_RC2_BUILD78.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 79 — 24.07.2026.79** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Geçerli oturum hesabının yüklenmesi SqliteAccountRepository.findById üzerinden transaction sınırına taşındı. AI izin application context içindeki doğrudan accounts SQL sorgusu kaldırıldı ve merkezi #currentAccount() akışı yeniden kullanıldı. Üyelik durumu ve başlangıç/bitiş tarihi kontrolleri kor...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD79.md`, `BUILD_STATUS_BRONZE_RC2_BUILD79.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 80 — 24.07.2026.80** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aile yöneticisi bütünlük onarımı account repository transaction sınırına taşındı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD80.md`, `BUILD_STATUS_BRONZE_RC2_BUILD80.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 81 — 24.07.2026.81** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Eski denetim kayıtlarının hash zincirini tamamlayan işlem SqliteAuditRepository.backfillMissingChain metoduna taşındı. FamilyDataStore içindeki doğrudan SELECT auditlog ve UPDATE auditlog SQL kodu kaldırıldı; işlem SqliteTransactionExecutor transaction sınırında çalıştırılıyor. V1 hash üretim dav...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD81.md`, `BUILD_STATUS_BRONZE_RC2_BUILD81.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 82 — 24.07.2026.82** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: İlk açılışta örnek aile verilerini oluşturan akış SeedDefaultFamilyUseCase, RepositoryBackedBootstrapApplicationUnitOfWork ve SqliteBootstrapRepository.seedIfEmpty sınırlarına taşındı. FamilyDataStore içindeki doğrudan aile, kişi, ilişki, konum ve etkinlik SQL kodları ile manuel BEGIN/COMMIT/ROLL...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD82.md`, `BUILD_STATUS_BRONZE_RC2_BUILD82.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 83 — 24.07.2026.83** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Ana ekran anlık görüntüsündeki lastUpdatedAt sorgusu FamilyDataStore doğrudan SQL sınırından çıkarıldı. GetLatestAuditOccurredAtUseCase, AuditReadQueryPort, RepositoryBackedAuditReadQueryPort ve SqliteAuditRepository.latestOccurredAt() üzerinden transaction kontrollü okuma sağlandı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD83.md`, `BUILD_STATUS_BRONZE_RC2_BUILD83.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 84 — 24.07.2026.84** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bağımsız denetim kaydı yazma akışı application command port ve audit repository transaction sınırına taşındı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD84.md`, `BUILD_STATUS_BRONZE_RC2_BUILD84.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 85 — 24.07.2026.85** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Sistem sağlığı görünümündeki SQLite integritycheck ve journalmode sorguları FamilyDataStore.getSystemHealth() içinden çıkarıldı. Yeni InspectDatabaseRuntimeHealthUseCase, DatabaseRuntimeHealthQueryPort, masaüstü SQLite adaptörü ve database altyapı denetleyicisi üzerinden çalışıyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD85.md`, `BUILD_STATUS_BRONZE_RC2_BUILD85.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 86 — 24.07.2026.86** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Manuel ve otomatik veritabanı bakım işlemlerindeki SQLite integritycheck, WAL checkpoint, ANALYZE ve VACUUM komutları FamilyDataStore.runMaintenance() içinden çıkarıldı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD86.md`, `BUILD_STATUS_BRONZE_RC2_BUILD86.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 87 — 24.07.2026.87** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Tam yedek, geri yükleme ve doğrudan .db dışa aktarma akışlarındaki SQLite WAL checkpoint komutları ile sahnelenmiş geri yükleme veritabanının integritycheck doğrulaması FamilyDataStore içinden çıkarıldı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD87.md`, `BUILD_STATUS_BRONZE_RC2_BUILD87.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 88 — 24.07.2026.88** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Denetim günlüğünü değiştirilemez tutan SQLite UPDATE ve DELETE koruma tetikleyicilerinin kurulumu FamilyDataStore içindeki doğrudan SQL kodundan çıkarıldı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD88.md`, `BUILD_STATUS_BRONZE_RC2_BUILD88.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 89 — 24.07.2026.89** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: SQLite bağlantısının açılması, başlangıç PRAGMA ayarlarının uygulanması, aile veritabanı migration zincirinin yürütülmesi, migration sonucunun üst katmana bildirilmesi, transaction executor kurulması ve bağlantının kapatılması FamilyDataStore içinden çıkarıldı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD89.md`, `BUILD_STATUS_BRONZE_RC2_BUILD89.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 90 — 24.07.2026.90** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Arşiv dosyalarının kaynak konumdan okunması, SHA-256 özetinin üretilmesi, dijital kasa anahtarıyla şifrelenmesi ve .vault dosyasına yazılması FamilyDataStore içinden çıkarıldı. Arşiv açma sırasında şifre çözme, beklenen SHA-256 ile bütünlük doğrulama ve geçici dosya oluşturma işlemleri de aynı ap...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD90.md`, `BUILD_STATUS_BRONZE_RC2_BUILD90.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 91 — 24.07.2026.91** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Tanılama raporlarının ve bakım geçmişi dışa aktarımlarının hedef dosyaya yazılması, dosya boyutu ile SHA-256 özetinin üretilmesi FamilyDataStore içinden çıkarıldı. Sıkıştırılmış tanılama arşivlerinin GZIP olarak yazılması ve doğrulanmış biçimde açılması da aynı application portu üzerinden masaüst...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD91.md`, `BUILD_STATUS_BRONZE_RC2_BUILD91.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 92 — 24.07.2026.92** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Zamanlanmış yedek hedeflerinin boş alan ölçümü ve yazılabilirlik testi, hedef .pptbackup dosya yolunun oluşturulması, üretilen dosyanın boyut ve SHA-256 geri-okuma doğrulaması ile retention kapsamındaki fiziksel dosya temizliği FamilyDataStore içinden çıkarıldı. İşlemler application use-case sını...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD92.md`, `BUILD_STATUS_BRONZE_RC2_BUILD92.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 93 — 24.07.2026.93** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Tam yedek kapsayıcısının v2 biçiminde oluşturulması, veritabanı, kasa anahtarı ve şifreli arşiv girdilerinin SHA-256 manifestiyle paketlenmesi FamilyDataStore içinden çıkarıldı. V1/v2 yedek incelemesi, SQLite başlığı, kasa anahtarı, bileşen hash değerleri ve şifreli arşiv girdilerinin açılabilirl...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD93.md`, `BUILD_STATUS_BRONZE_RC2_BUILD93.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 94 — 24.07.2026.94** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Sistem sağlığı görünümü, uyarlanabilir arka plan görev profili ve performans örneklemesi için kullanılan işletim sistemi, CPU, bellek, veritabanı boyutu ve arşiv boyutu ölçümleri FamilyDataStore içinden çıkarıldı. Ölçüm sözleşmesi application katmanındaki SystemResourceSnapshotPort ile tanımlandı...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD94.md`, `BUILD_STATUS_BRONZE_RC2_BUILD94.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 95 — 24.07.2026.95** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aile daveti tokenlarının kriptografik üretimi ve SHA-256 özetlenmesi FamilyDataStore içindeki doğrudan Node crypto kodundan çıkarıldı. Application katmanındaki mevcut InvitationTokenService sözleşmesi, masaüstü ana süreçteki NodeInvitationTokenService adaptörü tarafından uygulanmaktadır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD95.md`, `BUILD_STATUS_BRONZE_RC2_BUILD95.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 96 — 24.07.2026.96** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Doğrudan SQLite veritabanı dışa aktarımında kullanılan fiziksel dosya kopyalama işlemi FamilyDataStore içindeki Node fs çağrısından çıkarıldı. Application katmanında DatabaseExportFilePort ve ExportDatabaseFileUseCase, masaüstü ana süreçte ise FileSystemDatabaseExportFilePort eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD96.md`, `BUILD_STATUS_BRONZE_RC2_BUILD96.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 97 — 24.07.2026.97** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Parola hash/doğrulama, TOTP ve kurtarma kodu işlemleri, cihaz imzası doğrulaması ve bellek içi oturum portu FamilyDataStore içindeki inline güvenlik uygulamalarından çıkarıldı. Masaüstü ana süreçte NodePasswordService, NodeSecondFactorService, NodeDeviceProofVerifier ve InMemoryAuthSessionPort ek...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD97.md`, `BUILD_STATUS_BRONZE_RC2_BUILD97.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 98 — 24.07.2026.98** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Veritabanına bağlı depolama yollarının oluşturulması FamilyDataStore içindeki doğrudan node:path kullanımından çıkarıldı. Application katmanına FamilyStorageLayoutPort ve ResolveFamilyStorageLayoutUseCase, masaüstü ana sürece NodeFamilyStorageLayoutPort eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD98.md`, `BUILD_STATUS_BRONZE_RC2_BUILD98.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-25

- [x] **Build 99 — 25.07.2026.99** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Tüm workspace paketleri ve bunların internal @ppt/ bağımlılık bildirimleri 25.7.2026-99 sürümünde eşleştirildi. package-lock.json içindeki workspace kayıtları aynı sürüme çekildi ve nodemodules/@ppt/ kayıtlarının yerel apps/ veya packages/ bağlantıları olarak kalması korundu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD99.md`, `BUILD_STATUS_BRONZE_RC2_BUILD99.md`, `BUILD99_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 100 — 25.07.2026.100** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: package-lock.json içindeki hatalı esbuild sürüm metadatası 0.25.12 olarak düzeltildi; scripts/verify-lockfile-integrity.mjs eklendi; scripts/set-workspace-version.mjs eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD100.md`, `BUILD_STATUS_BRONZE_RC2_BUILD100.md`, `BUILD100_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 101 — 25.07.2026.101** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 101, bağımlılık tedarik zincirini çalışma ortamından bağımsız ve denetlenebilir hale getirir. Lockfile dış paketleri resmî npm registry ve SHA-512 bütünlüğüyle sabitler. Yeni RC2 kapı yöneticisi doğrulamaları onaylı sırada yürütür, ilk başarısızlıkta durur ve çalıştırılmayan her adımı NOTRU...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD101.md`, `BUILD_STATUS_BRONZE_RC2_BUILD101.md`, `BUILD101_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 102 — 25.07.2026.102** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 102, database ve repository execution sınırlarını tamamlar. Desktop/application katmanları native SQLite ve somut transaction context tiplerinden ayrılmış; bağımlılıklar genel portlar üzerinden kurulmuştur. RC2 doğrulama yöneticisi askıda süreçlere karşı zaman aşımı ve süreç ağacı temizliği...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD102.md`, `BUILD_STATUS_BRONZE_RC2_BUILD102.md`, `BUILD102_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 103 — 25.07.2026.103** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 103, application adapter ile database implementation sınırını tamamlar. Database sağlık, bakım, yedek güvenliği ve audit saklama korumasına ait SQLite adapter’ları desktop application katmanından @ppt/infrastructure katmanına taşınmıştır. Transaction bağımlılıkları repository-facing port yü...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD103.md`, `BUILD_STATUS_BRONZE_RC2_BUILD103.md`, `BUILD103_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 104 — 25.07.2026.104** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 104, application adapter ile repository implementasyonu arasındaki sözleşme sınırını güçlendirir. Önceki sürümde repository portları somut Sqlite...Repository sınıflarının public yüzeyinden yapısal olarak türetiliyordu. Bu dolaylı implementasyon bağı kaldırılmış, 26 repository için açık por...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD104.md`, `BUILD_STATUS_BRONZE_RC2_BUILD104.md`, `BUILD104_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 105 — 25.07.2026.105** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 105, application ve persistence katmanları arasındaki yetki sınırını güçlendirir. Önceki sürümde transaction callback’i application adapter’larına DatabaseExecutor veriyor ve adapter’ların doğrudan SQL çalıştırabilmesine tip sistemi düzeyinde imkân tanıyordu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD105.md`, `BUILD_STATUS_BRONZE_RC2_BUILD105.md`, `BUILD105_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 106 — 25.07.2026.106** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Clean dependency installation remains blocked by HTTP 503 for esbuild-0.25.12.tgz; downstream full validation gates remain NOTRUN
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD106.md`, `BUILD_STATUS_BRONZE_RC2_BUILD106.md`, `BUILD106_ARCHITECTURE_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 107 — 25.07.2026.107** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Controlled source type-check’leri TypeScript 5.8.3 ve kontrollü Electron declaration shell ile geçti. Bunlar, temiz npm ci sonrasında çalıştırılması gereken kilitli tam workspace tsc --noEmit kapısının yerine geçmez
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD107.md`, `BUILD_STATUS_BRONZE_RC2_BUILD107.md`, `BUILD107_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD107_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 108 — 25.07.2026.108** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Ana build durumu ile aktif geliştirme belgesindeki eski sürüm driftleri giderildi; Sürüm güncelleyicisi tüm aktif sürüm yüzeylerini senkronize edecek şekilde genişletildi; Paketler, internal workspace bağımlılıkları, lockfile, APPMETA, sürüm defteri, repository metadata, build durumu ve kaynak ma...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD108.md`, `BUILD_STATUS_BRONZE_RC2_BUILD108.md`, `BUILD108_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD108_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 109 — 25.07.2026.109** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: RC2 validation gate komutları Windows, Linux ve macOS için platform-duyarlı şekilde çözümlenir; Windows’ta npm komutları mevcut npmexecpath üzerinden Node ile; bu bilgi yoksa cmd.exe üzerinden güvenli yedek stratejiyle başlatılır; Gate raporlarına istenen ve çözümlenen komut ile çözümleme stratej...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD109.md`, `BUILD_STATUS_BRONZE_RC2_BUILD109.md`, `BUILD109_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD109_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 110 — 25.07.2026.110** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Temiz npm ci kapısı için resmî npm registry’ye kilitli erişim politikası eklendi; Geçici HTTP/ağ hataları için en fazla üç denemeli kontrollü retry yürütücüsü oluşturuldu; Dış servis kesintisi, lockfile/politika, paket bütünlüğü, yerel izin ve sınıflandırılamayan hata ayrımı eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD110.md`, `BUILD_STATUS_BRONZE_RC2_BUILD110.md`, `BUILD110_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD110_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 111 — 25.07.2026.111** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bağımlılıktan bağımsız kaynak ön-kontrol yöneticisi; Kaynak ön-kontrolü için makine tarafından okunabilir JSON kanıtı; RC2 kapılarında faz ve blockedBy raporlaması
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD111.md`, `BUILD_STATUS_BRONZE_RC2_BUILD111.md`, `BUILD111_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD111_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 112 — 25.07.2026.112** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kaynak manifesti ve SHA-256 teslim bütünlüğü doğrulayıcısı; Manifest/SHA-256 için ortak güvenli dosya-toplama kütüphanesi; Dosya yolu, byte, hash, sıralama, tekrar ve kaynak-ağacı eşitliği kontrolleri
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD112.md`, `BUILD_STATUS_BRONZE_RC2_BUILD112.md`, `BUILD112_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD112_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 113 — 25.07.2026.113** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Deterministik ZIP32/STORE kaynak paketleyici; Kaynak ZIP merkezi dizin ve yerel başlık doğrulayıcısı; CRC-32 ve SHA-256 içerik çapraz kontrolü
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD113.md`, `BUILD_STATUS_BRONZE_RC2_BUILD113.md`, `BUILD113_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD113_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 114 — 25.07.2026.114** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aktif teslim belgeleri için makine tarafından doğrulanan sürüm ve build sözleşmesi; Kök build durumu ile kullanıcı doğrulama raporu arasında kapı durumu çapraz kontrolü; Eski MVP/RC2 dosya referanslarını ve eski sürüm numaralarını reddeden drift kontrolü
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD114.md`, `BUILD_STATUS_BRONZE_RC2_BUILD114.md`, `BUILD114_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD114_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 115 — 25.07.2026.115** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kaynak ZIP ve doğrulama kanıtlarını SHA-256 ile birbirine bağlayan ayrık teslim tasdiki; Tasdik dosyasını yeniden hesaplayarak doğrulayan bağımsız doğrulayıcı; Aktif kapı iddialarını RC2 ve temiz kurulum JSON raporlarından türeten durum eşlemesi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD115.md`, `BUILD_STATUS_BRONZE_RC2_BUILD115.md`, `BUILD115_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD115_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 116 — 25.07.2026.116** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Lockfile ile npm cache arasında SHA-512 temelli offline hazırlık doğrulaması; Cache indeks, içerik yolu, byte sayısı ve içerik hash kontrolü; Cache tam olduğunda doğrulanmış offline clean-install önceliği
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD116.md`, `BUILD_STATUS_BRONZE_RC2_BUILD116.md`, `BUILD116_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD116_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 117 — 25.07.2026.117** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Deterministik npm cache transfer paketi üretimi; Paket-lock SHA-256 ve tarball SHA-512 çapraz doğrulaması; Resmî npm registry dışındaki kökenlerin reddi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD117.md`, `BUILD_STATUS_BRONZE_RC2_BUILD117.md`, `BUILD117_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD117_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 118 — 25.07.2026.118** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: IPC çağrılarında kayıtlı ana renderer webContents kimliği doğrulaması; Ana frame zorunluluğu ve alt frame reddi; Prefix tabanlı renderer URL kontrolü yerine kanonik tam belge eşleşmesi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD118.md`, `BUILD_STATUS_BRONZE_RC2_BUILD118.md`, `BUILD118_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD118_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 119 — 25.07.2026.119** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Electron session izin talepleri için varsayılan reddet politikası; Permission check yüzeyi için koşulsuz reddet politikası; Renderer kaynaklı dosya indirmelerini iptal eden session sınırı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD119.md`, `BUILD_STATUS_BRONZE_RC2_BUILD119.md`, `BUILD119_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD119_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 120 — 25.07.2026.120** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Merkezi ipc-payload-security güvenlik katmanı; Argüman, derinlik, düğüm, string, array, nesne anahtarı ve tahmini bayt bütçeleri; Prototip-kirletme anahtarlarının reddi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD120.md`, `BUILD_STATUS_BRONZE_RC2_BUILD120.md`, `BUILD120_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD120_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 121 — 25.07.2026.121** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Güvenli, repository-relative ve ileri eğik çizgili ortak workspace yol normalizasyonu; Mutlak yol, traversal, boş segment ve nokta segmenti reddi; Windows ve POSIX yol biçimlerini kapsayan bağımlılıksız regresyon sözleşmesi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD121.md`, `BUILD_STATUS_BRONZE_RC2_BUILD121.md`, `BUILD121_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD121_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-26

- [x] **Build 122 — 26.07.2026.122** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: tamamlandı; eski dist çıktılarının hatayı gizlemesi engellendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD122.md`, `BUILD_STATUS_BRONZE_RC2_BUILD122.md`, `BUILD122_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD122_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-27

- [x] **Build 123 — 27.07.2026.123** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 122 düzeltmesi korunur ve regresyon sözleşmesiyle doğrulanır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD123.md`, `BUILD_STATUS_BRONZE_RC2_BUILD123.md`, `BUILD123_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD123_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 124 — 27.07.2026.124** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Soy Ağacı: nesil, dal ve bütünlük analizleri görünür oldu; Arşiv: kategori oluşturma işlemi eklendi; Ayarlar: güvenlik, tam/DB yedek, geri yükleme, parola, 2FA, güvenilen cihaz
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD124.md`, `BUILD_STATUS_BRONZE_RC2_BUILD124.md`, `BUILD124_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD124_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 125 — 27.07.2026.125** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Migration 15 olaylara updatedat ve archivedat alanlarını ekler; Aktif olay sorguları arşiv kayıtlarını varsayılan olarak dışarıda bırakır; Güncelleme, arşivleme ve geri alma mevcut yetkilendirme ve audit/outbox
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD125.md`, `BUILD_STATUS_BRONZE_RC2_BUILD125.md`, `BUILD125_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD125_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 126 — 27.07.2026.126** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Apple sistem yazı ailesi, merkezi tipografi tokenları ve uygulama genelinde okunabilir başlık/metin ölçeği eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD126.md`, `BUILD_STATUS_BRONZE_RC2_BUILD126.md`, `BUILD126_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD126_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 127 — 27.07.2026.127** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 127, projenin büyümesiyle farklı sohbet ve belgelerde dağılmış kararları
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD127.md`, `BUILD_STATUS_BRONZE_RC2_BUILD127.md`, `BUILD127_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD127_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 128 — 27.07.2026.128** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 128, güvenilir cihaz kimliğinin Ed25519 özel anahtarını açık JSON dosyasından
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD128.md`, `BUILD_STATUS_BRONZE_RC2_BUILD128.md`, `BUILD128_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD128_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 129 — 27.07.2026.129** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 129, TOTP üretiminde kullanılan paylaşılan sırrın açık SQLite metni olarak
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD129.md`, `BUILD_STATUS_BRONZE_RC2_BUILD129.md`, `BUILD129_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD129_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 130 — 27.07.2026.130** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Yeni tam yedekler anadolu-parsi-full-backup v3 kapsayıcısına taşındı; İç payload AES-256-GCM ile şifreleniyor; Anahtar PBKDF2-SHA512, 310.000 iterasyon ve 32 bayt salt ile türetiliyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD130.md`, `BUILD_STATUS_BRONZE_RC2_BUILD130.md`, `BUILD130_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD130_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 131 — 27.07.2026.131** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Tam geri yükleme için restore-transaction.json dayanıklı işlem günlüğü eklendi; İşlem prepared, live-moved, staged-installed, committed aşamalarına ayrıldı; Günlük ve yeniden giriş işareti atomik geçici dosya, 0600 izin ve fsync ile yazılıyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD131.md`, `BUILD_STATUS_BRONZE_RC2_BUILD131.md`, `BUILD131_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD131_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 132 — 27.07.2026.132** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Ana süreçte app.enableSandbox() zorunlu hâle getirildi; Renderer webPreferences tek güvenli fabrikaya taşındı; Veri deposu açılmadan önce safeStorage kullanılabilirlik ve şifreleme turu eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD132.md`, `BUILD_STATUS_BRONZE_RC2_BUILD132.md`, `BUILD132_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD132_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 133 — 27.07.2026.133** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Hassas finans ve sağlık kayıtları için mahremiyet farkındalıklı merkezi yetkilendirme; private ve selectedmembers kayıtlarında yalnız veri sahibi veya açık nesne izni; family görünürlüğünde yetişkin üye, bakıcı ve danışman için sınırlı okuma politikaları
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD133.md`, `BUILD_STATUS_BRONZE_RC2_BUILD133.md`, `BUILD133_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD133_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 134 — 27.07.2026.134** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Yerel profilde saklanan standart, büyük ve çok büyük metin ölçeği; İşletim sistemi tercihinden başlangıç değeri alabilen yüksek kontrast ve hareket azaltma; Bölüm değişiminde ana içerik odağı ve Türkçe ekran okuyucu duyurusu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD134.md`, `BUILD_STATUS_BRONZE_RC2_BUILD134.md`, `BUILD134_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD134_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-28

- [x] **Build 135 — 28.07.2026.135** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Dijital arşiv kasa anahtarı için OS korumalı sürüm 2 zarfı; Electron safeStorage/Windows DPAPI sağlayıcı kimliği ve SHA-256 bütünlük doğrulaması; Legacy açık 32 bayt anahtar için atomik migration ve geri alma kopyası
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD135.md`, `BUILD_STATUS_BRONZE_RC2_BUILD135.md`, `BUILD135_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD135_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 136 — 28.07.2026.136** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: dataretentionpolicies ve datalifecycle SQLite tabloları; Etkin, arşivlenmiş, imha bekleyen ve imha edilmiş durum modeli; Geri alınabilir arşivleme ve normal modül listelerinden gizleme
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD136.md`, `BUILD_STATUS_BRONZE_RC2_BUILD136.md`, `BUILD136_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD136_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 137 — 28.07.2026.137** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kalıcı imha sonrasında kritik öncelikli backup.propagation görev kuyruğu; Etkin yönetilen her yedek hedefinde retention devre dışıyken yeni şifreli tam yedek oluşturma; Yeni yedeğin dosya okuma sonrası SHA-256 doğrulaması ve başarılı çalışma kaydı zorunluluğu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD137.md`, `BUILD_STATUS_BRONZE_RC2_BUILD137.md`, `BUILD137_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD137_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 138 — 28.07.2026.138** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Varsayılan 90 günlük operasyonel yedek karantina saklama politikası; Karantina grubu bazında hukuki/koruma bekletmesi; Aile yöneticisi. parola ve etkinse TOTP ile güçlü yeniden doğrulama
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD138.md`, `BUILD_STATUS_BRONZE_RC2_BUILD138.md`, `BUILD138_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD138_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 139 — 28.07.2026.139** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Manuel, çevrimdışı, snapshot ve bulut geçmişi kopyaları için envanter; Konum, sorumlu, erişilebilirlik, tarihsel veri riski ve dönemsel inceleme tarihleri; Kayıt kimliğine bağlı kesin teyit ve imha beyanı metinleri
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD139.md`, `BUILD_STATUS_BRONZE_RC2_BUILD139.md`, `BUILD139_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD139_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 140 — 28.07.2026.140** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Güvenilen Ed25519 sağlayıcı ve bağımsız denetçi açık anahtarı kaydı; SPKI PEM normalizasyonu ve SHA-256 parmak izi; Sabit kanonik imha makbuzu ve detached imza doğrulaması
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD140.md`, `BUILD_STATUS_BRONZE_RC2_BUILD140.md`, `BUILD140_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD140_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 141 — 28.07.2026.141** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Önceki güvenilen Ed25519 anahtarıyla imzalanmış ardıl anahtar yetkilendirmesi; Sabit kanonik döndürme makbuzu ve replay/anahtar çakışması koruması; Atomik önceki validUntil ve ardıl validFrom kesim zamanı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD141.md`, `BUILD_STATUS_BRONZE_RC2_BUILD141.md`, `BUILD141_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD141_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 142 — 28.07.2026.142** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Ed25519 imzalı kanonik sağlayıcı iptal listesi; Benzersiz liste kimliği ve monoton sıra numarasıyla rollback/replay koruması; thisUpdate / nextUpdate tazelik penceresi ve 31 günlük üst sınır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD142.md`, `BUILD_STATUS_BRONZE_RC2_BUILD142.md`, `BUILD142_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD142_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 143 — 28.07.2026.143** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 143, Build 142'de doğrulanan Ed25519 imzalı iptal listesinin güvenli HTTPS kaynağından alınabilmesi için ağ güvenlik sınırı ekler. Ağdan gelen belge otomatik uygulanmaz; önce TLS SPKI pini, hedef ağ sınıfı, yönlendirme, boyut, içerik türü ve şema kontrollerinden geçerek kullanıcı incelemesi...
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD143.md`, `BUILD_STATUS_BRONZE_RC2_BUILD143.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 144 — 28.07.2026.144** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kök güven sağlayıcısına bağlı HTTPS uç noktası profili; Birincil ve isteğe bağlı geçiş TLS SPKI SHA-256 pini; En fazla 14 günlük çift-pin geçiş penceresi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD144.md`, `BUILD_STATUS_BRONZE_RC2_BUILD144.md`, `BUILD144_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD144_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 145 — 28.07.2026.145** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Periyodik güvenli iptal listesi senkronizasyonu, kontrollü geri çekilme direnci, artan geri çekilme süresi ve kullanıcı bildirimleri eklendi
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD145.md`, `BUILD145_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD145_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 146 — 28.07.2026.146** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Renderer dosya yolu ve içerik gönderemez; seçim main process iletişim kutusundadır; 25 MiB, normal dosya, .json, katı UTF-8 ve NUL reddi uygulanır; Bilinmeyen alanlar, kırık referanslar, yinelenen kimlikler ve geçersiz değerler reddedilir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD146.md`, `BUILD_STATUS_BRONZE_RC2_BUILD146.md`, `BUILD146_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD146_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-29

- [x] **Build 147 — 29.07.2026.147** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Üç görünüm için sınırlı ve ölçümlü read-model API’leri eklendi; Offset yerine kararlı anahtar tabanlı imleç sayfalaması kullanıldı; Varsayılan 80, en fazla 200 kayıt sınırı uygulandı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD147.md`, `BUILD_STATUS_BRONZE_RC2_BUILD147.md`, `BUILD147_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD147_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 148 — 29.07.2026.148** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kritik yeni IPC kanalları için merkezi, kanal bazlı argüman sözleşmesi eklendi; Bilinmeyen nesne alanları, fazla argümanlar, hatalı türler ve sınır dışı sayfa; Ham HTTPS iptal listesi renderer API’sinden ve preload köprüsünden kaldırıldı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD148.md`, `BUILD_STATUS_BRONZE_RC2_BUILD148.md`, `BUILD148_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD148_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 149 — 29.07.2026.149** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Electron masaüstü workspace'inden kullanılmayan doğrudan esbuild 0.25.12; Esbuild 0.25.12 kurulum onayı ve lockfile platform kayıtları temizlendi; Lockfile bütünlüğü ve resmî tedarik kökeni kontrolleri korundu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD149.md`, `BUILD_STATUS_BRONZE_RC2_BUILD149.md`, `BUILD149_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD149_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 150 — 29.07.2026.150** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Hash ve sürüm bağlı npm cache paketi otomatik içe aktarma; Doğrulanmış cache ile çevrimdışı npm ci; Kurulum betiklerini kapatan güvenli temiz kurulum politikası
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD150.md`, `BUILD_STATUS_BRONZE_RC2_BUILD150.md`, `BUILD150_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD150_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 151 — 29.07.2026.151** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kilit dosyasına bağlı npm bağımlılık edinme planı; Bütünlük adresli ve sürdürülebilir tarball staging alanı; Resmî npm kaynağından retry/backoff ile bundle üretimi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD151.md`, `BUILD_STATUS_BRONZE_RC2_BUILD151.md`, `BUILD151_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD151_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 152 — 29.07.2026.152** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: npm-cache:accept-bundle komutu; ZIP ve dosya adına bağlı SHA-256 yan dosyası doğrulaması; Aktif lockfile ve paket sürümüyle tam transfer bundle doğrulaması
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD152.md`, `BUILD_STATUS_BRONZE_RC2_BUILD152.md`, `BUILD152_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD152_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 153 — 29.07.2026.153** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: validate:rc2:accepted-cache komutu; Kabul pointerı, makbuz, ZIP, lockfile ve cache yeniden doğrulama katmanı; Doğrulanmış bundle ve makbuzun gate runner'a kontrollü aktarımı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD153.md`, `BUILD_STATUS_BRONZE_RC2_BUILD153.md`, `BUILD153_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD153_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 154 — 29.07.2026.154** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: npm-cache:create-handoff-request komutu; npm-cache:verify-handoff-request komutu; npm-cache:inspect-handoff-response komutu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD154.md`, `BUILD_STATUS_BRONZE_RC2_BUILD154.md`, `BUILD154_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD154_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 155 — 29.07.2026.155** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: data:getSnapshotSections IPC kanalı; graph ve timeline veri bölümleri; Renderer single-flight bölüm yükleme ve ekran hazırlık sınırı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD155.md`, `BUILD_STATUS_BRONZE_RC2_BUILD155.md`, `BUILD155_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD155_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 156 — 29.07.2026.156** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: catalog:listPeople, catalog:listEvents ve catalog:lookup IPC kanalları; Kişiler için ad + kimlik, olaylar için tarih + kimlik keyset sayfalama; Kullanıcı ve etkin filtre kapsamına bağlı SHA-256 katalog imleci
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD156.md`, `BUILD_STATUS_BRONZE_RC2_BUILD156.md`, `BUILD156_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD156_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 157 — 29.07.2026.157** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: FamilyMutationResultView ve hedefli revizyon sözleşmeleri; Kişi, ilişki, konum, olay ve bildirim mutasyonlarında tek-nesne sonuçları; Grafik, zaman tüneli, kişi kataloğu, olay kataloğu, dashboard, bildirim ve
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD157.md`, `BUILD_STATUS_BRONZE_RC2_BUILD157.md`, `BUILD157_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD157_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 158 — 29.07.2026.158** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kapsam, oturum çağı ve sıra numaralı AsyncWriteGuard; Mutasyon kimliği tekrar önleme ve anahtar bazlı MutationRevisionWatermark; Kişi/olay katalogları, aile ilişkili olayları, soy ağacı, zaman tüneli ve arşiv
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD158.md`, `BUILD_STATUS_BRONZE_RC2_BUILD158.md`, `BUILD158_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD158_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 159 — 29.07.2026.159** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bütün preload IPC çağrıları tek doğrulanmış invoke sarmalayıcısına geçirildi; Her çağrı renderer oturum kimliği, istek kimliği, oturum çağı, sıra numarası,; Ana süreç eski oturum çağını ve yinelenen istek kimliğini reddediyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD159.md`, `BUILD_STATUS_BRONZE_RC2_BUILD159.md`, `BUILD159_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD159_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 160 — 29.07.2026.160** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: IPC istekleri için merkezi IpcRequestLifecycleRegistry eklendi; Katalog, dashboard, sınırlı snapshot ve büyük veri okumaları latest-wins; Preload 30 saniyelik bounded okuma süresi ve 45 saniyelik güvenli ağ
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD160.md`, `BUILD_STATUS_BRONZE_RC2_BUILD160.md`, `BUILD160_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD160_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 161 — 29.07.2026.161** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Ağır ve iptal edilebilir IPC okumalarına admission/backpressure katmanı eklendi; Renderer başına en fazla dört etkileşimli/standart ağır okuma çalışır; Aynı ağır kanalda aynı anda en fazla bir iş çalışır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD161.md`, `BUILD_STATUS_BRONZE_RC2_BUILD161.md`, `BUILD161_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD161_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 162 — 29.07.2026.162** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aynı kapsamlı eşzamanlı salt IPC okumaları preload'da tek yürütmede birleştirildi; Ana sürece sender-isolated, kısa TTL'li ve boyutu sınırlı sonuç cache'i eklendi; Paylaşım anahtarı oturum, epoch, kanal, revizyon ve kanonik argümanlara bağlandı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD162.md`, `BUILD_STATUS_BRONZE_RC2_BUILD162.md`, `BUILD162_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD162_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 163 — 29.07.2026.163** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: IPC kanalları için 60 dakikalık gizlilik güvenli performans telemetrisi eklendi; Kanal başına örnek ve toplam kanal sayısı sınırlandı; p95 yanıt süresi, p95 kuyruk beklemesi ve cache hit oranı hesaplandı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD163.md`, `BUILD_STATUS_BRONZE_RC2_BUILD163.md`, `BUILD163_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD163_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 164 — 29.07.2026.164** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: IPC telemetrisi fail-closed adaptif kaynak bütçelerine bağlandı; Baseline, guarded ve restricted çalışma modları eklendi; Eşzamanlılık, kuyruk, TTL, cache kayıt ve sonuç boyutu sınırları baskıda daraltılıyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD164.md`, `BUILD_STATUS_BRONZE_RC2_BUILD164.md`, `BUILD164_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD164_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 165 — 29.07.2026.165** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Adaptif IPC bütçeleri userData/runtime-state altında kalıcı hâle getirildi; Atomik JSON durum dosyası ve SHA-256 zincirli JSONL karar günlüğü eklendi; Durum uygulama sürümü ve adaptif politika parmak izine bağlandı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD165.md`, `BUILD_STATUS_BRONZE_RC2_BUILD165.md`, `BUILD165_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD165_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 166 — 29.07.2026.166** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Adaptif IPC bütçesi yetkili kullanıcı tarafından onaylı biçimde baseline moda sıfırlanabilir; gizlilik güvenli SHA-256 tanı paketi dışa aktarılır ve karantina dosyaları yaş/adet bütçesiyle sınırlandırılır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD166.md`, `BUILD_STATUS_BRONZE_RC2_BUILD166.md`, `BUILD166_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD166_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 167 — 29.07.2026.167** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Tek kullanımlık, işlem türüne bağlı ve kimlik bağlamıyla doğrulanan adaptif IPC bakım oturumları eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD167.md`, `BUILD_STATUS_BRONZE_RC2_BUILD167.md`, `BUILD167_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD167_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 168 — 29.07.2026.168** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Adaptif IPC bakım işlemleri yalnız etkin oturumlu aile yöneticisi ve güvenilir cihaz için açılır; arayüz yetki durumunu fail-closed gösterir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD168.md`, `BUILD_STATUS_BRONZE_RC2_BUILD168.md`, `BUILD168_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD168_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 169 — 29.07.2026.169** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Adaptif IPC bakım oturumları, parola ve etkinse TOTP ile güçlü yeniden doğrulama yapılmadan açılamaz; kimlik bilgileri oturum, günlük ve tanı verilerinden ayrılır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD169.md`, `BUILD_STATUS_BRONZE_RC2_BUILD169.md`, `BUILD169_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD169_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 170 — 29.07.2026.170** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Adaptif IPC bakımında güçlü yeniden doğrulama denemeleri oturum bağlamında sınırlandırıldı; beş başarısız denemede beş dakikalık geçici kilit uygulanır ve arayüz kalan deneme ile bekleme durumunu fail-closed gösterir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD170.md`, `BUILD_STATUS_BRONZE_RC2_BUILD170.md`, `BUILD170_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD170_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 171 — 29.07.2026.171** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Adaptif IPC bakım yeniden doğrulama sayaçları ve geçici kilit, işletim sistemi sır korumasıyla şifrelenmiş atomik durumda yeniden başlatmalar arasında korunur; bozuk kayıt karantinaya alınır ve beş dakikalık güvenli toparlanma kilidi uygulanır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD171.md`, `BUILD_STATUS_BRONZE_RC2_BUILD171.md`, `BUILD171_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD171_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 172 — 29.07.2026.172** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: İşletim sistemi korumalı bakım yeniden doğrulama durumu cihaz kimliği özetine bağlandı; geçici koruma kesintileri kaydı korur, farklı cihaz/sağlayıcı ve çözme hataları sınıflandırılır, eski şema güvenli biçimde yükseltilir ve silme yaşam döngüsü sınırlandırılır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD172.md`, `BUILD_STATUS_BRONZE_RC2_BUILD172.md`, `BUILD172_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD172_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 173 — 29.07.2026.173** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bakım kilidi için ayrı kalıcı deneme sayacına sahip, güçlü doğrulamalı ve açık onaylı yetkili kurtarma akışı
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD173.md`, `BUILD_STATUS_BRONZE_RC2_BUILD173.md`, `BUILD173_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD173_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 174 — 29.07.2026.174** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bakım kilidi kurtarma sonrasında tüm bakım oturumları sonlandırılır, kullanıcı oturumu kapatılır, güvenilir cihaz yeniden değerlendirmesi zorunlu tutulur ve 15 dakikalık kalıcı soğuma süresi uygulanır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD174.md`, `BUILD_STATUS_BRONZE_RC2_BUILD174.md`, `BUILD174_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD174_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 175 — 29.07.2026.175** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bakım kilidi kurtarma sonrası hesap güvenlik dönemi ilerletildi; eski güvenilir cihaz bağları atomik olarak iptal edildi ve yeniden yetkilendirme zorunlu tutuldu
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD175.md`, `BUILD_STATUS_BRONZE_RC2_BUILD175.md`, `BUILD175_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD175_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-30

- [x] **Build 176 — 30.07.2026.176** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Güvenlik dönemi sonrası kontrollü cihaz yeniden yetkilendirme, eski oturum reddi ve Ed25519 imzalı güvenlik olayı makbuzu eklendi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD176.md`, `BUILD_STATUS_BRONZE_RC2_BUILD176.md`, `BUILD176_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD176_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 177 — 30.07.2026.177** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Güvenlik, cihaz yeniden yetkilendirme, imzalı makbuz, denetim, yedekleme ve veri yaşam döngüsü işlemleri ayrı Güvenlik Merkezi menüsüne bağlandı; renderer bileşen sınırı düzeltildi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD177.md`, `BUILD_STATUS_BRONZE_RC2_BUILD177.md`, `BUILD177_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD177_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 178 — 30.07.2026.178** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Makbuz arşivi 0600, geçici wx dosya, fsync ve atomik yeniden adlandırmayla yazılır; Dosya 2 MiB, geçmiş 256 kayıtla sınırlandırılır; Ham hesap kimliği yerine SHA-256 hesap parmak izi kullanılır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD178.md`, `BUILD_STATUS_BRONZE_RC2_BUILD178.md`, `BUILD178_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD178_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 179 — 30.07.2026.179** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aktif sürüm kanalına bağlı merkezi menü renk tokenları; Bronze için bakır/bronz, Silver için gümüş, Gold için altın menü görünümü; Sol menü, profil menüsü, komut paleti, ikonlar, hover ve seçili durumların aynı kanal renginden beslenmesi
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD179.md`, `BUILD_STATUS_BRONZE_RC2_BUILD179.md`, `BUILD179_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD179_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 180 — 30.07.2026.180** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Makine tarafından okunur katı ürün yaşam döngüsü politikası; Domain katmanında yeni ürün geliştirmesini yalnız Bronze’a izin veren doğrulama API’si; Silver ve Gold çalışma türlerini yeni ürün geliştirmesine kapatan sözleşme
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD180.md`, `BUILD_STATUS_BRONZE_RC2_BUILD180.md`, `BUILD180_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD180_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 181 — 30.07.2026.181** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Bekleyen imzalı iptal listesi ve eşitleme durumu, işletim sistemi korumalı atomik dosyada saklanır; Bozuk veya koruma sağlayıcısı uyuşmayan durum karantinaya alınır; Kaynak profili, TLS pini veya etkinlik durumu değişirse bekleyen liste geri çekilir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD181.md`, `BUILD_STATUS_BRONZE_RC2_BUILD181.md`, `BUILD181_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD181_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 182 — 30.07.2026.182** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Yeni haricî kanıt sağlayıcısı kök Ed25519 anahtarı için kurum dışı çift kanıtlı güven töreni; Resmî tüzel kişi kimliği ve anahtar parmak izi için birbirinden farklı iki kanıt referansı; Bağımsız kanaldan alınan tam SHA-256 parmak izinin gerçek Ed25519 açık anahtarıyla birebir karşılaştırılması
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD182.md`, `BUILD_STATUS_BRONZE_RC2_BUILD182.md`, `BUILD182_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD182_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 183 — 30.07.2026.183** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Saklama süresi dolan imha tombstone kayıtları için otomatik temiz tam yedek yeniden yazımı; Veritabanında kalıcı politika, çalışma sahipliği, sonuç, hata ve sonraki deneme durumu; Migrasyon 29: REVISION-183-AUTOMATIC-CLEAN-BACKUP-REWRITE
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD183.md`, `BUILD_STATUS_BRONZE_RC2_BUILD183.md`, `BUILD183_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD183_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 184 — 30.07.2026.184** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: SQLite sonuçlandırma sorgusundaki 10 bağlayıcı / 9 değer kusuru düzeltildi; Migrasyon 30 ile kalıcı temiz yedek çalışma defteri eklendi; Politika ve çalışma defteri aynı unit-of-work içinde atomik sonuçlandırılıyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD184.md`, `BUILD_STATUS_BRONZE_RC2_BUILD184.md`, `BUILD184_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD184_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 185 — 30.07.2026.185** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Yayılım completedAt değerinin işlem başında üretilmesi kaldırıldı; Başlangıç duvar saati, performance.now() monotonik başlangıcıyla eşlendi; Her hedef karantina zamanı gerçek karantina noktasında üretiliyor
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD185.md`, `BUILD_STATUS_BRONZE_RC2_BUILD185.md`, `BUILD185_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD185_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 186 — 30.07.2026.186** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Başarı ve kısmi temiz-yedek çalışma sonucu propagation completedAt değerine bağlandı; Başarı/kısmi sonuç için propagationRunId zorunlu hale getirildi; Bağlı propagation kaydı bulunmuyorsa sonuçlandırma reddedilir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD186.md`, `BUILD_STATUS_BRONZE_RC2_BUILD186.md`, `BUILD186_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD186_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 187 — 30.07.2026.187** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kesinti kurtarma zamanı kalıcı çalışma başlangıcından önce olamayacak biçimde; Sistem saati geri alınmışsa kayıtlı başlangıç güvenli zaman tabanı olur; 360 dakikalık otomatik geri çekilme güvenli kurtarma tamamlanmasından başlar
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD187.md`, `BUILD_STATUS_BRONZE_RC2_BUILD187.md`, `BUILD187_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD187_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 188 — 30.07.2026.188** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Gelecekteki nextAttemptAt güvenli saat tabanına katılmaz; backoff erkenden; Repository güvenli başlangıç, sayaçlar ve saklama kesimi eşleşmesini yeniden; Bozuk veya geriye giden doğrudan SQLite yazımı fail-closed reddedilir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD188.md`, `BUILD_STATUS_BRONZE_RC2_BUILD188.md`, `BUILD188_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD188_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 189 — 30.07.2026.189** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Kullanıcı ayarı çalışma ortasında kronolojiyi ileri taşıyamaz; Kesinti kurtarması ileri defter zamanı nedeniyle running durumda kilitlenmez; Çelişkili terminal durum, sonuç, hata veya yeniden deneme yazımı fail-closed reddedilir
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD189.md`, `BUILD_STATUS_BRONZE_RC2_BUILD189.md`, `BUILD189_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD189_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-07-31

- [x] **Build 190 — 31.07.2026.190** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: İleri/geri sistem saati sıçraması terminal zamanını veya geri çekilmeyi bozamaz; Geçersiz/geriye giden monotonik saat sonuçlandırmayı fail-closed reddeder; Başarı ve kısmi sonuçlarda bağlı propagation tamamlanma zamanı yetkili kalır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD190.md`, `BUILD_STATUS_BRONZE_RC2_BUILD190.md`, `BUILD190_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD190_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 191 — 31.07.2026.191** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Politika ve çalışma defteri retry zamanı terminal zaman + doğru tetikleyici gecikmesi olmak zorundadır; Dört yeni SQLite tetikleyicisi doğrudan yanlış gecikme yazımını fail-closed reddeder; Deferred 30 dakika, success ise retry olmadan kalır
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD191.md`, `BUILD_STATUS_BRONZE_RC2_BUILD191.md`, `BUILD191_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD191_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 192 — 31.07.2026.192** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Manuel çalışma mevcut geri çekilme süresini, tek running sahipliğini ve saklama kesimini atlayamaz; Politika manuel çalışma sonunda da enabled=false değerini korur; Migrasyon 36, devre dışı politika altında otomatik running durumunu doğrudan SQLite yazımında reddeder
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD192.md`, `BUILD_STATUS_BRONZE_RC2_BUILD192.md`, `BUILD192_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD192_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 193 — 31.07.2026.193** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aktif çalışan defterin kimliği/tetikleyicisi değiştirilemez ve satır silinemez; Tek running indeksi yetim satırla kilitlenemez; Geçerli claim, terminal tamamlama ve kesinti kurtarma davranışları korunur
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD193.md`, `BUILD_STATUS_BRONZE_RC2_BUILD193.md`, `BUILD193_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD193_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 194 — 31.07.2026.194** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Temiz-yedek claim sahipliği tek kullanımlık kalıcı rezervasyonla politika ve çalışma defterine bağlandı
  - Kanıt: `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 195 — 31.07.2026.195** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aktif temiz-yedek politika ve çalışma defteri sahiplik anlık görüntüsü terminal geçişe kadar değiştirilemez
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD195.md`, `BUILD_STATUS_BRONZE_RC2_BUILD195.md`, `BUILD195_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD195_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 196 — 31.07.2026.196** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aktif temiz-yedek çalışması sırasında otomatik etkinlik, saklama günü ve geri çekilme süreleri terminal geçişe kadar değiştirilemez
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD196.md`, `BUILD_STATUS_BRONZE_RC2_BUILD196.md`, `BUILD196_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD196_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 197 — 31.07.2026.197** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Politika-only terminal geçişi reddedilir; Terminal çalışma defteri politikayı aynı SQL cümlesinde sonuçlandırır; Terminal cümlesinde çalışma kimliği ve iş yükü anlık görüntüsü değiştirilemez
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD197.md`, `BUILD_STATUS_BRONZE_RC2_BUILD197.md`, `BUILD197_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD197_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 198 — 31.07.2026.198** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Terminal temiz-yedek kayıtlarının tamamlanma zamanı başlangıçtan önce olamaz. Normal terminal geçiş ve kesinti kurtarma insert yolları SQLite düzeyinde korunur
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD198.md`, `BUILD_STATUS_BRONZE_RC2_BUILD198.md`, `BUILD198_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD198_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 199 — 31.07.2026.199** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Başarısız, dikkat, ertelenmiş, kesilmiş veya çalışan temiz-yedek kayıtlarının ilgisiz propagation sonucuna bağlanması engellendi; başarı ve kısmi sonuçlarda propagation kimliği zorunlu tutuldu.
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD199.md`, `BUILD_STATUS_BRONZE_RC2_BUILD199.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 200 — 31.07.2026.200** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Temiz-yedek başarı ve kısmi sonuçlarının yalnız aynı durumdaki propagation sonucuna bağlanması sağlandı; repository ve SQLite migrasyon 44 ile durum ikamesi fail-closed kapatıldı.
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD200.md`, `BUILD_STATUS_BRONZE_RC2_BUILD200.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 201 — 31.07.2026.201** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Aynı propagation sonucu yalnız bir temiz-yedek çalışma kaydı tarafından kullanılabilir
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD201.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 202 — 31.07.2026.202** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Temiz-yedek çalışma kaydına bağlanan propagation kimliği silinemez veya değiştirilemez
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD202.md`, `artifacts/manifests/VERSION_LEDGER.json`
### 2026-08-01

- [x] **Build 203 — 01.08.2026.203** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 203, terminal temiz-yedek çalışma kaydına bağlanan propagation kanıtının sonradan değiştirilmesini engeller
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD203.md`, `BUILD_STATUS_BRONZE_RC2_BUILD203.md`, `BUILD203_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD203_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 204 — 01.08.2026.204** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 204, SQLite REPLACE çatışma çözümünün bağlı propagation kanıtı değişmezliğini atlamasını engeller
  - Kanıt: `RELEASE_NOTES_BRONZE_RC2_BUILD204.md`, `BUILD_STATUS_BRONZE_RC2_BUILD204.md`, `BUILD204_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD204_DELIVERY_VALIDATION_REPORT.md`, `artifacts/manifests/VERSION_LEDGER.json`
- [x] **Build 205 — 01.08.2026.205** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: 20 Temmuz 2026’dan itibaren bütün buildleri ve kalan işleri tek yetkili ana defterde birleştiren; her buildde güncelleme ve build sonrası durum bildirimi zorunluluğu getiren süreklilik yönetişimi eklendi.
  - Kanıt: `docs/17_MASTER_BUILD_LEDGER.md`, `config/master-build-ledger.json`, `config/master-build-ledger-policy.json`, `scripts/verify-master-build-ledger.mjs`, `scripts/update-master-build-ledger.mjs`, `BUILD_STATUS_BRONZE_RC2_BUILD205.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD205.md`, `BUILD205_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD205_DELIVERY_VALIDATION_REPORT.md`
- [x] **Build 206 — 01.08.2026.206** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: 105 maddelik bağlayıcı proje kural seti Ana Build Defteri içine alındı; yeni sohbet ve her build başlangıcında kural seti SHA-256 kabulü zorunlu hale getirildi.
  - Kanıt: `docs/17_MASTER_BUILD_LEDGER.md`, `config/master-build-ledger.json`, `config/master-build-ledger-policy.json`, `scripts/verify-master-build-ledger.mjs`, `scripts/update-master-build-ledger.mjs`, `scripts/set-workspace-version.mjs`, `scripts/verify-build206-project-rules-contract.mjs`, `docs/10_MASTER_DECISION_REGISTER.md`, `docs/adr/ADR-079-project-rules-mandatory-startup.md`, `BUILD_STATUS_BRONZE_RC2_BUILD206.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD206.md`, `BUILD206_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD206_DELIVERY_VALIDATION_REPORT.md`
- [x] **Build 207 — 01.08.2026.207** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Her build sonu sohbet bağlam kapasitesi tahmini zorunlu kılındı; %85-89 uyarı ve %90+ istisnasız yeni-sohbet devir kapısı ile zorunlu handoff promptu yönetişimi eklendi.
  - Kanıt: `docs/17_MASTER_BUILD_LEDGER.md`, `config/master-build-ledger.json`, `config/master-build-ledger-policy.json`, `scripts/update-master-build-ledger.mjs`, `scripts/set-workspace-version.mjs`, `scripts/verify-build207-conversation-context-handoff-contract.mjs`, `artifacts/validation/build207-conversation-context-handoff-contract.json`, `docs/10_MASTER_DECISION_REGISTER.md`, `docs/decisions/DEC-097-conversation-context-capacity-handoff-gate.md`, `docs/adr/ADR-080-conversation-context-capacity-handoff-gate.md`, `BUILD_STATUS_BRONZE_RC2_BUILD207.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD207.md`
- [x] **Build 208 — 01.08.2026.208** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 208 tamamlandı: Proje Anayasası V3 140 bağlayıcı kurala yükseltildi; 20.07.2026 provenance sınırı, marka-only kimlik, Anadolu parsı UI baseline, production boş başlangıç, aktif sürüm taraması, ilerleme/ETA, Artifact Index ve Master DOCX/PDF kapanışı fail-closed yönetişime bağlandı.
  - Kanıt: `docs/17_MASTER_BUILD_LEDGER.md`, `docs/18_PROJECT_CONSTITUTION_V3.md`, `docs/decisions/DEC-098-project-constitution-v3.md`, `docs/adr/ADR-081-project-constitution-v3-governance.md`, `config/project-constitution.json`, `config/ui-visual-reference-manifest.json`, `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_BUILD208.png`, `PROJECT_ARTIFACT_INDEX.md`, `docs/current/MASTER_PROJECT_DOCUMENTATION_BUILD208.docx`, `docs/current/MASTER_PROJECT_DOCUMENTATION_BUILD208.pdf`, `BUILD_STATUS_BRONZE_RC2_BUILD208.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD208.md`
- [x] **Build 209 — 01.08.2026.209** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 209 tamamlandı: güvenli ilk kullanım, zorunlu TOTP/kurtarma, Apple/Google/Microsoft kimlik sağlayıcı mimarisi, giriş öncesi AES-256-GCM kullanıcı veri kasası, parola+Windows cihaz bağı, logout/timeout/quit yeniden mühürleme ve uygulama içi güvenli arşiv önizlemesi Anayasa V4 ile bağlandı.
  - Kanıt: `artifacts/validation/build209-secure-onboarding-vault-contract.json`, `artifacts/validation/build209-user-data-vault-runtime.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`, `artifacts/validation/build209-renderer-syntax.json`, `artifacts/validation/build209-project-provenance.json`, `docs/18_PROJECT_CONSTITUTION_V4.md`, `docs/decisions/DEC-099-secure-onboarding-and-user-data-vault.md`, `docs/adr/ADR-082-secure-onboarding-user-data-vault.md`, `BUILD_STATUS_BRONZE_RC2_BUILD209.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD209.md`, `BUILD209_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD209_DELIVERY_VALIDATION_REPORT.md`
- [x] **Build 210 — 01.08.2026.210** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 210 tamamlandı: terminal temiz-yedek çalışma defteri UPDATE, DELETE ve INSERT OR REPLACE yeniden yazımına karşı SQLite düzeyinde değişmez hale getirildi; no-op UPDATE ve running→terminal akışı korundu.
  - Kanıt: `packages/database/src/family-database-migrations.ts`, `artifacts/validation/build210-clean-rewrite-terminal-ledger-immutability-contract.json`, `artifacts/validation/build210-clean-rewrite-terminal-ledger-immutability-sqlite-runtime.json`, `docs/CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1.md`, `docs/decisions/DEC-100-clean-backup-terminal-ledger-immutability.md`, `docs/adr/ADR-083-clean-backup-terminal-ledger-immutability.md`, `BUILD_STATUS_BRONZE_RC2_BUILD210.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD210.md`, `BUILD210_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD210_DELIVERY_VALIDATION_REPORT.md`, `docs/17_MASTER_BUILD_LEDGER.md`
- [x] **Build 211 — 01.08.2026.211** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 211 tamamlandı: clean npm ci yürütme ortamında resmî registry/kabul edilmiş cache erişimi olmadığı için FAIL kaldı; lockfile değiştirilmeden 117 tarball acquisition planı, doğrulanmış bağlı-makine handoff isteği ve fail-closed dependency readiness sözleşmesi oluşturuldu. OPEN-002 gerçek npm ci PASS alınana kadar OPEN; uygulanabilir Bronze Final blokajları OPEN-021 Build212 ve OPEN-022 Build213 olarak öne alındı.
  - Kanıt: `artifacts/validation/build211-dependency-install-readiness-contract.json`, `artifacts/validation/build211-clean-npm-ci.json`, `artifacts/validation/build211-npm-dependency-acquisition-plan-report.json`, `artifacts/validation/build211-npm-dependency-handoff-request-creation.json`, `docs/NPM_CLEAN_INSTALL_BUILD211_HANDOFF.md`, `docs/decisions/DEC-101-clean-install-external-access-handoff.md`, `docs/adr/ADR-084-clean-install-external-access-handoff.md`, `BUILD_STATUS_BRONZE_RC2_BUILD211.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD211.md`
- [x] **Build 212 — 01.08.2026.212** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 212 tamamlandı: kullanıcı onaylı Anadolu parsı logolu açık-tema UI Görsel Referans Manifestosu yanlış koyu aktif baseline yerine SHA-256 ile sabitlenmiş tek görsel otorite olarak düzeltildi; baseline drift kapısı eklendi ve tarihsel Build208–211 kanıtları değiştirilmedi.
  - Kanıt: `docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png`, `config/ui-visual-reference-manifest.json`, `artifacts/validation/build212-ui-visual-baseline-provenance-contract.json`, `docs/decisions/DEC-102-approved-ui-visual-baseline-correction.md`, `docs/adr/ADR-085-approved-ui-visual-baseline-hash-pinning.md`, `BUILD_STATUS_BRONZE_RC2_BUILD212.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD212.md`
- [x] **Build 213 — 01.08.2026.213** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 213 tamamlandı: aktif kullanıcı SQLite verisi süreç belleğine taşındı; kalıcı AES-256-GCM kasa, 30 saniyelik encrypted checkpoint ve Windows EFS fail-closed bounded staging uygulandı. Kaynak ve non-Windows runtime kanıtları PASS; gerçek Windows EFS/paketli kanıt NOT_RUN olduğu için OPEN-021 IN_PROGRESS kalır.
  - Kanıt: `docs/decisions/DEC-103-memory-resident-user-data-session.md`, `docs/adr/ADR-086-memory-resident-sqlite-windows-efs-staging.md`, `docs/security/IN_USE_USER_DATA_PROTECTION_BUILD213.md`, `artifacts/validation/build213-in-use-data-protection-contract.json`, `artifacts/validation/build213-volatile-user-data-runtime.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`, `BUILD_STATUS_BRONZE_RC2_BUILD213.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD213.md`, `BUILD213_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD213_DELIVERY_VALIDATION_REPORT.md`
- [x] **Build 214 — 01.08.2026.214** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build 214 kaynak geliştirme kaydı tamamlandı: OPEN-022 Protected Side Artifact katmanı AES-256-GCM korumalı .pplog/.pptdiag/.pptreport kapsayıcıları, cihaz-korumalı yan-artifact anahtarı ve volatil browser/cache/temp/crash alanlarıyla yeniden kuruldu. Hedefli contract/runtime/integration ve kontrollü TypeScript kanıtları PASS; gerçek Windows safeStorage/DPAPI ve paketli Electron NOT_RUN. V5 kaynak-kurtarma hash farkı açık kanıt olarak korunur; nihai teslim ilanı source preflight/integrity/archive/reproducibility/attestation PASS sonrasındadır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD214.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD214.md`, `docs/decisions/DEC-104-protected-side-artifact-encryption.md`, `docs/adr/ADR-087-protected-side-artifact-boundary.md`, `docs/decisions/DEC-105-pr171-atomic-work-segmentation.md`, `docs/adr/ADR-088-pr171-stepwise-validation-persistence.md`, `artifacts/validation/build214-v5-rule-hash-recovery.json`, `artifacts/validation/build214-open022-contract.json`, `artifacts/validation/build214-protected-side-artifact-runtime.json`, `artifacts/validation/build214-side-artifact-integration-runtime.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`, `docs/18_PROJECT_CONSTITUTION_V5.md`, `docs/18_PROJECT_CONSTITUTION_V5.json`, `docs/security/PROTECTED_SIDE_ARTIFACTS_BUILD214.md`, `artifacts/validation/build214-pr171-contract.json`, `artifacts/validation/build214-project-provenance.json`, `artifacts/validation/build214-active-version-sweep.json`, `artifacts/validation/active-delivery-documents.json`, `artifacts/validation/build214-documentation-closure.json`, `BUILD214_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD214_DELIVERY_VALIDATION_REPORT.md`
- [x] **Build 215 — 01.08.2026.215** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build215 Windows security evidence harness kaynak geliştirmesi tamamlandı: gerçek Windows EFS, Electron safeStorage/DPAPI ve development+packaged evidence zinciri güncellendi; source contract ve kontrollü TypeScript PASS. Bu non-Windows ortamında gerçek Windows EFS/DPAPI, paketli Electron ve installer NOT_RUN bırakıldı; OPEN-021 ve OPEN-022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD215.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD215.md`, `BUILD215_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD215_DELIVERY_VALIDATION_REPORT.md`, `artifacts/validation/build215-windows-security-evidence-contract.json`, `artifacts/validation/build215-validation-boundary.json`, `docs/decisions/DEC-106-windows-security-evidence-harness.md`, `docs/adr/ADR-089-real-windows-efs-dpapi-packaged-evidence.md`, `docs/security/WINDOWS_SECURITY_EVIDENCE_BUILD215.md`
- [x] **Build 216 — 01.08.2026.216** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build216 tamamlandı: Windows kanıt bundle manifest/SHA üretimi, exact-source binding, platform-bağımsız evidence intake ve valid/tamper fail-closed runtime doğrulaması eklendi. Kaynak contract 33/33 ve intake runtime 6/6 PASS; gerçek Windows EFS/DPAPI/paketli Electron/installer ve gerçek evidence intake NOT_RUN olduğundan OPEN-021/OPEN-022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD216.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD216.md`, `BUILD216_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD216_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-107-windows-evidence-intake-source-binding.md`, `docs/adr/ADR-090-windows-evidence-intake-and-source-binding.md`, `docs/security/WINDOWS_EVIDENCE_INTAKE_BUILD216.md`, `artifacts/validation/build216-windows-evidence-intake-contract.json`, `artifacts/validation/build216-windows-evidence-intake-runtime.json`, `artifacts/validation/build216-validation-boundary.json`
- [x] **Build 217 — 01.08.2026.217** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build217 tamamlandı: OPEN-021 gerçek Windows kapanışı full RC2/Silver ve OPEN-022 kapsamından ayrıldı; EFS-only probe, development+installed/package lifecycle, tek tık runner, exact-source kanıt bundle ve fail-closed READY_TO_CLOSE verifier eklendi. Kaynak contract 30/30, tamper runtime 7/7 ve kontrollü TypeScript PASS. Gerçek Windows execution NOT_RUN olduğundan OPEN-021 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD217.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD217.md`, `BUILD217_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD217_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-108-open021-isolated-windows-closure-gate.md`, `docs/adr/ADR-091-open021-efs-only-real-windows-proof.md`, `docs/security/OPEN021_WINDOWS_CLOSURE_BUILD217.md`, `artifacts/validation/build217-open021-isolation-contract.json`, `artifacts/validation/build217-open021-result-runtime.json`, `artifacts/validation/build217-validation-boundary.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 218 — 01.08.2026.218** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build218 tamamlandı: OPEN-022 gerçek Windows safeStorage/DPAPI ve protected side-artifact kapanışı OPEN-021 ve Silver kapsamından ayrıldı; provider-ID ile gerçek DPAPI backend ayrımı düzeltildi; tek tık runner, development+installed/package lifecycle ve fail-closed READY_TO_CLOSE verifier eklendi. Kaynak isolation contract 38/38, tamper runtime 7/7, Build215 Windows regresyon 26/26, Build214 OPEN-022 regresyonları ve kontrollü TypeScript PASS. Gerçek Windows execution NOT_RUN olduğundan OPEN-021/OPEN-022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD218.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD218.md`, `BUILD218_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD218_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-109-open022-isolated-windows-closure-gate.md`, `docs/adr/ADR-092-open022-dpapi-protected-side-artifact-proof.md`, `docs/security/OPEN022_WINDOWS_CLOSURE_BUILD218.md`, `artifacts/validation/build218-open022-isolation-contract.json`, `artifacts/validation/build218-open022-result-runtime.json`, `artifacts/validation/build218-validation-boundary.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 219 — 01.08.2026.219** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build219 tamamlandı: OPEN-021 ve OPEN-022 gerçek Windows kapanışları tek Build219 source snapshotı, tek npm ci prerequisite, tek installer build/install/uninstall ve tek evidence bundle altında birleştirildi. Readiness iki OPEN için bağımsızdır; unified contract 42/42, valid/partial tamper runtime 7/7, Build217/218 regresyonları ve kontrollü TypeScript PASS. Gerçek Windows execution NOT_RUN olduğundan OPEN-021/022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD219.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD219.md`, `BUILD219_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD219_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-110-unified-bronze-windows-security-closure.md`, `docs/adr/ADR-093-unified-bronze-windows-security-lifecycle.md`, `docs/security/BRONZE_WINDOWS_SECURITY_CLOSURE_BUILD219.md`, `artifacts/validation/build219-bronze-security-unified-contract.json`, `artifacts/validation/build219-bronze-security-result-runtime.json`, `artifacts/validation/build219-validation-boundary.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
### 2026-08-02

- [x] **Build 220 — 02.08.2026.220** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build220 tamamlandı: exact-source Build219 gerçek Windows failure evidence incelendi; installer bootstrap eksikliği kaynak hatası olarak doğrulandı; root npm ci sonrasına isolated windows-packager bootstrap, builder CLI fail-closed kontrolü, PowerShell 5.1 UTF-8 BOM ve bounded stdout/stderr diagnostics eklendi. Build220 contract 47/47, runtime 7/7, Build219 regresyonları ve kontrollü TypeScript PASS. Gerçek Build220 Windows retry NOT_RUN olduğundan OPEN-021/022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD220.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD220.md`, `BUILD220_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD220_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-111-build219-windows-failure-bootstrap-remediation.md`, `docs/adr/ADR-094-windows-packager-bootstrap-and-ps51-evidence-encoding.md`, `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD220.md`, `artifacts/validation/build220-windows-failure-intake.json`, `artifacts/validation/build220-bronze-security-bootstrap-contract.json`, `artifacts/validation/build220-bronze-security-result-runtime.json`, `artifacts/validation/build220-validation-boundary.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 221 — 02.08.2026.221** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build221 tamamlandı: exact-source Build220 gerçek Windows failure evidence incelendi; installer TypeScript TS2307 hatalarının workspace package dist çıktıları üretilmeden package:win çalıştırılmasından kaynaklandığı doğrulandı; installer öncesine npm run build:packages ve 13 workspace paketi için dist/index.js + dist/index.d.ts fail-closed guard eklendi. Failure intake 18/18, workspace-build contract 66/66, dist guard runtime 2/2, unified result runtime 7/7 ve Build220 regresyonları PASS. Gerçek Build221 Windows retry NOT_RUN olduğundan OPEN-021/022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD221.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD221.md`, `BUILD221_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD221_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-112-build220-windows-failure-workspace-build-remediation.md`, `docs/adr/ADR-095-workspace-package-build-before-windows-package.md`, `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD221.md`, `artifacts/validation/build221-windows-failure-intake.json`, `artifacts/validation/build221-bronze-security-workspace-build-contract.json`, `artifacts/validation/build221-workspace-dist-guard-runtime.json`, `artifacts/validation/build221-bronze-security-result-runtime.json`, `artifacts/validation/build221-validation-boundary.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 222 — 02.08.2026.222** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build222 tamamlandı: exact-source Build221 gerçek Windows failure evidence incelendi; source integrity, npm ci, windows-packager bootstrap, workspace build ve dist guard PASS sonrasında installer Electron TypeScript derlemesinin preload.ts doğrudan globalThis.addEventListener erişiminde TS7017 ile durduğu doğrulandı. Dar rendererLifecycleTarget structural type adapter eklendi; beforeunload cancellation semantiği korundu. Failure intake 21/21, preload contract 18/18, ES2024-only TypeScript A/B 4/4, unified result runtime 7/7 ve Build221/220 regresyonları PASS. Gerçek Build222 Windows retry NOT_RUN olduğundan OPEN-021/022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD222.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD222.md`, `BUILD222_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD222_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-113-build221-windows-failure-preload-typescript-remediation.md`, `docs/adr/ADR-096-preload-global-lifecycle-typing.md`, `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD222.md`, `artifacts/validation/build222-windows-failure-intake.json`, `artifacts/validation/build222-preload-lifecycle-contract.json`, `artifacts/validation/build222-preload-typescript-ab-runtime.json`, `artifacts/validation/build222-bronze-security-result-runtime.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 223 — 02.08.2026.223** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build223 tamamlandı: exact-source Build222 gerçek Windows FAIL evidence incelendi; source integrity, npm ci, windows-packager bootstrap, workspace build ve dist guard PASS sonrasında installer preload CommonJS staging derlemesinin üç relative IPC modülünde TS2307 ve iki generic arrow noktasında TS7060 ile durduğu doğrulandı. Preload + üç local IPC bağımlılığı kontrollü CJS staging grafiğine alındı; staged IPC specifierları .cjs olarak yeniden yazıldı, .cts generic syntax normalize edildi ve iki preload generic invoker function declaration oldu. Failure intake 27/27, CJS graph contract 25/25, compile/tamper runtime 13/13, unified result runtime 7/7 ve Build222/221 regresyonları PASS. Gerçek Build223 Windows retry NOT_RUN olduğundan OPEN-021/022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD223.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD223.md`, `BUILD223_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD223_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-114-build222-windows-failure-preload-cjs-graph-remediation.md`, `docs/adr/ADR-097-preload-commonjs-staging-graph.md`, `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD223.md`, `artifacts/validation/build223-windows-failure-intake.json`, `artifacts/validation/build223-preload-cjs-graph-contract.json`, `artifacts/validation/build223-preload-cjs-graph-runtime.json`, `artifacts/validation/build223-bronze-security-result-runtime.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 224 — 02.08.2026.224** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build224 tamamlandı: exact-source Build223 gerçek Windows FAIL evidence incelendi; source integrity, npm ci, isolated packager bootstrap, workspace build/dist guard, Electron main/preload ve renderer build PASS sonrasında installer verify:installer adımının stale LICENSE_TR.rtf / LICENSE_TR.txt driftinde durduğu doğrulandı. LICENSE_TR.txt tek içerik kaynağı yapıldı; generation ve verification ortak deterministic RTF renderer'a bağlandı; frozen Build224 LICENSE_TR.rtf yeniden üretildi; package:win/package:win:dir kaynak snapshotını sessizce değiştirmeden verify:license-sync ile fail-closed kontrol eder. Failure intake 30/30, license sync contract 31/31, tamper runtime 13/13, Windows retry contract 46/46, unified result runtime 7/7 ve Build223/222/221/220 regresyonları PASS. Gerçek Build224 Windows retry NOT_RUN olduğundan OPEN-021/022 IN_PROGRESS kalır.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD224.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD224.md`, `BUILD224_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD224_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-115-build223-windows-failure-license-rtf-sync-remediation.md`, `docs/adr/ADR-098-deterministic-nsis-license-source-sync.md`, `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD224.md`, `artifacts/validation/build224-windows-failure-intake.json`, `artifacts/validation/build224-license-rtf-sync-contract.json`, `artifacts/validation/build224-license-rtf-sync-runtime.json`, `artifacts/validation/build224-bronze-security-license-remediation-contract.json`, `artifacts/validation/build224-bronze-security-result-runtime.json`, `artifacts/validation/package-source-typecheck.json`, `artifacts/validation/desktop-main-source-typecheck.json`
- [x] **Build 225 — 02.08.2026.225** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build225 tamamlandı: exact Build224 SHA ve tarihsel kaynak bütünlüğü korunarak kanıtlanmış OPEN-021 PowerShell yol aktarımı/EFS staging, OPEN-022 safeStorage davranışsal kanıt, fatal Electron startup non-zero tanı ve PR-172 platform-actual bağlam kök nedenleri düzeltildi. Focused contract/runtime/tamper/regresyon kontrolleri PASS. Codex yürütme kimliği gerçek DESKTOP-02GCVDE\Husey olmadığından development/installed Windows OPEN-021 ve OPEN-022 probe sonuçları NOT_RUN ve iki açık iş NOT_READY/IN_PROGRESS kaldı.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD225.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD225.md`, `BUILD225_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD225_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-116-build224-windows-security-root-cause-remediation.md`, `docs/adr/ADR-099-fail-closed-windows-efs-safestorage-startup-evidence.md`, `docs/decisions/DEC-117-pr172-platform-actual-context-hard-stop.md`, `docs/adr/ADR-100-platform-actual-conversation-capacity-gate.md`, `artifacts/validation/build225-open021-efs-contract.json`, `artifacts/validation/build225-open021-efs-runtime.json`, `artifacts/validation/build225-open022-safestorage-contract.json`, `artifacts/validation/build225-open022-safestorage-runtime.json`, `artifacts/validation/build225-fatal-startup-contract.json`, `artifacts/validation/build225-fatal-startup-runtime.json`, `artifacts/validation/build225-pr172-context-policy.json`, `artifacts/validation/build225-windows-retry-contract.json`, `artifacts/validation/build225-bronze-security-result-runtime.json`
- [x] **Build 226 — 02.08.2026.226** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build226, exact Build225 real Windows fresh-profile VAULT_INITIALIZATION root causeunu protected device identity initialization before device-bound maintenance restore order with fail-closed behavior olarak duzeltti; targeted and inherited regressions PASS, real Windows closure retry remains separate.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD226.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD226.md`, `BUILD226_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD226_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-118-build225-fresh-profile-device-identity-initialization-order.md`, `docs/adr/ADR-101-protected-device-identity-before-device-bound-maintenance-restore.md`, `docs/security/FRESH_PROFILE_DEVICE_IDENTITY_INITIALIZATION_BUILD226.md`, `artifacts/validation/build226-fresh-profile-startup-contract.json`, `artifacts/validation/build226-fresh-profile-startup-runtime.json`
- [x] **Build 227 — 02.08.2026.227** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build227 completed the four proven Build226 Windows root-cause remediations. Exact-source-bound real Windows development and installed OPEN-021/OPEN-022, CurrentUser DPAPI persistence, EFS staging/snapshot, installer/uninstaller lifecycle, zero-residue cleanup, evidence bundle integrity and independent closure verifier passed. Broader inherited Silver typecheck/unit/smoke failures remain explicitly open.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD227.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD227.md`, `BUILD227_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD227_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-119-build227-four-proven-windows-root-causes.md`, `docs/adr/ADR-102-build227-windows-persistence-and-closure-remediation.md`, `docs/security/WINDOWS_ROOT_CAUSE_REMEDIATION_BUILD227.md`, `artifacts/validation/build227-root-cause-contract.json`, `artifacts/validation/build227-dpapi-persistence-runtime.json`, `artifacts/validation/build227-bronze-security-windows-closure-result.json`
- [x] **Build 228 — 02.08.2026.228** · Bronze RC2 Active Development · Durum: `COMPLETED`
  - Yapılan: Build228 completed the governance-only official closure of OPEN-021 and OPEN-022. Both CLOSED records are bound to exact Build227 source ZIP SHA-256 131091a153cf3a7eaf78b62f1dc2696761b8bde79cd7e3206264e10cb672d2c0 and real Windows evidence ZIP SHA-256 efa151bb35b4ea0a027327052f735d42048f3e3c1f809175abf0cd5015549564. No security feature, PR-172 rule, historical evidence or Silver validation result changed.
  - Kanıt: `BUILD_STATUS_BRONZE_RC2_BUILD228.md`, `RELEASE_NOTES_BRONZE_RC2_BUILD228.md`, `BUILD228_ARCHITECTURE_VALIDATION_REPORT.md`, `BUILD228_DELIVERY_VALIDATION_REPORT.md`, `docs/decisions/DEC-120-build228-open021-open022-official-closure.md`, `docs/adr/ADR-103-build227-evidence-bound-bronze-open-closure.md`, `docs/security/BRONZE_OPEN021_OPEN022_CLOSURE_BUILD228.md`, `config/bronze-open-closure-status.json`, `artifacts/validation/build228-bronze-closure-contract.json`, `artifacts/validation/build228-open021-open022-closure-validation.json`

## Son build durum bildirimi

- Build: **228**
- Durum: **COMPLETED**
- Kayıt zamanı: **2026-08-02T20:02:11.708Z**
- Bildirim: Build228 COMPLETED: OPEN-021 CLOSED, OPEN-022 CLOSED; next official work is Silver OPEN-002. Build227 root TypeScript, unit/integration and blocking smoke remain FAIL.

---

Bu dosya `config/master-build-ledger.json` kaynağından üretilir. Elle yapılan ve JSON kaynağıyla eşleşmeyen değişiklikler doğrulama kapısında reddedilir.
