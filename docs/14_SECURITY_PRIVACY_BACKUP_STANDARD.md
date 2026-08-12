# Güvenlik, Mahremiyet, Yedekleme ve Kurtarma Standardı — Build 214

**Aktif sürüm:** 02.08.2026.228

## 1. Temel güvenlik modeli

Sistem varsayılan reddetme ve en az ayrıcalık kullanır. Kimlik, yetki, IPC,
renderer oturumu, dosya erişimi, yedek, dışa aktarım ve AI bağlamı aynı ilkeye
uymalıdır.

## 2. Kimlik ve oturum

- Windows Hello tercihli giriş
- Güçlü yerel parola ve güvenli değişiklik/sıfırlama
- TOTP MFA ve sekiz tek kullanımlık recovery code
- Aktif ve bekleyen TOTP sırlarının `safeStorage`/DPAPI korumalı zarf olarak saklanması
- Legacy açık TOTP sırlarının transaction içi atomik ve fail-closed geçişi
- Recovery code’ların yalnız hash olarak saklanması ve atomik tüketimi
- FIDO2/WebAuthn için genişletilebilir kimlik sözleşmesi
- 15 dakika gerçek kullanıcı etkinliği görülmediğinde oturum kilidi; son 60 saniyede erişilebilir uyarı
- Yalnız `pointerdown`, `keydown` ve `touchstart` etkinliği süreyi uzatır; arka plan işleri uzatmaz
- Kilitte açık form ve modal durumu korunur; aynı hesap parola ve etkinse TOTP ile yeniden doğrulanır
- 5 başarısız giriş sonrası 15 dakika hesap kilidi
- Giriş, kilit, parola, MFA ve cihaz olaylarının denetimi

Haricî Apple/OIDC girişi gelecekte Authorization Code + PKCE, state/nonce ve
sistem tarayıcısıyla uygulanabilir. Haricî kimlik yerel rol veya veri yetkisi
vermez.

## 3. Güvenilir cihaz

- Ed25519 tabanlı cihaz kimliği ve imzalı sahiplik doğrulaması
- Cihaz sırlarının kullanıcı verisinden ayrı dizinde tutulması
- Ed25519 özel anahtarının açık JSON yerine Electron `safeStorage` ile şifrelenmesi
- Windows çalışma zamanında işletim sistemi DPAPI korumasının zorunlu olması
- Eski açık kimlik dosyasının atomik, geri alınabilir ve kalıntısız zarf geçişi
- Koruma sağlayıcısı kullanılamıyorsa şifreli kimliğin fail-closed açılmaması
- Her yüklemede özel/açık anahtar eşleşmesinin imzalı meydan okumayla doğrulanması
- Yeni cihazın eski güveni devralmaması
- Yedekten dönüşte yeniden kimlik ve cihaz yetkilendirmesi
- MFA kapatıldığında güvenilir cihazların iptali
- Cihaz listeleme ve geri çekme işlemleri

## 4. Yetkilendirme

Karar girdileri: aktör, rol, aile, aile dalı, veri sahibi, nesne, işlem, amaç,
başlangıç/bitiş zamanı, allow/deny ve AI izni.

- Açık ret önceliklidir.
- Özel yetişkin verisi aile yöneticisine otomatik açılmaz.
- Sağlık, finans, çocuk, konum ve kimlik belgesi yüksek hassasiyetlidir.
- İzin değişiklikleri ve denetim kayıtları aynı transaction içinde yazılır.
- Yetki aşımı arama, rapor, dışa aktarım ve AI yanıtında da engellenir.

## 5. Electron ve IPC

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- `navigateOnDragDrop: false`
- Yalnız kayıtlı ana `webContents`, ana frame ve tam güvenilir belge IPC çağırabilir.
- Payload argüman, derinlik, düğüm, nesne grafiği ve tahmini byte bütçesine tabidir.
- Permission, download, navigation, redirect ve webview varsayılan reddedilir.
- Haricî açılış yalnız güvenli ve kimlik bilgisi taşımayan HTTPS hedefleriyle sınırlandırılır.
- `app.enableSandbox()` ana süreçte `ready` öncesinde etkinleştirilir.
- Renderer güvenlik tercihleri tek fabrikadan üretilir ve başlangıçta doğrulanır.
- Normal çalışmada `--no-sandbox`, `--single-process`, `--disable-gpu-sandbox`, RendererCodeIntegrity veya AppContainer kapatma seçenekleri fail-closed reddedilir.
- Tanısal güvenlik istisnası yalnız açık test ortamında çalışır ve `DIAGNOSTIC_PASS` sayılır.
- Production renderer `file://` yerine yalnız `pardus-app://renderer` özel protokolünden yüklenir; handler renderer kökü dışındaki yolu, yanlış hostu, credentials ve bozuk URL'yi reddeder.
- CSP response header ile `default-src 'none'` tabanında uygulanır.
- Electron 43'ün dokuz fuse'u `@electron/fuses 2.1.3` ve `strictlyRequireAllFuses` ile afterPack aşamasında, kod imzalamadan önce yazılır ve bağımsız readback edilir.

Bu oturum ve Electron kuralları için DEC-209 ile
`docs/current/DESKTOP_SESSION_AND_ELECTRON_SECURITY_CONTRACT.md` bağlayıcıdır.

## 6. Veri ve denetim

- Hassas veri aktarımda ve depolamada şifrelenir.
- Loglar sır, parola, token ve gereksiz kişisel veri taşımaz.
- Audit kayıtları append-only/hash zinciriyle değişikliğe dayanıklıdır.
- Silme; geri alınabilir sürüm, saklama politikası veya güvenli imha kuralıyla yürür.
- Standart dışa aktarım ve cihazlar arası taşınabilirlik korunur.

## 7. AI güvenliği

- AI sağlayıcısı varsayılan kapalıdır.
- Erişim izni ve AI işleme izni ayrı kontrol edilir.
- Kişisel ve aile hafızası mantıksal olarak ayrılır.
- Kaynak ve güven düzeyi gösterilir.
- AI önerisi otomatik kesin kayıt oluşturmaz.
- Kullanıcı AI hafızasını görüntüleyebilir, düzeltebilir, sınırlayabilir ve silebilir.

## 8. Yedek hedefleri

Yerel disk, harici disk ve bulut hedefleri bağımsız orkestre edilir. OneDrive
öncelikli gerçek bağlantıdır; iCloud, Google Drive ve diğer sağlayıcılar aynı
adapter sözleşmesine eklenebilir.

Her hedef için:

- bağlantı durumu
- boş alan
- son başarılı zaman
- hash ve doğrulama
- boyut
- aktarım hızı
- hata sınıfı ve mesajı
- son geri yükleme provası

izlenir. Bir hedef başarısız olduğunda diğerleri devam eder. En az bir tam ve
doğrulanmış yedek korunur.

## 9. Geri yükleme ve felaket kurtarma

- Yedek açılmadan önce hash ve şifre doğrulanır.
- Geri yükleme transaction/rollback sınırında yapılır.
- Bozuk veri izole edilir; mevcut doğrulanmış kopya korunur.
- Yeni cihaz otomatik güvenilir sayılmaz.
- Cihaz yetkilendirmesi ve kullanıcı kimliği yeniden doğrulanır.
- Restore provası Silver promotion-blocking kapısıdır.

## 10. Güvenlik değişiklik yönetişimi

Güvenlik kontrolü zayıflatılamaz veya kaldırılamaz; ancak ürün sahibi onayı,
risk kabulü, karar kaydı, süre ve telafi kontrolüyle geçici istisna oluşturulabilir.
Gold sürümü açık kritik güvenlik istisnasıyla yayımlanmaz.

## 11. Build 130 parola korumalı tam yedek standardı

- Yeni tam yedek biçimi sürüm 3'tür.
- İçerik AES-256-GCM ile şifrelenir.
- Anahtar PBKDF2-SHA512 ve 310.000 iterasyonla türetilir.
- Salt 32 bayt, IV 12 bayt, GCM etiketi 16 bayttır.
- Kapsayıcı metadata'sı AAD ile bütünlüğe bağlanır.
- Yanlış parola veya değiştirilmiş dosya fail-closed reddedilir.
- Manuel yedek parolası uygulama hesabı parolasından bağımsızdır.
- Otomatik hedef parolası OS güvenli depolamasında korunur.
- v1/v2 biçimleri legacy ve `attention` riskindedir; yeni yedek üretmez.

## 12. Build 131 dayanıklı geri yükleme standardı

- Her geri yükleme benzersiz işlem kimliği taşır.
- Aşamalar `prepared`, `live-moved`, `staged-installed`, `committed` olarak kalıcı
  günlükte tutulur.
- Günlük yazımı geçici dosya, 0600 izin, `fsync` ve atomik rename kullanır.
- Rollback kopyaları marker ve commit aşaması kalıcı olmadan silinmez.
- Uygulama başlangıcı açık günlüğü doğrular; tamamlanmamış işlemi geri alır,
  tamamlanmış işlemin yalnız artıklarını temizler.
- Journal yolları mevcut storage layout dışına çıkamaz.
- Staged SQLite dosyası commit öncesi ve cihaz güvenleri iptal edildikten sonra
  yeniden bütünlük kontrolünden geçer.
- Geri yüklenen tüm aktif güvenilir cihaz kayıtları iptal edilir.
- Aynı cihaz kimliği kullanılsa dahi eski güven MFA atlaması sağlamaz.
- Commit sonrası veritabanı çalışma zamanı yeniden kullanılmaz; uygulama zorunlu
  yeniden başlatılır.

## 13. Build 132 başlangıç güvenlik ön kontrolü

- Veri deposu açılmadan önce `safeStorage` kullanılabilirliği doğrulanır.
- Rastgele meydan okuma korunup geri açılarak gerçek şifreleme turu yapılır.
- `startup-security-sentinel.json` ilk açılışta atomik, `fsync` edilmiş ve `0600` izinli yazılır.
- Sonraki açılışta sentinel aynı OS sağlayıcısıyla açılır ve SHA-256 bütünlüğü sabit zamanlı karşılaştırılır.
- Bozuk, farklı sağlayıcıya ait veya açılamayan sentinel otomatik yenilenmez; uygulama fail-closed durur.
- `startup-security-preflight.json` kanıtı platform, sağlayıcı, sandbox politikası ve sentinel durumunu taşır.
- Windows üzerinde sağlayıcı `windows-dpapi` olmalı; gerçek kanıt aynı kullanıcı verisiyle iki ayrı süreçte `created` → `verified` geçişini göstermelidir.



## 14. Build 133 finans ve sağlık nesne mahremiyeti

- Özel ve seçili üye kayıtları yalnız veri sahibi veya etkin açık nesne izniyle açılır.
- Aile yöneticisi rolü başka bir yetişkinin özel finans veya sağlık verisini otomatik açmaz.
- Etkin açık ret sahiplik, rol ve açık izinden önce uygulanır.
- `family` görünürlüğü yalnız sınırlı rol okuma politikasını etkinleştirir.
- Finans değerlemesi üst finans kaydının mahremiyetini devralır.
- Hassas finans/sağlık verisinin AI işlemesi ayrıca açık `ai_process` izni gerektirir.
- Oluşturma yetkisi hedef veri sahibi ve seçilen mahremiyet seviyesiyle birlikte değerlendirilir.

## 15. Build 135 dijital kasa anahtarı koruma standardı

- Yerel arşiv kasa anahtarı açık 32 bayt dosya olarak tutulmaz.
- Koruma zarfı sürüm 2, amaç `archive-vault-key` ve sağlayıcı kimliği taşır.
- Anahtar Electron `safeStorage` üzerinden OS korumasına alınır; Windows tarafında
  beklenen sağlayıcı DPAPI’dir.
- Zarf içeriği SHA-256 anahtar özetiyle doğrulanır ve sabit zamanlı karşılaştırma
  kullanılır.
- Legacy açık anahtar geçici dosya, `fsync`, atomik rename ve geri alma kopyasıyla
  dönüştürülür.
- Yarım migration sonraki açılışta kurtarılır; başarılı işlemden sonra açık
  migration yedeği kaldırılır.
- Koruma kullanılamazsa, sağlayıcı uyuşmazsa veya zarf bozuksa açık anahtara
  düşülmez; uygulama fail-closed davranır.
- Tam yedek içinde ham anahtar yalnız AES-256-GCM şifreli payload içinde bulunur.
- Geri yüklemede ham anahtar hedef cihazın OS korumasıyla yeniden sarılır; kaynak
  cihazın DPAPI zarfı taşınmaz.
- Gerçek Windows migration ve cihazlar arası restore kanıtı ayrı promotion kapısıdır.

## 16. Build 136 veri saklama ve kalıcı imha standardı

- Hassas kayıtlar `active`, `archived`, `purge_scheduled` veya `purged` durumundadır.
- Varsayılan kullanıcı işlemi geri alınabilir arşivlemedir; doğrudan kalıcı silme yoktur.
- Saklama politikası kayıt türü, saklama günü ve geri alma penceresini tanımlar.
- Saklama süresi dolmadan imha talebi; geri alma penceresi dolmadan imha yürütmesi reddedilir.
- Talep ve yürütme aşamalarında farklı, kayıt kimliğine bağlı kesin onay metinleri kullanılır.
- Parola ve etkinse TOTP ile güçlü yeniden doğrulama zorunludur.
- Hukuki/koruma bekletmesi bulunan kayıt imha edilemez.
- Nesne düzeyi açık ret, sahiplik ve rol politikaları imha işlemlerinde de geçerlidir.
- Kaynak kayıtla birlikte nesne izinleri ve AI izinleri kaldırılır; içeriksiz denetim tombstone'u korunur.
- İmha sonrası `backupPropagationPending=true` eski yedeklerin ayrıca süre ve imha politikası altında olduğunu gösterir.
- `PRAGMA secure_delete=ON` ve WAL checkpoint kullanılır; fiziksel silme **en iyi çaba** yaklaşımıdır.
- SSD wear levelling, dosya sistemi snapshotları, bulut eşitlemesi ve yedek kopyaları veriyi bir süre tutabilir.
- Uygulamadaki politika süreleri teknik varsayımdır; gerçek yasal saklama süreleri hukuk ve gizlilik incelemesiyle belirlenir.

## 17. Build 137 yönetilen yedek imha yayılımı standardı

- Yayılım yalnız etkin ve uygulamada kayıtlı yönetilen yedek hedeflerinde çalışır.
- Her hedefte önce yeni şifreli tam yedek oluşturulur ve SHA-256 ile doğrulanır.
- Yayılım süresince normal retention temizliği eski yedekleri önceden silemez.
- Taze yedek dışındaki kök `.pptbackup` dosyaları fiziksel olarak silinmez;
  `.purge-quarantine/<işlem-kimliği>/` dizinine atomik olarak taşınır.
- Karantina dizini `0700`, manifest ve karantina dosyaları mümkün olan sistemlerde
  `0600` izinleriyle korunur.
- Manifest dosya adını, boyutu, SHA-256 özetini ve açık kimlik içermeyen tombstone
  parmak izlerini taşır.
- Dosya yolu hedef dizinin dışına çıkamaz; taze yedek hedef kökü dışında olamaz.
- Bir hedef başarısızsa veya yönetilmeyen aktif `.pptbackup` kalırsa tombstone
  tamamlanmış sayılmaz ve `backupPropagationPending=true` korunur.
- Karantina fiziksel imha değildir; manuel kopyalar, snapshotlar, bulut sürüm
  geçmişi ve çevrimdışı medya kullanıcı ve hukuk/gizlilik politikası kapsamında
  ayrıca ele alınır.


## 18. Build 138 yedek karantina yaşam döngüsü standardı

- Yönetilen karantina grupları `retained`, `destroying` ve `destroyed` durumlarıyla izlenir.
- Varsayılan 90 gün yalnız operasyonel güvenlik süresidir; nihai yasal saklama süresi değildir.
- Politika değişikliği yalnız yeni karantina gruplarına uygulanır; mevcut bitiş tarihleri sessizce değiştirilmez.
- Saklama süresi dolmadan veya hukuki/koruma bekletmesi varken imha fail-closed reddedilir.
- Politika, bekletme ve imha yalnız aile yöneticisi ve güçlü yeniden doğrulamayla çalışır.
- İmha için `KARANTİNA İMHA <batchId>` kesin onay metni zorunludur ve kimlik doğrulamadan önce denetlenir.
- Veritabanı durumu CAS ile `destroying` yapılmadan dosya sistemi işlemi başlamaz.
- Manifestteki dosya adı, boyut ve SHA-256 doğrulanmadan içerik imha edilmez.
- Karantina dizini atomik `.destroying-*` adına alınır; `destruction-state.json` kesinti sonrası devam sağlar.
- Tamamlanan işlem içeriksiz bir makbuz bırakır ve tekrar çağrıda idempotent sonuç üretir.
- Tek geçişli sıfır yazma, `fsync` ve unlink en iyi çabadır; SSD wear levelling, TRIM, snapshot, bulut geçmişi veya çevrimdışı kopyalarda mutlak fiziksel imha garantisi vermez.
- Gerçek Windows/SSD ve bulut sağlayıcı kanıtı ayrı promotion kapısıdır.

## 19. Build 139 uygulama dışı yedek envanteri standardı

- Manuel yedekler, çevrimdışı diskler, optik medya, snapshotlar ve bulut sürüm geçmişleri ayrı envanterde tutulur.
- Her kayıt kopya türü, konum, sorumlu, erişilebilirlik, tarihsel veri riski, son teyit ve sonraki inceleme tarihini taşır.
- Yönetilmeyen kopyalar uygulama tarafından otomatik silinmiş veya imha edilmiş sayılmaz.
- Kayıt yalnız aile yöneticisi tarafından oluşturulur; teyit, bekletme ve imha beyanı güçlü yeniden doğrulama gerektirir.
- Teyit için `HARİCİ YEDEK TEYİT <copyId>`, imha beyanı için `HARİCİ YEDEK İMHA <copyId>` kesin onayı zorunludur.
- Hukuki/koruma bekletmesi varken imha beyanı reddedilir.
- Durum geçişleri `expectedUpdatedAt` ile CAS korumasındadır; eşzamanlı değişiklikler sessizce ezilmez.
- İsteğe bağlı `evidenceSha256` yalnız kanıt nesnesinin bütünlüğünü bağlar.
- Kullanıcı beyanı otomatik fiziksel imha kanıtı değildir; SSD, çevrimdışı cihaz, snapshot ve bulut sağlayıcı geçmişi ayrıca doğrulanmalıdır.
- İnceleme tarihi geçen veya tarihsel veri riski taşıyan kayıtlar güvenlik ekranında açık risk olarak gösterilir.
- Gerçek çevrimdışı medya ve sağlayıcı API doğrulaması ayrı promotion kapısıdır.
- kullanıcı beyanı bir fiziksel imha makbuzu veya otomatik teknik kanıt değildir.

## 20. Build 140 imzalı haricî yedek imha kanıtı standardı

- Kullanıcı imha beyanı ile imzalı sağlayıcı kanıtı ayrı güven seviyeleridir.
- Yalnız Ed25519 SPKI açık anahtarı kabul edilir; özel anahtar ve RSA reddedilir.
- Sağlayıcı açık anahtarı normalize edilir ve SHA-256 parmak iziyle kaydedilir.
- Kanonik makbuz şeması sabittir ve `statement=destroyed` alanını içerir.
- Aynı sağlayıcı ve makbuz kimliği ikinci kez kullanılamaz.
- Makbuz zamanı kopya kaydından önce olamaz ve beş dakikadan fazla ileri tarihli olamaz.
- Hukuki/koruma bekletmesi varken imzalı imha kanıtı uygulanamaz.
- Güven ekleme, iptal ve kanıt doğrulama aile yöneticisi, kesin onay, parola ve etkinse TOTP gerektirir.
- Sağlayıcı iptali bağlı kanıt ve kopya güvenini `revoked` durumuna geçirir; denetim geçmişi silinmez.
- Geçerli imza makbuzun kökenini ve bütünlüğünü doğrular; fiziksel imhayı mutlak olarak kanıtlamaz.
- Sağlayıcı API'si, bağımsız denetim ve gerçek medya/bulut kanıtı ayrı promotion kapısıdır.

## 21. Build 141 imzalı sağlayıcı anahtarı döndürme standardı

- Ardıl Ed25519 anahtarı yalnız önceki etkin anahtarın kanonik döndürme makbuzu imzasıyla kabul edilir.
- Özel anahtar uygulamaya alınmaz; yalnız SPKI PEM açık anahtarı ve SHA-256 parmak izi saklanır.
- Döndürme makbuzu önceki/ardıl parmak izlerini, kesim zamanını ve benzersiz makbuz kimliğini imzaya bağlar.
- Kesim zamanı doğrulama zamanından en fazla beş dakika önce veya otuz gün sonra olabilir.
- Aynı parmak izi, aynı makbuz ve aynı önceki anahtarın ikinci kez döndürülmesi fail-closed reddedilir.
- Önceki `validUntil` ve ardıl `validFrom` aynı transaction içinde aynı kesim zamanına yazılır.
- İmha makbuzu güveni makbuzun `issuedAt` anındaki anahtar aralığıyla doğrulanır.
- Kesim öncesi eski anahtar; kesim anı ve sonrasında yalnız ardıl anahtar geçerlidir.
- İptal zamanı öncesindeki geçerli tarihsel kanıt korunur; iptal anı ve sonrası makbuzlar reddedilir.
- Döndürme, kesin onay, parola ve etkinse TOTP güçlü yeniden doğrulaması gerektirir.
- Gerçek sağlayıcı anahtar yönetimi, çevrimiçi iptal listesi ve kurum dışı kimlik doğrulaması ayrı promotion kapısıdır.

## 22. Build 142 imzalı sağlayıcı iptal listesi standardı

- İptal listesi sabit kanonik payload ve Ed25519 detached imzasıyla doğrulanır.
- Liste aynı kök güven zinciri içinde benzersiz `listId` ve monoton `sequenceNumber` taşır.
- Daha düşük veya eşit sıra numarası rollback/replay olarak reddedilir.
- `thisUpdate` en fazla beş dakika gelecek toleransına sahiptir; `nextUpdate`
  doğrulama anından sonra olmalı ve liste penceresi 31 günü aşmamalıdır.
- İmzalayan anahtar `thisUpdate` anında güvenilir olmalıdır.
- İptal hedefleri aynı güven zincirinde bulunur; imzalayan anahtar kendisini iptal edemez.
- Liste uygulaması kesin onay, parola ve etkinse TOTP güçlü doğrulaması gerektirir.
- Uygulanan liste, girdiler ve payload SHA-256 özeti denetim için kalıcı tutulur.
- Önceki güncel liste `superseded` olur; düşük sıra numaralı liste tekrar güveni yükseltemez.
- Sağlayıcı, bağlı imha kanıtı ve yedek envanteri güven durumu iptal zamanına göre atomik güncellenir.
- HTTPS `sourceUrl` yalnız kaynak metadata'sıdır; Build 142 otomatik ağ indirme veya gerçek sağlayıcı API entegrasyonu içermez.
- Süresi geçmiş çevrimdışı önbellek, yeni güven kanıtı olarak kabul edilmez.


## 23. Build 143 güvenli HTTPS iptal listesi alım standardı

- Yalnız HTTPS/443 kaynakları kabul edilir; URL kimlik bilgisi ve fragment reddedilir.
- Normal TLS sertifika zinciri doğrulaması kapatılamaz.
- Sunucu açık anahtarı SPKI SHA-256 piniyle doğrulanır.
- DNS çözümlemesi sonrası loopback, özel ağ ve link-local hedefler reddedilir.
- Yönlendirme aynı origin ve en fazla iki adımla sınırlıdır.
- Yanıt süresi, boyutu ve `application/json` içerik türü sınırlandırılır.
- Ağdan alınan belge otomatik güven kazanmaz; Build 142 imza ve sıra kontrolleri zorunludur.

## 24. Build 144 sağlayıcı uç noktası profili ve TLS pin geçiş standardı

- Renderer her istekte serbest URL veya pin gönderemez.
- Profil kök güven sağlayıcısına bağlıdır; ardıl veya iptal edilmiş sağlayıcı profil sahibi olamaz.
- Profil değişikliği aile yöneticisi, kesin onay, parola ve etkinse TOTP gerektirir.
- Birincil ve geçiş pinleri 64 karakter küçük harf SHA-256 hex biçimindedir.
- Çift-pin geçiş penceresi en fazla 14 gün, ileri planlama en fazla 90 gündür.
- Devre dışı profil veya geçerli pini kalmamış profil bağlantı kuramaz.
- Son alım başarısı/hatası denetim için profile yazılır.
- TLS pin eşleşmesi belge imzası veya sağlayıcı iptal listesi doğrulamasının yerine geçmez.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Haricî sağlayıcı hazırlık standardı — Build 182

`PPT-LIFECYCLE-STRICT-V1` gereği OneDrive/iCloud/Google Drive, harita, sağlık/kurum, kimlik ve AI üretim API’leri askıda olsa bile sağlayıcıdan bağımsız port/adaptör, yerel fallback, test ikizi, sır kaynağı, iptal/timeout, tipli hata, rıza, mahremiyet ve audit sınırları Bronze’da tanımlıdır. Gerçek API doğrulaması Silver test kampanyasına ürün geliştirmesi olarak taşınmaz.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 temiz yedek standardı

Yeni tam yedek doğrulanmadan eski yönetilen kopya değiştirilemez. Eski kopya doğrudan silinmez; mevcut karantina saklama ve hukuki bekletme kurallarına devredilir. Manuel dosya, çevrimdışı disk ve bulut sürüm geçmişi otomatik kapsam dışıdır.

## Build 184 yedek güvenliği

Temiz yedek çalışma defteri içerik değil operasyon metadatasıdır. Sonuçlandırma sahiplik kontrolü ve çift satır değişim şartıyla atomiktir; doğrulanmış yeni yedek öncesi karantina yasağı korunur.

## Build 185 yedek güvenliği

Yönetilen yedek yayılımında `startedAt` duvar saati ile süreç monotonik saati
birlikte başlatılır. Karantina ve final zamanları monotonik geçen süreden türetilir;
final zaman hedef döngüsünden önce oluşturulamaz. Geriye giden veya geçersiz saat,
tombstone tamamlamasını fail-closed durdurur.

## Build 186 yedek güvenliği

Temiz-yedek çalışma defteri ile propagation kaydı arasında doğrulanmış bağlantı
zorunludur. Başarı/kısmi sonuç propagation tamamlanmasından önce kaydedilemez.

## Build 187 yedek güvenliği

Kesilmiş temiz-yedek çalışması, saat geri alma koşulunda kalıcı başlangıçtan önce
tamamlanmış yazılamaz. `running` ve `idle` durumları sonraki deneme taşıyamaz;
`backoff`, `deferred` ve `attention` durumları doğrulanmış sonraki deneme
zamanı taşır. Çalışma defteri ve politika aynı transaction içinde güncellenir.

## Build 188 yedek güvenliği

Yeni temiz-yedek claim zamanı gözlenen duvar saati, politika güncellemesi, son deneme ve son başarının en ileri değeridir. Gelecekteki sonraki deneme zamanı bu tabana katılmaz. Saklama kesimi güvenli başlangıçtan türetilir; politika/defter zaman gerilemesi, başlangıç veya kesim değişikliği ve ikinci eşzamanlı `running` kayıt SQLite tarafından reddedilir.

## Build 189 yedek güvenliği

Aktif çalışma ayarları değiştirilemez. Kurtarma, çalışma defteri `updated_at` dahil en ileri kalıcı zamandan yapılır; terminal durum, sonuç, hata ve retry eşleşmesi SQLite tarafından korunur.


## Build 190 yedek güvenliği

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 yedek güvenliği

Temiz-yedek retry zamanı terminal tamamlanma ve trigger politikasından koparılamaz; yanlış yazım SQLite tarafından reddedilir.

## Build 192 yedek güvenliği

Devre dışı otomatik politika manuel, açık yönetici komutunu engellemez. Manuel işlem politika etkinlik değerini değiştirmez; otomatik sahiplenme `enabled=0` altında repository ve SQLite tarafından reddedilir.



## Build 193 yedek güvenliği

Aktif temiz-yedek çalışma satırı yalnız eşleşen policy owner tarafından tutulabilir; aktif satır silme ve kimlik/tetikleyici mutasyonu yasaktır. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 yedek güvenliği

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 yedek güvenliği

Aktif temiz-yedek çalışmasının saklama ve geri çekilme parametreleri terminal geçişe kadar sabittir.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Marka-only metadata ve P0 yedek API önceliği

Aktif proje teslimlerinde doğal kişi/aile kimliği bulunamaz. Yedekleme için gerekli sağlayıcı adapterları P0 yaşamsal entegrasyondur; banka ve diğer kurum API’leri P2’dir ve çekirdek güvenlik/yedek geliştirmesini geciktiremez.

## Build 210 — Clean-backup terminal evidence

Terminal temiz-yedek çalışma kaydı, yedek güvenlik kanıt zincirinin değişmez parçasıdır. Sonradan mutation, silme veya aynı ID üzerinde REPLACE ile yeniden yazım SQLite düzeyinde reddedilir. Düzeltme ihtiyacı tarihsel satırı değiştirmek yerine yeni ve izlenebilir bir kayıt/karar üzerinden ele alınır.


## 22. Build 213 aktif oturum in-use veri koruması

- Kullanıcı doğrulanmadan AES-256-GCM veri kasası açılamaz.
- Kimliği doğrulanmış aktif oturumda SQLite ana veritabanı yalnız süreç belleğinde (`:memory:`) çalışır; normal data/temp klasöründe okunabilir aktif `.db/.sqlite` dosyası oluşturulmaz.
- Hydration, snapshot, yedek ve restore için dosya görüntüsü gerektiğinde benzersiz bounded staging alanı kullanılır.
- Windows production staging dizini dosya yaratılmadan önce `cipher.exe /E /B /H` ile EFS korumasına alınır; EFS etkinleştirme başarısızsa akış fail-closed durur.
- Non-Windows 0700/0600 staging yalnız geliştirme/test kolaylığıdır ve Windows EFS PASS kanıtı sayılmaz.
- Snapshot `VACUUM main INTO` ile alınır ve kullanım biter bitmez kaldırılır. SSD/NTFS üzerinde fiziksel secure-delete garantisi iddia edilmez.
- Aktif oturum en fazla 30 saniyede bir şifreli kullanıcı kasasına checkpoint edilir; logout/timeout/quit son mühürleme + staging temizliği yapar.
- Aynı Windows kullanıcısı bağlamındaki malware, process-memory erişimi veya yöneticiye karşı mutlak izolasyon iddia edilmez. Gerçek Windows EFS ve paketli çalışma testi OPEN-021 kapanışı için ayrıca gereklidir.


## 23. Build 214 Protected Side Artifact

Kalıcı hassas yan-artifact içerikleri `ProtectedSideArtifactStore` üzerinden AES-256-GCM ile korunur. Structured log `.pplog`, diagnostic/bakım exportu `.pptdiag`, health report `.pptreport` şifreli kapsayıcıdır. Yan-artifact veri anahtarı disk üzerinde plaintext tutulmaz; `DeviceSecretProtector` üzerinden sarılır ve Windows production hedefinde Electron `safeStorage`/DPAPI kullanılır. Browser `sessionData`, cache/temp ve crash alanları kalıcı kullanıcı veri kökünden ayrılıp süreç-özel volatil OS temp köküne yönlendirilir ve temizlenir. Kullanıcının bilinçli export talebi plaintext istisna değildir. Gerçek Windows safeStorage/DPAPI kanıtı çalıştırılmadan PASS sayılamaz. DEC-104 ve ADR-087 bağlayıcıdır.
