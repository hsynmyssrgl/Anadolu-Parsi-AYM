# Güvenlik Bildirimi

**Aktif sürüm:** Bronze 26.08.2026.51

Güvenlik açığı şüphesi kamuya açık hata kaydı olarak paylaşılmamalıdır. Üretim
sürümünde ayrı ve güvenli bildirim kanalı tanımlanacaktır.

## Bağlayıcı ilkeler

- Varsayılan reddetme ve en az ayrıcalık
- Her yetişkinin kendi özel verisine sahip olması
- Aile yöneticisinin özel verilere otomatik erişememesi
- Rol + nesne + sahip + işlem + süre + allow/deny yetkilendirmesi
- Renderer sandbox, context isolation ve kapalı Node erişimi
- IPC sender, ana frame, güvenilir belge ve payload bütçesi doğrulaması
- Permission/download/navigation/redirect/webview varsayılan reddi
- Sağlık, finans, çocuk, konum ve cihaz sırlarının yüksek hassasiyeti
- Cihaz özel anahtarının Electron `safeStorage` ve Windows DPAPI ile korunması
- Dijital arşiv kasa anahtarının OS korumalı zarfla saklanması ve restore sırasında hedef cihaz için yeniden sarılması
- AI için ayrı veri erişim ve işleme izni; insan onayı
- Şifreli bağımsız yedek hedefleri ve restore sonrası cihaz yeniden yetkisi
- Dayanıklı restore işlem günlüğü, açılış kurtarması ve marker öncesi rollback kopyası koruması
- Restore commit öncesinde tüm aktif güvenilir cihaz kayıtlarının iptali
- Değişikliğe dayanıklı denetim kayıtları

Ayrıntılı standarda `docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md` içinden
ulaşılır. Güvenlik kontrolü ürün sahibi onayı, risk kaydı ve telafi kontrolü
olmadan zayıflatılamaz.

## MFA sırrı koruması

TOTP MFA sırları açık veritabanı metni olarak saklanmaz. Electron `safeStorage` ve Windows DPAPI ile korunan sürümlü zarf kullanılır; legacy açık sırlar transaction içinde atomik dönüştürülür ve koruma yoksa fail-closed davranılır.

## Dijital kasa anahtarı koruması

Arşiv kasasının 32 baytlık anahtarı açık yerel dosyada tutulmaz. Electron `safeStorage`/Windows DPAPI korumalı sürüm 2 zarfı kullanılır; legacy açık anahtar atomik olarak dönüştürülür. Tam yedek içinde ham anahtar yalnız AES-256-GCM şifreli payload içindedir ve geri yüklemede hedef cihazın OS korumasıyla yeniden sarılır.

## Build 140 imzalı haricî yedek kanıtı

Uygulama yalnız güvenilen Ed25519 açık anahtarlarıyla sabit kanonik makbuzları
doğrular; özel anahtar kabul etmez. Replay, tarih, hukuki bekletme ve güven iptali
fail-closed uygulanır. Geçerli imza fiziksel imhanın mutlak kanıtı değildir.

## Build 141 sağlayıcı anahtarı döndürme

Ardıl Ed25519 anahtarı yalnız önceki güvenilen anahtarın sabit kanonik döndürme
makbuzuna attığı geçerli imzayla kabul edilir. Geçerlilik aralıkları atomik kesim
zamanıyla uygulanır; replay, parmak izi çakışması, ileri tarih, iptal ve makbuz-zamanı
güven değerlendirmeleri fail-closed çalışır. Özel anahtar hiçbir zaman alınmaz.

## Build 171 — Kalıcı bakım yeniden doğrulama kilidi

Adaptif IPC bakım yeniden doğrulama sayaçları ve geçici kilit, yalnız SHA-256 bağlam anahtarı ve zaman/sayaç alanlarıyla Electron `safeStorage` koruması altında saklanır. Parola, TOTP ve IPC payload'ı bu kayda girmez. Bozuk kayıt karantinaya alınır ve beş dakikalık fail-closed toparlanma kilidi uygulanır.

## Build 172 — cihaz bağlı bakım yeniden doğrulama durumu

- İşletim sistemi korumasındaki bakım kilidi kaydı SHA-256 cihaz bağlamına bağlanır; ham cihaz kimliği ve parmak izi kayda yazılmaz.
- Geçici koruma kesintisi geçerli kaydı silmez veya karantinaya taşımaz; bakım işlemleri fail-closed bekletilir.
- Farklı cihaz, koruma sağlayıcısı değişikliği, çözülemeyen şifreli içerik ve bütünlük hataları ayrı sınıflandırılarak karantinaya alınır.
- Eski şema kayıtları başarılı doğrulama sonrasında cihaz bağlı yeni zarfa taşınır.
- Aktif kayıt temizliği ve karantina budaması boyutla sınırlı, rastgele üzerine yazma ve `fsync` içeren en iyi çaba güvenli silme uygular; kriptografik işletim sistemi koruması ana gizlilik sınırıdır.

## Build 173 — yetkili bakım kilidi kurtarma

- Kurtarma yalnız mevcut kilit gerçekten etkinse açılır; normal bakım yetkisi açıkken durum temizliği yapılamaz.
- Etkin `family_admin` oturumu, güvenilir cihaz, parola ve etkinse TOTP veya tek kullanımlık kurtarma kodu zorunludur.
- Kurtarma girişimleri normal bakım sayacından ayrı kalıcı deneme sayacıyla sınırlandırılır.
- Operatör açık onay ifadesini yazar ve ana süreçte geri alınamaz işlem uyarısını ayrıca kabul eder.
- Başarılı işlem açık bakım oturumlarını iptal eder ve yalnız mevcut kilit/sayaç durumunu temizler; aile verileri ve adaptif bütçe değiştirilmez.
- Parola, ikinci faktör veya açık onay ifadesi günlük, telemetri ve tanı paketine yazılmaz.

## Build 175 — bakım kurtarması sonrası hesap güvenlik dönemi

- Başarılı bakım kilidi kurtarması hesap `security_epoch` değerini transaction içinde ilerletir.
- Bütün aktif güvenilir cihaz kayıtları aynı transaction içinde iptal edilir.
- Güvenilir cihaz; cihaz kimliği, kriptografik kanıt, iptal durumu ve güvenlik dönemi birlikte eşleşmeden kabul edilmez.
- Eski dönem cihazları yeniden giriş sonrasında bile otomatik güven kazanmaz; açık güçlü doğrulama ve yeniden cihaz yetkilendirmesi gerekir.
- Dönem üst sınırı veya transaction tutarsızlığı fail-closed reddedilir.

## Build 176 — güvenlik dönemine bağlı oturum ve cihaz yeniden yetkilendirme

- Her oturum açıldığı hesap `security_epoch` değerine bağlanır; hesap dönemi değiştiğinde eski oturum korunan işleme ulaşmadan temizlenir.
- Bakım kurtarması sonrası cihaz yalnız güncel oturum dönemi, parola, etkinse ikinci faktör, cihaz özel anahtar kanıtı ve açık onay birlikte doğrulanırsa yeniden güvenilir yapılır.
- Eski dönem güvenilir cihaz kaydı canlandırılmaz; güncel dönemde yeni kayıt oluşturulur.
- Başarılı işlem Ed25519 imzalı, sabit kanonik payload kullanan ve alan değişikliğinde geçersizleşen güvenlik olayı makbuzu üretir.
- Makbuz ham hesap kimliği içermez; ad alanlı SHA-256 hesap parmak izi kullanır.
- Cihaz özel anahtarı renderer'a, loga, telemetriye veya makbuza taşınmaz.

## Build 177 güvenlik merkezi menü sınırı

- Parola, 2FA, güvenilir cihaz, kurtarma sonrası yeniden yetkilendirme, imzalı güvenlik makbuzu, denetim zinciri, yedekleme ve veri yaşam döngüsü işlemleri ayrı **Güvenlik Merkezi** menüsünden erişilir.
- Güvenlik Merkezi sol menü, profil menüsü ve komut paletinde aynı route'a bağlıdır.
- Hesap güvenlik dönemi ile oturum dönemi uyuşmazlığı menüde dikkat işareti üretir.
- Cihaz yeniden yetkilendirme düğmesi parola, ikinci faktör kodu ve tam açık onay hazır olmadan IPC çağrısı yapmaz.
- Sistem ve Bakım ekranı güvenlik bileşenini iç içe çalıştırmaz; renderer prop sınırları açıkça tanımlıdır.

## Build 178 güvenlik makbuzu geçmişi

Kurtarma sonrası cihaz yeniden yetkilendirme makbuzları ana süreçte `0600` izinli, atomik ve sınırlı yerel arşivde saklanır. Geçmiş aktif hesabın SHA-256 parmak izine göre filtrelenir ve her okumada Ed25519 imzası yeniden doğrulanır. Haricî makbuz JSON'u renderer'da güvenilir kabul edilmez; şema, boyut, payload özeti ve imza ana süreçte kontrol edilir. Parola, TOTP sırrı, kurtarma kodu ve oturum belirteci arşivlenmez.

## Katı yaşam döngüsü politikası — Build 180

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.

## Build 187 kesinti kurtarma güvenliği

Saat geri alma nedeniyle kesilmiş temiz-yedek çalışması kilitli bırakılamaz veya
tarihsel olarak geriye tamamlanmış gösterilemez. Kurtarma ve geri çekilme
zamanları kalıcı başlangıç tabanından türetilir; geçersiz durum/zaman bileşimi
SQLite tarafından fail-closed reddedilir.

## Build 188 sahiplenme kronolojisi güvenliği

Sistem saati geriye alınsa bile yeni temiz-yedek çalışması kalıcı politika kronolojisinden önce başlatılamaz. Repository ve SQLite, geriye giden politika/defter zamanı, uyumsuz sahiplik alanı, değiştirilen başlangıç/kesim ve ikinci eşzamanlı `running` kaydı fail-closed reddeder.


## Build 189 operasyonel izolasyon güvenliği

`PPT-LIFECYCLE-STRICT-V1` ve `DEC-079` bağlayıcıdır. Aktif politika mutasyonu, geriye giden kesinti kurtarması ve çelişkili terminal sonuçlar fail-closed güvenlik ihlalidir.


## Build 190

Terminal retry zamanları duvar saati sıçramalarına karşı monotonik olarak korunur. Geçersiz monotonik saat sessiz başarıya çevrilemez.


## Build 191

Temiz-yedek terminal ve kesinti retry zamanı çalışma tetikleyicisine bağlıdır. Yanlış gecikme doğrudan SQLite yazımında da fail-closed reddedilir.

## Build 192 manuel kullanılabilirlik güvenliği

Otomatik planlamanın kapatılması açık yönetici komutunu engellemez; ancak otomatik claim devre dışı politikada oluşturulamaz. Manuel yol backoff, tek sahiplik ve kronoloji kurallarından muaf değildir.


## Build 193 çalışma defteri kimliği güvenliği

Yetim veya politika sahibiyle eşleşmeyen `running` temiz-yedek defteri, tek-çalışma kilidini kötüye kullanmadan önce SQLite tarafından reddedilir. Aktif sahip satırı silinemez veya kimlik/tetikleyici değişikliğine uğratılamaz. `DEC-083` ve `ADR-066` bağlayıcıdır.


## Build 195 aktif sahiplik anlık görüntüsü güvenliği

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 aktif politika parametre bütünlüğü

Aktif temiz-yedek çalışması sırasında saklama ve geri çekilme parametreleri değiştirilemez.
