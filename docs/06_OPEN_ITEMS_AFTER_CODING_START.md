# Açık ve Ertelenmiş Maddeler — Build 183

**Aktif sürüm:** Bronze 04.08.2026.29

> 17.08.2026 güncellik bağı: Aşağıdaki Build228 ve önceki listeler tarihsel durumu korur. Güncel dış bağımlılıklar, 33-P–34-L kabul engelleri ve installer/başlangıç gerçeği `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md` içinde tek matriste tutulur.

## 17.08.2026 güncel Core Service ve dağıtım durumu

- **Yerel olarak kapatıldı:** Core Service gerçek ayrı utility companion sürecinde başlar; bağlantı yetkisi her açılışta yeni local named-pipe ve 48 baytlık token ile kurulur.
- **Yerel olarak kapatıldı:** Kalıcı politika imza anahtarı CurrentUser DPAPI korumalı yan-artifact içinde tutulur; bozuk veya değişmiş provisioning sessizce yenilenmez ve fail-closed reddedilir.
- **Yerel olarak kapatıldı:** Companion masaüstü ASAR paketinde `dist/core-service/companion.js` olarak bulunur; güncel `win-unpacked` uygulaması aynı profilde iki ardışık açılışta DPAPI `created`/`verified` ve güvenli renderer politikasıyla PASS vermiştir.
- **Açık — dış kaynak gerekli:** Production Authenticode kod imzalama sertifikası, beklenen yayıncı subject'i ve izinli sertifika thumbprint/SHA-256 değerleri sağlanmadı. Bu nedenle signed-only `package:win` kapısı bilinçli olarak installer üretmez.
- **Kısmi yerel PASS:** Eski `C:\\Program Files\\@pptdesktop` kurulumu kendi kaldırıcısıyla silindi; güncel imzasız yerel paket `C:\\Program Files\\PPT\\AYM` altına kuruldu. Masaüstü/Başlat kısayolları, kurulu dosya SHA-256 eşliği, yanıt veren ana pencere, renderer ve Core Service utility süreci doğrulandı.
- **Açık — dış/manuel kanıt gerekli:** Production Authenticode sertifikası ve signed installer; temiz işletim sistemi kurulumu, upgrade, repair, yeni kurulumun uninstall/veri koruma yaşam döngüsü, yeniden başlatma/güç kesintisi ve uzun süreli çalışma henüz doğrulanmadı.
- **Açık — mimari kapsam:** Windows SCM hizmeti, makine hesabı ACL sahipliği, politika imza anahtarı rotasyonu/iptali, çoklu node quorum/failover ve uzun süreli soak bu companion düzeltmesinin kapsamında değildir.
- **Kabul sonucu:** Yerel kaynak/build/unpacked-launch PASS; imzalı installer ve requirement PASS **değildir**.

## Build228 resmî Bronze kapanışı

- `OPEN-021 = CLOSED`
- `OPEN-022 = CLOSED`
- Kapanış kanıtı: exact Build227 source SHA-256 `131091a153cf3a7eaf78b62f1dc2696761b8bde79cd7e3206264e10cb672d2c0` ve Windows evidence SHA-256 `efa151bb35b4ea0a027327052f735d42048f3e3c1f809175abf0cd5015549564`
- Silver OPEN-002–OPEN-012 açık kalır; sıradaki resmî iş OPEN-002'dir.
- Build227 root TypeScript, unit/integration ve blocking smoke sonuçları `FAIL` olarak korunur.

## Promotion engelleyici

- Build 135 kaynaklarıyla gerçek Windows geliştirme ve paketli uygulama kanıtı
- Development açılışı ve iki süreçli DPAPI sentinel kanıtı
- Paketli Electron uygulamasının iki süreçli gerçek Windows açılışı
- Gerçek Windows ortamında cihaz kimliği legacy migration kanıtı
- Gerçek Windows ortamında TOTP legacy migration kanıtı
- Gerçek Windows ortamında açık arşiv kasa anahtarının DPAPI zarfına migration kanıtı
- Parola korumalı tam yedeğin farklı Windows cihazında kasa anahtarını yeniden sarma kanıtı
- Kurulum, kurulu uygulama açılışı ve kaldırmanın resmî yaşam döngüsü PASS kanıtı
- Final kaynak üzerinde gerçek Windows dosya sistemi, zorunlu yeniden başlatma ve elektrik kesintisi içeren yedek/restore provası
- Final kaynak üzerinde gerçek Windows renderer, ekran okuyucu, kontrast ölçümü, büyütülmüş metin taşması ve kritik kullanıcı akışı UAT kanıtı


## Build 136 ile kaynakta kapatılanlar

- Finans, sağlık, ilaç, aile sağlık geçmişi ve yaşam kayıtlarında merkezi yaşam döngüsü
- Geri alınabilir arşivleme ve normal listelerden gizleme
- Saklama süresi ve geri alma penceresi tanımlayan politikalar
- İki aşamalı kesin onay metni ve güçlü yeniden doğrulamalı kalıcı imha
- Hukuki/koruma bekletmesi
- İmha sonrası içeriksiz tombstone ve yedek yayılım uyarısı
- Nesne izinleri ve AI izinlerinin kaynakla birlikte temizlenmesi
- SQLite secure-delete ve WAL checkpoint en iyi çaba sınırı

## Build 136 sonrasında açık kalanlar

- Türkiye ve hedef kullanım ülkeleri için gerçek yasal saklama sürelerinin hukuk/gizlilik incelemesi
- Eski tam yedeklerdeki imha edilmiş kayıtların süre dolumunda otomatik yayılım/yeniden yazım politikası
- Gerçek Windows/SSD üzerinde adli kalıntı ve dosya sistemi snapshot sınırlarının doğrulanması
- Render edilmiş veri yaşam döngüsü ekranı UAT ve ekran okuyucu testi
## Build 135 ile kaynakta kapatılanlar

- Dijital kasa anahtarının açık 32 bayt yerel dosyada tutulması
- OS korumalı sürüm 2 kasa anahtarı zarfı
- Legacy açık anahtarın atomik ve geri alınabilir migration akışı
- Yarım migration açılış kurtarması
- Sağlayıcı uyuşmazlığı, zarf bozulması ve hash hatasında fail-closed davranış
- Tam yedek oluştururken taşınabilir ham anahtarın yalnız şifreli payload içinde kullanılması
- Geri yüklemede kasa anahtarının hedef cihaz OS korumasıyla yeniden sarılması
- Kasa anahtarı sağlayıcısı ile depolama yolu uyuşmazlığının reddedilmesi

## Build 133 ile kaynakta kapatılanlar

- finans ve sağlık nesne mahremiyeti: özel ve seçili kayıtların yalnız veri sahibi veya açık nesne izniyle erişilmesi
- Aile yöneticisi rolünün başka bir yetişkinin özel finans/sağlık verisine otomatik erişememesi
- Açık ret izninin sahiplik ve rol tabanlı erişimden önce uygulanması
- Yapay zekâ işlemesi için ayrı ve açık `ai_process` izni zorunluluğu

## Build 134 ile kaynakta kapatılanlar

- Standart, büyük ve çok büyük kalıcı metin ölçeği tercihi
- Yerel yüksek kontrast ve hareket azaltma tercihleri
- İşletim sistemi erişilebilirlik tercihlerini güvenli başlangıç değeri olarak kullanma
- Bölüm değişiminde ana içerik odağı ve Türkçe ekran okuyucu duyurusu
- Komut aramasında listbox/option semantiği ve roving klavye odağı
- Yukarı/aşağı, Home/End, Enter, Escape ve Tab odak tuzağı davranışı
- Kapanışta odağın önceki kontrole geri verilmesi
- Forced-colors, görünür odak ve 44 px minimum etkileşim hedefi
- Durum/hata mesajlarında polite/assertive canlı bölge politikası

## Silver/dağıtım öncesi

- Authenticode/kod imzalama sertifikası ve imzalı installer
- Büyük soy ağacı, arşiv ve zaman tüneli performans testleri
- Çocuk, yetişkin ve yaşlı kullanıcı UAT’leri
- Toplu ekran görüntüleri ve son kullanıcı kılavuzu
- Uzun süreli kararlılık ve felaket kurtarma provası

## Dış sağlayıcı/gelecek platform

- OneDrive üretim bağlantısı
- iCloud, Google Drive ve diğer bulut yedek adapterleri
- Harita ve rızaya bağlı canlı konum sağlayıcısı
- Sağlık, sigorta ve resmî kurum bağlantıları
- macOS, iPhone, iPad, Apple Watch ve Vision Pro istemcileri
- Apple/OIDC haricî kimlik sağlayıcıları

## Ürün/veri hazırlığı

- Gerçek aile verisi aktarım, doğrulama ve geri dönüş planı
- AI sağlayıcısı ve maliyet/mahremiyet sınırı
- Genel veri saklama, geri alınabilir silme ve kalıcı imha politikası
- Veri saklama ve güvenli imha politikalarının hukuk incelemesi
- Gold SBOM, lisans, gizlilik ve rollback paketi

Bu maddeler açıkça çözülmeden tamamlandı sayılmaz; ancak tek başına otomatik kanal
geçişi oluşturmaz.

## Build 137 ile kaynakta kapatılanlar

- Kalıcı imha tombstone kayıtlarının etkin yönetilen yedek hedeflerine yayılması
- Her hedefte önce yeni ve doğrulanmış şifreli tam yedek üretilmesi
- Yayılım sırasında normal retention temizliğinin devre dışı bırakılması
- Eski `.pptbackup` dosyalarının doğrudan silme yerine geri alınabilir karantinaya taşınması
- SHA-256, boyut ve tombstone parmak izi taşıyan dayanıklı karantina manifesti
- Bütün etkin hedefler başarılı olmadan `backupPropagationPending` işaretinin kaldırılmaması
- Manuel ve yönetilmeyen yedek kopyalarının açık risk uyarısı

## Build 137 sonrasında açık kalanlar

- Karantina dosyaları için hukuk/gizlilik onaylı saklama ve nihai imha süresi
- OneDrive, iCloud ve Google Drive sağlayıcılarının sürüm geçmişine imha yayılımı
- Çevrimdışı harici disk ve yönetilmeyen manuel yedeklerin kullanıcı teyitli envanteri
- Gerçek Windows dosya sistemi, bağlantısı kesilen harici disk ve bulut eşitleme hata provası


## Build 138 ile kaynakta kapatılanlar

- Yönetilen yedek karantinaları için varsayılan 90 günlük operasyonel saklama politikası
- Mevcut grupların `retainUntil` tarihini geriye dönük sessizce değiştirmeyen politika güncellemesi
- Karantina grubu bazında hukuki/koruma bekletmesi ve gerekçe kaydı
- Aile yöneticisi rolü ile parola ve etkinse TOTP güçlü yeniden doğrulama zorunluluğu
- Kayıt kimliğine bağlı kesin `KARANTİNA İMHA <batchId>` onayı
- `retained → destroying → destroyed` karşılaştırmalı durum geçişi
- Manifest boyut/SHA-256 doğrulaması olmadan imha etmeyen fail-closed dosya adaptörü
- `.destroying-*` sahiplenmesi, dayanıklı işlem durumu ve yarım imhanın devam ettirilmesi
- İmha sonrası içeriksiz, idempotent denetim makbuzu
- Güvenlik ve Ayarlar ekranında politika, bekletme ve nihai imha yönetimi

## Build 138 sonrasında açık kalanlar

- Türkiye ve hedef ülkeler için gerçek karantina/yedek saklama sürelerinin hukuk ve gizlilik incelemesi
- Gerçek Windows/NTFS üzerinde dosya kilidi, süreç öldürme ve elektrik kesintisi provası
- SSD wear levelling, TRIM, dosya sistemi snapshotı ve adli kalıntı sınırlarının bağımsız doğrulanması
- OneDrive, iCloud ve Google Drive sürüm geçmişindeki karantina veya eski kopyaların sağlayıcı API politikası
- Çevrimdışı disk, manuel kopya ve uygulama dışı yedekler için kullanıcı yönlendirmesi ve imha kanıtı
- Render edilmiş karantina yaşam döngüsü ekranı UAT, klavye ve ekran okuyucu testi

## Build 139 ile kaynakta kapatılanlar

- Manuel yedek, çevrimdışı disk, optik medya, snapshot ve bulut sürüm geçmişi için merkezi envanter
- Konum, sorumlu kişi, erişilebilirlik, tarihsel veri riski ve dönemsel inceleme tarihinin izlenmesi
- Kayıt kimliğine bağlı kesin teyit ve imha beyanı metinleri
- Teyit, hukuki bekletme ve imha beyanında parola/TOTP güçlü yeniden doğrulaması
- Hukuki veya koruma bekletmesi bulunan kopyada imha beyanının reddedilmesi
- Karşılaştırmalı `updatedAt` güncellemesiyle eşzamanlı değişiklik koruması
- İsteğe bağlı SHA-256 kanıt özeti ve kalıcı beyan geçmişi
- Kullanıcı beyanının otomatik fiziksel imha kanıtı olmadığının açık UI ve belge uyarısı

## Build 139 sonrasında açık kalanlar

- Gerçek çevrimdışı disk ve optik medyanın fiziksel erişim/okunabilirlik provası
- OneDrive, iCloud ve Google Drive sürüm geçmişlerinin sağlayıcı API’leriyle doğrulanması
- Snapshot ve üçüncü taraf yedek ürünlerinde otomatik keşif adaptörleri
- Kullanıcı beyanı yerine bağımsız veya sağlayıcı imzalı imha makbuzu modeli
- Türkiye ve hedef ülkeler için saklama/imha yükümlülüklerinin hukuk ve gizlilik incelemesi
- Render edilmiş envanter ekranı UAT, klavye ve ekran okuyucu testi

## Build 140 ile kaynakta kapatılanlar

- Güvenilen Ed25519 sağlayıcı ve bağımsız denetçi açık anahtarı envanteri
- Özel anahtar ve RSA anahtarının fail-closed reddi
- Sabit kanonik imha makbuzu ve detached Ed25519 imza doğrulaması
- Sağlayıcı/makbuz kimliği bazında replay koruması
- Makbuz tarihi, kopya oluşturma tarihi ve hukuki bekletme kontrolleri
- Kesin onay metni, parola ve etkinse TOTP güçlü yeniden doğrulaması
- Sağlayıcı güven iptalinin bağlı kanıt ve envanter güvenine yayılması
- Kullanıcı beyanı ile kriptografik doğrulanmış kanıtın ayrı gösterilmesi

## Build 140 sonrasında açık kalanlar

- OneDrive, iCloud, Google Drive ve üçüncü taraf yedek sağlayıcılarının gerçek imzalı makbuz/API sözleşmeleri
- Sağlayıcı anahtar döndürme, sertifika zinciri ve çevrimiçi iptal listesi entegrasyonu
- Gerçek fiziksel medya ve bulut sürüm geçmişi imhasının bağımsız denetim/UAT kanıtı
- Türkiye ve hedef ülkeler için imha makbuzunun hukuki delil niteliği incelemesi
- Render edilmiş güven zinciri ekranı UAT, klavye ve ekran okuyucu testi

## Build 141 ile kaynakta kapatılanlar

- Önceki Ed25519 anahtarın imzasıyla ardıl anahtar yetkilendirme modeli
- Sabit kanonik anahtar döndürme makbuzu ve benzersiz makbuz kimliği
- Önceki ve ardıl anahtar için atomik `validUntil`/`validFrom` kesim zamanı
- Aynı anahtar parmak izi, aynı makbuz ve ikinci döndürme için fail-closed koruma
- Makbuz düzenlenme anına göre tarihsel güven doğrulaması
- Kesin onay, parola ve etkinse TOTP güçlü yeniden doğrulaması
- Döndürme zincirinin kullanıcı ekranında görünmesi

## Build 141 sonrasında açık kalanlar

- OneDrive, iCloud, Google Drive ve gerçek sağlayıcıların anahtar döndürme API sözleşmeleri
- Çevrimiçi iptal listesi ve zaman damgası otoritesi üretim entegrasyonu
- Gerçek SQLite repository uçtan uca anahtar döndürme ve eşzamanlılık testi
- Render edilmiş güven zinciri ekranı UAT, klavye ve ekran okuyucu testi
- Gerçek Windows paketli çalışma ve installer yaşam döngüsü

## Build 142 ile kaynakta kapatılanlar

- Güvenilen sağlayıcı zinciri tarafından Ed25519 ile imzalanmış iptal listesi kabulü
- Monoton sıra numarasıyla rollback/replay koruması
- `thisUpdate` / `nextUpdate` süre penceresi ve 31 günlük geçerlilik üst sınırı
- Zincir dışı hedef, kendini iptal, bozuk imza ve tekrar kullanılan liste reddi
- İptal listesi, girdiler ve payload SHA-256 özetinin çevrimdışı kalıcı önbelleği
- Sağlayıcı, bağlı imha kanıtı ve yedek envanteri güveninin atomik düşürülmesi
- Güçlü yeniden doğrulama ve liste kimliğine bağlı kesin onay
- İmzalı iptal listesi geçmişinin Güvenlik ve Ayarlar ekranında gösterilmesi

## Build 142 sonrasında açık kalanlar

- Gerçek sağlayıcı HTTPS endpoint'i ve otomatik senkronizasyon adaptörü
- TLS sertifika/pinning, yönlendirme ve ağ hata politikası
- Süresi geçmiş çevrimdışı önbellek için gerçek kullanıcı UAT ve bildirim akışı
- Gerçek SQLite eşzamanlı liste uygulama ve süreç kesintisi provası


## Build 143 ile kaynakta kapatılanlar

- İmzalı iptal listesinin TLS doğrulamalı HTTPS üzerinden alınması
- SPKI SHA-256 pinning
- DNS sonrası özel ağ/loopback/link-local hedef reddi
- Aynı-origin yönlendirme, boyut, süre ve içerik türü sınırları
- Ağ belgesinin otomatik uygulanmaması; Build 142 imza zincirinin korunması

## Build 144 ile kaynakta kapatılanlar

- Renderer serbest URL/pin girdisi yerine sağlayıcıya bağlı kalıcı uç noktası profili
- Güçlü doğrulamalı profil oluşturma ve güncelleme
- Birincil ve geçiş SPKI pinleri için sınırlı çift-pin penceresi
- Devre dışı veya geçerli pini kalmamış profil için bağlantı öncesi fail-closed duruş
- Son başarılı/başarısız alım sonucunun profile yazılması

## Build 144 sonrasında açık kalanlar

- Gerçek sağlayıcı endpoint’i ve gerçek TLS sertifika/pin geçiş provası
- Periyodik otomatik senkronizasyon, geri çekilme ve kullanıcı bildirim politikası
- Süresi geçmiş iptal listesi önbelleği için render edilmiş kullanıcı UAT’si
- Gerçek Windows paketli çalışma ve installer yaşam döngüsü

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 180 yeniden sınıflandırma

`PPT-LIFECYCLE-STRICT-V1` uyarınca Silver veya Gold geliştirmesi olarak kalan ürün maddesi yoktur. API dışındaki bütün açık ürün kabiliyetleri Bronze işidir. Aşağıdaki ağır entegrasyonların yalnız gerçek üretim adaptörleri askıdadır; hedef kanal Bronze ve mimari hazırlık kaydı `config/deferred-api-integrations.json` içindedir:

- OneDrive üretim yedek adaptörü
- iCloud ve Google Drive üretim adaptörleri
- harita ve açık rızalı canlı konum sağlayıcısı
- sağlık, sigorta ve resmî kurum bağlantıları
- Apple/OIDC haricî kimlik sağlayıcıları
- haricî AI sağlayıcısı
- macOS/Apple companion eşitleme servisleri

Bu maddeler için port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırı Bronze kaynakta zorunludur.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 ile kaynakta kapatılanlar

- Güvenilen sağlayıcının resmî tüzel kişi kimliğinin kurum dışı kanıt referansıyla doğrulanması
- Ed25519 kök anahtarının SHA-256 parmak izinin ayrı ve bağımsız kanaldan teyidi
- Anahtarın gerçek parmak izi ile bağımsız kanaldan girilen parmak izinin birebir karşılaştırılması
- Aynı referansın iki kanıt kanalı olarak kullanılmasının fail-closed reddi
- Bağımsız tanık adı, tanık kurumu/rolü ve doğrulama zamanının kaydı
- Sabit kanonik kök güven doğrulama makbuzu ve SHA-256 özeti
- Eski köklerin `legacy_unverified`, imzalı döndürmeyle gelen anahtarların `rotation_inherited` olarak ayrılması
- Güvenlik Merkezi'nde doğrulama yöntemi, tanık ve makbuz özetinin görünmesi

## Build 182 sonrasında açık kalanlar

- Gerçek sağlayıcıların kimlik ve anahtar belgelerinin bağımsız hukuk/güvenlik denetimi
- Kurum dışı doğrulama töreninin gerçek kullanıcı, klavye ve ekran okuyucu UAT'si
- Zaman damgası otoritesi ve gerçek sağlayıcı çevrimiçi kimlik doğrulama API'leri
- Gerçek Windows paketli çalışma ve installer yaşam döngüsü
## Build 183 ile kaynakta kapatılanlar

- Saklama süresi dolan imha kayıtları için otomatik temiz yedek yeniden yazımı
- Eski yönetilen yedeğin manifestli karantinaya alınması
- Kesinti/yeniden başlatma devamlılığı
- Manuel 60 dakika ve otomatik 360 dakika geri çekilme
- Yüksek yükte 30 dakika güvenli erteleme
- Etkin hedef yokluğunda görünür tanı

## Build 183 sonrasında Silver'da doğrulanacaklar

Temiz kurulum, tam test paketi, production build, performans, güvenlik, kullanılabilirlik ve gerçek Windows/installer davranışı.

## Build 184 sonrası açık test işleri

- Gerçek Windows süreç sonlandırması sırasında temiz yedek sonuçlandırma kurtarması — Silver.
- Büyük çalışma defteri üzerinde performans ve erişilebilir geçmiş görünümü — Silver.
- Temiz kurulum, tam test paketi, production build, smoke ve installer — Silver.

Atomik SQLite bağlayıcı kusuru ve kalıcı çalışma geçmişi Bronze Build 184 içinde kapatılmıştır.

## Build 185 sonrası açık test işleri

- Gerçek Windows uyku/uyanma ve kullanıcı saat değiştirme senaryosu — Silver.
- Çok hedefli uzun disk I/O sırasında zaman ve erişilebilir geçmiş UAT'si — Silver.
- Temiz kurulum, tam test paketi, production build, smoke ve installer — Silver.

İşlem başında önceden üretilen tamamlanma zamanı kusuru Bronze Build 185 içinde
kapatılmıştır.

## Build 186 sonrası açık test işleri

- Gerçek Windows'ta sistem saati ileri/geri değişimi
- Uyku/uyanma sırasında monotonik sayaç davranışı
- Süreç öldürme ile propagation ve çalışma defteri atomikliği
- Render edilmiş geçmiş ekranında bağlı çalışma gezinmesi ve ekran okuyucu UAT

## Build 187 sonrası açık test işleri

- Gerçek Windows üzerinde uygulama kapanması, zorunlu sonlandırma ve saat geri
  alma provası Silver kampanyasında yürütülecek.
- NTFS dosya kilidi, elektrik kesintisi ve yeniden başlatma provası Silver'da
  gerçek ortam kanıtı üretir.
- Bronze kaynakta kesinti kurtarma ve geri çekilme kronolojisi tamamlanmıştır.

## Build 188 sonrası açık test işleri

- Gerçek Windows üzerinde saat geri alma sırasında otomatik claim ve backoff provası — Silver.
- Uyku/uyanma ve zaman hizmeti senkronizasyonunda durum yeniden hesaplama — Silver.
- Eşzamanlı iki masaüstü süreç girişimi ve gerçek SQLite/NTFS kilit davranışı — Silver.
- `backup.clean_rewrite_claim_clock_adjusted` tanısının render, klavye ve ekran okuyucu UAT'si — Silver.

Geri alma güvenli sahiplenme kronolojisi Bronze Build 188 içinde kaynakta tamamlanmıştır.

## Build 189 sonrası açık test işleri

Gerçek Windows sistem saati değişimi, zorla süreç sonlandırma, yeniden başlatma, uyku/uyanma ve installer üzerinden kalıcı SQLite doğrulaması Silver için NOT_RUN kalır.


## Build 190 sonrası açık test işleri

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 sonrası açık test işleri

Gerçek Windows süreç kesintisi, saat değişimi ve manuel/otomatik yeniden deneme UAT kanıtı Silver test kampanyasında çalıştırılacaktır.

## Build 192 sonrası açık test işleri

Gerçek Windows üzerinde otomatik politika kapalıyken UI “Şimdi çalıştır” akışı, süreç yeniden başlatma ve installer smoke testi Silver kampanyasında yürütülür. Ürün davranışı Bronze kaynakta tamamlanmıştır.



## Build 193 sonrası açık test işleri

Temiz npm kurulumu, tam kök TypeScript, tüm testler, Electron production build, smoke ve gerçek Windows/installer doğrulaması Silver için açık kalır. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 sonrası açık test işleri

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 sonrası açık test işleri

Temiz kurulum, tam kök TypeScript, bütün testler, Electron üretim, smoke ve Windows installer doğrulamaları Silver için NOT_RUN.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Öncelik notu

OPEN-001 teknik bütünlük işi Build 209’a taşınmıştır. P0 yaşamsal API/adapter sınırları P2 banka/kurum entegrasyonlarından önce gelir. P2 entegrasyonlar kararlı üretimden yaklaşık 5-6 ay önce önceliklendirilmez.

## Build 210 — OPEN-001 uygulama notu

`OPEN-001 — Terminal temiz-yedek çalışma defteri değişmezliği` Build 210 kapsamında uygulanmıştır. Kapanış, Ana Build Defteri ve hedefli SQLite kanıtlarıyla yapılır. Silver doğrulama açık işleri ve Bronze Final güvenlik blokajları ayrı kalır.
