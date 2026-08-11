# DEC-135 — B2-01 Windows Hello Temeli

## Durum

Kabul edildi ve 30-K kapsamında uygulanıyor.

## Karar

Windows Hello, uygulama hesabının parolasının yerine geçen bağımsız bir hesap sistemi olarak değil, Windows'un mevcut kullanıcı doğrulamasını uygulama hesabına bağlayan ek bir kimlik doğrulama yöntemi olarak kullanılır. Electron/Win32 yerel istemi, etkin uygulama penceresinin `HWND` değeriyle `IUserConsentVerifierInterop.RequestVerificationForWindowAsync` sınırından açılır; UWP'ye özel statik `RequestVerificationAsync` masaüstü doğrulaması olarak kullanılamaz. Uygulama Windows Hello PIN'ini, biyometrik şablonu veya ham Windows güvenlik tanımlayıcısını okuyamaz ve saklayamaz.

Başarılı kayıt; uygulama hesap kimliği, uygulamanın korumalı cihaz kimliği ve parmak izi, SHA-256 ile özetlenmiş Windows kullanıcı kimliği ve hesabın güncel güvenlik dönemiyle bağlanır. Bu bağlardan biri değişirse kayıt fail-closed olarak geçersizleştirilir ve yeni oturum başlatılmaz.

## İşlem ve geri dönüş politikası

- Kayıt, etkin ve güncel oturumun parolayla; hesapta iki aşamalı doğrulama açıksa ayrıca geçerli TOTP koduyla doğrulanmasını gerektirir.
- Windows Hello uygunluk denetimi ve kullanıcı doğrulama istemi sırasında SQLite transaction açık tutulmaz.
- Yerel köprü yalnız korumalı ve sabit `C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe` yolundan başlatılır; `PATH`, `SystemRoot` veya başka sürücüdeki executable güven sınırı sayılmaz. Windows'u standart olmayan bir köke kuran sistem bu foundation'da fail-closed `native_process_failure` sonucunu alır.
- PowerShell kontrol akışı sabit `EncodedCommand` içinde kalır. Ortamdan yalnız sabit C# HWND interop kaynağı veri olarak aktarılır; derlenmeden önce kesin byte uzunluğu ve sabit SHA-256 özeti doğrulanır. İstem metni ve `HWND` değeri ayrı veri alanlarıdır; ortam verisinden PowerShell kontrol akışı oluşturulmaz.
- Etkin ve sıfırdan farklı bir Electron `BrowserWindow` tanıtıcısı bulunmazsa yerel istem başlatılmaz ve `window_handle_unavailable` döner.
- Başarılı yerel istemden sonra hesap, kayıt, cihaz parmak izi, Windows kullanıcı özeti ve güvenlik dönemi transaction içinde yeniden doğrulanır.
- Kullanıcı iptali, yeniden deneme hakkının tükenmesi, cihazın meşgul veya yapılandırılmamış olması ve yerel hata yanlış parola denemesi sayılmaz.
- Parola geri dönüşü yalnız çağıranın açıkça sağladığı kimlik bilgileriyle çalışır ve mevcut kanonik giriş, MFA, kilitlenme, trusted-device ve güçlü yeniden doğrulama kurallarını yeniden kullanır.
- Cihaz, Windows kullanıcısı veya güvenlik dönemi uyuşmazlığı kayıt iptali ve zincirli audit kanıtı üretir.
- Aynı hesap ve cihaz için yalnız bir etkin kayıt bulunabilir; yeniden kayıt eski kaydı silmez, tarihsel olarak iptal eder.

## Kanıt sınırı

Kontrollü platform portuyla çalıştırılan senaryolar application, repository, migration, audit, geri dönüş ve değişiklik algılama davranışını doğrular; gerçek Windows Hello kullanıcı etkileşimi yerine geçmez. Salt-okunur yerel uygunluk kontrolü gerçek makinede çalıştırılabilir, ancak yerel doğrulama penceresi gerçekten tamamlanmadan etkileşimli Windows Hello doğrulaması `PASS` sayılamaz.

## Teslim sınırı

30-K domain, şema, migration, repository, application use-case, yerel Windows adaptörü, parola geri dönüşü ve hedefli doğrulama temelini kapsar. Masaüstü IPC, preload/global tipleri, kullanıcı arayüzü ve menü bağlantısı sonraki governed teslimde tamamlanacaktır; bu nedenle B2-01 30-K sonunda yalnız `PARTIAL_FOUNDATION` olabilir.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
