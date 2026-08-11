# Güvenlik Başlangıç Çizgisi — Build 185

**Aktif sürüm:** 02.08.2026.228

Ayrıntılı uzmanlık standardı:
`docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md`.

## Temel ilke

Kimlik, veri erişimi, IPC, dosya, yedek, dışa aktarım ve AI işlemlerinde
varsayılan davranış reddetmektir. Yalnız açık, izlenebilir ve en az yetkili
erişime izin verilir.

## Masaüstü ayarları

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `webviewTag: false`
- `navigateOnDragDrop: false`
- Uzak içerik ve yeni pencere varsayılan engelli
- IPC kanalları açık listeli ve sender/payload doğrulamalı
- Uygulama genelinde `app.enableSandbox()` zorunlu
- Başlangıçta güvenli renderer tercihleri kod sözleşmesiyle doğrulanır
- `--no-sandbox`, `--single-process` ve güvenlik özelliği kapatan anahtarlar normal çalışmada reddedilir

## Kimlik ve cihaz

- Windows Hello tercihli
- Güçlü parola, canlı koşul/eşleşme göstergesi
- TOTP, kurtarma kodu, FIDO2/WebAuthn genişletilebilirliği
- 15 dakika idle lock
- 5 başarısız girişte 15 dakika hesap kilidi
- Kriptografik güvenilir cihaz ve geri çekme
- Cihaz özel anahtarının Electron `safeStorage` / Windows DPAPI ile korunması
- Dijital arşiv kasa anahtarının Electron `safeStorage` / Windows DPAPI ile korunması
- Legacy açık kasa anahtarının atomik korumalı-zarf migration akışı
- Tam yedek restore sırasında kasa anahtarının hedef cihaz için yeniden sarılması
- Eski açık cihaz kimliğinin atomik şifreli-zarf geçişi ve fail-closed davranış
- Yeni cihaz/restore sonrası yeniden yetkilendirme
- Geri yükleme işlem günlüğü, çökme sonrası otomatik rollback/cleanup
- Restore commit öncesinde tüm aktif güvenilir cihaz kayıtlarının iptali
- OS sır koruması için her açılışta şifreleme turu ve kalıcı korumalı sentinel doğrulaması
- Windows kanıtında ilk süreç `created`, ikinci süreç `verified` olmalıdır

## Yetkilendirme

Rol tek başına yeterli değildir. Aktör, aile, aile dalı, veri sahibi, nesne,
işlem, amaç, süre, allow/deny ve AI izni birlikte değerlendirilir. Açık ret
önceliklidir. Aile yöneticisi özel yetişkin verisine otomatik erişmez.

## Hassas veri

Sağlık, finans, çocuk, canlı konum, kimlik belgesi ve cihaz sırları yüksek
hassasiyetlidir. Şifreleme, log maskeleme, ayrı izin alanı ve denetim zorunludur.

## Yapay zekâ

- Varsayılan kapalı
- Veri erişim izni ile AI işleme izni ayrı
- Kişisel ve aile hafızası ayrılmış
- Öneri kesin kayıt değildir
- Kaynak/güven düzeyi ve insan onayı gerekir
- Kullanıcı AI hafızasını görebilir, düzeltebilir ve silebilir

## Yedekleme

Yerel disk, harici disk ve bulut adapter hedefleri bağımsızdır. Bir hedef hatası
diğerini durdurmaz. En az bir tam/doğrulanmış yedek korunur. Yeni cihaz restore
sonrası otomatik güvenilir değildir.

## Güvenlik değişikliği

Bir kontrolü kaldırmak veya zayıflatmak; karar kaydı, risk kabulü, telafi
kontrolü ve ürün sahibi onayı olmadan yapılamaz.

- TOTP sırları veritabanında açık tutulmaz; Electron `safeStorage` ve Windows DPAPI korumalı zarf kullanılır.
- Legacy açık TOTP sırları transaction içinde atomik olarak dönüştürülür; zorunlu koruma yoksa işlem fail-closed reddedilir.

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Askıdaki API güvenlik sınırı — Build 182

`PPT-LIFECYCLE-STRICT-V1` altında API adaptörünün askıya alınması kimlik, sır yönetimi, rıza, en az yetki, veri minimizasyonu, audit, timeout/retry ve fail-closed hata sözleşmelerini ertelemez. Gerçek token veya sağlayıcı sırrı kaynakta, logda, test verisinde ya da renderer’da bulunamaz.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 güvenlik sınırı

Politika değişikliği güçlü yeniden doğrulama gerektirir. Parola/TOTP, yedek parolası veya kullanıcı veri içeriği politika ve tanı kayıtlarına yazılmaz. Kesinti sessiz başarıya çevrilmez; `running` durum yeniden başlatmada 360 dakikalık geri çekilmeye alınır.

## Build 184 güvenlik sınırı

Eski veya yabancı `runId` temiz yedek politikasını sonuçlandıramaz. Politika sahibi ile `running` defter satırı aynı kimlikte değilse işlem fail-closed reddedilir. Çalışma geçmişi yalnız operasyon metadatası taşır; parola, TOTP, yedek sırrı ve kullanıcı veri içeriği yazılmaz.

## Build 185 güvenlik sınırı

Yedek yayılımı gerçek dosya işlemleri tamamlanmadan tamamlanmış gösterilemez.
Monotonik saat geçersiz veya geriye gidiyorsa ilgili karantina/tombstone adımı
fail-closed durur. Kronoloji verisi kullanıcı içeriği, parola, TOTP veya yedek
sırrı taşımaz.

## Build 186 güvenlik sınırı

Eksik propagation bağlantısı, geçersiz zaman, üst çalışma başlangıcından önce
propagation başlangıcı ve propagation tamamlanmasından önce üst sonuçlandırma
fail-closed reddedilir.

## Build 187 güvenlik sınırı

Saat geri alma, kesilmiş temiz-yedek çalışmasını kalıcı kilide dönüştüremez.
Geçersiz tarih, eksik sahiplik veya tamamlanmadan önceki sonraki deneme
fail-closed reddedilir. Tanı kayıtları yalnız teknik zaman ve çalışma durumunu
taşır; kullanıcı verisi, yedek içeriği ve sır içermez.

## Build 188 güvenlik sınırı

Saat geri alma, yeni temiz-yedek çalışmasını geçmiş başarı veya politika güncellemesinden önce başlatamaz. Geri çekilme zamanı claim tabanına katılmaz; böylece saat manipülasyonu bekleme süresini atlayamaz. Geçersiz kalıcı tarih ve doğrudan geriye giden repository girdisi fail-closed reddedilir.

## Build 189 güvenlik sınırı

Aktif çalışma sırasında ayar mutasyonu fail-closed reddedilir. Terminal politika/çalışma eşleşmesi, hata ve sonraki deneme alanları dahil SQLite tarafından doğrulanır.


## Build 190 güvenlik sınırı

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 güvenlik sınırı

Yanlış trigger/backoff eşleşmesi doğrudan SQL dahil fail-closed reddedilir; mevcut sahiplik ve kesinti kurtarma korunur.

## Build 192 güvenlik sınırı

Manuel kullanılabilirlik otomatik planlamayı sessizce açamaz ve backoff'u atlayamaz. `enabled=0` altında otomatik çalışma sahiplenmesi repository ve doğrudan SQLite yazımında fail-closed reddedilir.



## Build 193 güvenlik sınırı

`running` defter id/trigger/start/update kronolojisi politika sahibiyle aynı olmalıdır. Aktif satırın silinmesi veya yeniden sahiplenilmesi fail-closed reddedilir. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 güvenlik sınırı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 güvenlik sınırı

Aktif çalışma sonuç politikasını etkileyen saklama ve geri çekilme parametreleri çalışma sırasında değiştirilemez.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Kişisel kimlik ve temiz production başlangıcı

Aktif kaynak/metadata/belge/görselde doğal kişi veya özel aile kimliği tutulmaz. Production uygulaması hazır aile/kişi/demo seed verisiyle başlatılamaz. Test fixture’ları anonim/nötr ve production bundle’dan ayrık olmak zorundadır.

## Build 210 — Terminal çalışma kanıtı değişmezliği

Tamamlanmış temiz-yedek run ledger satırı audit/evidence niteliğindedir. Terminal satır sonradan UPDATE/DELETE edilemez ve primary-key çatışması üzerinden REPLACE ile yeniden kurulamaz. Koruma yalnız repository katmanına değil SQLite trigger sınırına uygulanır; fail-closed davranış güvenlik taban çizgisidir.
