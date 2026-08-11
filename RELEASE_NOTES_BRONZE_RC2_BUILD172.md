# Bronze RC2 Build 172 Sürüm Notları

## Yeni

- İşletim sistemi korumalı bakım yeniden doğrulama durumu için şema 2 korunan zarf.
- Cihaz kimliği ve açık anahtar parmak izinden üretilen SHA-256 cihaz bağlama özeti.
- Geçici `safeStorage` kullanılamazlığında aktif dosyayı koruyan ve bakım işlemlerini fail-closed tutan davranış.
- Farklı cihaz, farklı koruma sağlayıcısı, çözme hatası, bütünlük hatası ve şema hatası için ayrı sınıflandırmalar.
- Build 171 şema 1 durumunun başarılı yükleme sonrasında otomatik şema 2 yükseltmesi.
- Aktif kayıt temizliği ve karantina budaması için boyutla sınırlı en iyi çaba güvenli silme.

## Gizlilik

- Ham cihaz kimliği veya parmak izi korunan zarfa yazılmaz.
- Parola, TOTP, kullanıcı adı, renderer oturum kimliği, IPC argümanı veya payload saklanmaz.
- Denetim günlüğü yalnız sınıflandırma, durum ve yeniden yazım sonucunu taşır; karantina yolu veya cihaz bağlama özeti yazılmaz.

## Korunan davranış

- Build 167'nin tek kullanımlık ve 90 saniyelik bakım oturumları korunur.
- Build 168'in etkin `family_admin`, geçerli oturum ve güvenilir cihaz politikası korunur.
- Build 169'un parola ve etkinse TOTP ile güçlü yeniden doğrulaması korunur.
- Build 170'in beş deneme, beş dakika kilit, on dakika pencere ve 256 bağlam sınırı korunur.
- Build 171'in atomik, işletim sistemi korumalı kalıcılığı ve karantina/toparlanma kilidi korunur.
- Aşama Bronze RC2 Active Development olarak kalır.
