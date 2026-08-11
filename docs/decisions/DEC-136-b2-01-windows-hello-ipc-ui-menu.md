# DEC-136 — B2-01 Windows Hello IPC, Arayüz ve Menü Sınırı

## Durum

Kabul edildi ve 30-L kapsamında uygulanıyor.

## Karar

30-L, 30-K temelini güvenilir ve korelasyonlu Electron IPC, güçlü tipli preload/global köprüsü, görünür Windows Hello ekranı, giriş düğmesi ve menü bağlantısıyla tamamlar. Kilitli kasada yalnız korumalı Windows Hello yuvasının varlığı okunur; hesap, kayıt, cihaz, Windows kullanıcısı ve veri anahtarı başlıkta açık metin olarak tutulmaz.

Kilitli giriş yalnız kullanıcının görünür düğmeye basmasıyla başlar. Ana süreç, güvenilir renderer göndericisi ile IPC request/correlation kimliğine, cihaz kimliğine ve cihaz parmak izine bağlı; en çok 30 saniye geçerli ve tek kullanımlık bir izin üretir. İzin yalnız aynı istek içinde, başarılı ve değişmemiş Windows principal özetiyle kullanılabilir. Hazırlanmış doğrulama yalnız bir kez replay edilir; ikinci kullanım fail-closed reddedilir ve başarılı girişten sonra önbellekteki doğrulama silinir.

Renderer tarafından gönderilen hesap kimliği yalnız kullanıcı arayüzü seçim ipucudur. Korumalı kasa yuvasından çözülen hesap kimliği otoritedir; ikisi birebir eşleşmezse oturum açılmaz. Aynı anda yalnız bir Windows Hello işlemi yürütülür. Parola girişi, parola değişimi veya çıkış bu istem sürerken başlatılamaz.

## Kasa ve anahtar sınırı

- Uygulama veri anahtarı, mevcut parola anahtar yuvasında parola türetimi ile işletim sistemi `safeStorage`/DPAPI korumasının birlikte kullanıldığı mevcut düzeni korur.
- Windows Hello yuvası aynı veri anahtarını, yalnız ana süreçte işletim sistemi koruması altında tutar; Windows Hello doğrulaması bu zarfı açmaya izin veren process-enforced kullanıcı faktörüdür.
- `UserConsentVerifier` kriptografik anahtar üretmez ve donanım bağlı anahtar unwrap işlemi sağlamaz. Bu tasarım Windows Hello sonucunu ana süreç kapısı olarak uygular; aynı Windows kullanıcısı bağlamındaki zararlı kodu veya yönetici yetkili saldırganı kriptografik olarak yalıttığını iddia etmez. PR-161 sınırlaması değişmeden korunur.
- Parola anahtar yuvası kaldırılmaz; Windows Hello tek başına kurtarma veya veri taşıma anahtarı değildir.
- Yalnız bir etkin kilitli-giriş Windows Hello yuvası bulunur. Yeniden kayıt önceki yuva yerine yeni korumalı bağı yazar.

## İptal, hata ve geri dönüş

- IPC iptali veya süre aşımı; istemden önce, istemden sonra, kasa açılmadan önce ve oturum başlatılmadan önce yeniden kontrol edilir. İptal edilmiş renderer isteği arka planda oturum başlatamaz.
- İstem sonrasında cihaz kimliği/parmak izi yeniden okunur. Assessment ve verification Windows principal özetleri eşleşmeden izin üretilmez.
- Cihaz, principal veya yuva bütünlüğü uyuşmazlığında tek kilitli-giriş yuvası temizlenir; başarısız açılıştaki çözülmüş veritabanı checkpoint edilmez.
- Kayıt veritabanına yazıldıktan sonra kasa yuvası ya da checkpoint başarısız olursa tüm volatile veritabanı ve kasa anahtarı bırakılır. Böylece sonraki ilgisiz checkpoint yarım kaydı kalıcılaştıramaz.
- Logout, zaman aşımı, uygulama kapanışı veya mühürleme hatası; volatile oturumu kapatır ve veri anahtarını `finally` sınırında siler.
- Windows Hello iptali parolayı otomatik göndermez. Normal parola formu her zaman görünürdür. Yeniden doğrulamadaki parola geri dönüşü yalnız ayrı ve açık kullanıcı eylemiyle gönderilir.

## Kanıt ve teslim sınırı

Sözleşme doğrulaması IPC/policy/preload/global/route/menu zincirini; kontrollü çalışma zamanı doğrulaması ise tek kullanımlık istek bağı, replay, kasa yuvası, parola sürekliliği ve olumsuz senaryoları ölçer. Kontrollü platform gerçek Windows Hello kullanıcı etkileşimi değildir.

30-L kalıcı paket ve receipt zinciri tamamlanırsa IPC, arayüz ve menü teslimi `COMPLETED` olabilir. Gerçek HWND bağlı Windows Hello penceresi kullanıcı tarafından başarıyla tamamlanıp ayrı kanıt üretilmedikçe B2-01 `PARTIAL_IPC_UI_MENU_COMPLETE_NATIVE_INTERACTIVE_PENDING`, yerel etkileşim ise `NOT_RUN_NOT_PASS` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
