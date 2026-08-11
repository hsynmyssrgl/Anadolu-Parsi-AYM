# Bronze RC2 Build 171 Sürüm Notları

## Yeni

- Adaptif IPC bakım yeniden doğrulama deneme ve kilit durumunun yeniden başlatmalar arasında korunması.
- Electron `safeStorage` ile işletim sistemi korumalı şifreli durum payload'ı.
- Atomik geçici dosya, `fsync`, yeniden adlandırma ve kısıtlı dosya izniyle çökme güvenli yazım.
- Korunan zarf için sağlayıcı, şema, boyut ve SHA-256 bütünlük doğrulaması.
- Bozuk veya değiştirilen durum kaydının karantinaya alınması.
- En fazla dört karantina dosyasıyla sınırlı saklama.
- Reddedilen kayıt sonrasında beş dakikalık global güvenli toparlanma kilidi.
- Süresi dolan kilit ve eski denemelerin hem bellekten hem kalıcı kayıttan temizlenmesi.
- Normal kapanışta yalnız bellek kopyasının temizlenmesi; kalıcı kilit durumunun korunması.

## Gizlilik

- Kalıcı kayıtta yalnız SHA-256 bağlam anahtarı, başarısız deneme sayısı ve zaman alanları bulunur.
- Parola, TOTP, kullanıcı adı, renderer oturum kimliği, IPC argümanı veya payload saklanmaz.
- Karantina dosya yolu denetim günlüğüne yazılmaz; yalnız karantina uygulanıp uygulanmadığı kaydedilir.

## Korunan davranış

- Build 167'nin tek kullanımlık, işlem türüne bağlı ve 90 saniyelik bakım oturumları korunur.
- Build 168'in etkin `family_admin`, süresi dolmamış oturum ve güvenilir cihaz politikası korunur.
- Build 169'un parola ve etkinse TOTP ile güçlü yeniden doğrulaması korunur.
- Build 170'in beş deneme, beş dakika kilit, on dakika pencere ve 256 bağlam sınırı korunur.
- Aşama Bronze RC2 Active Development olarak kalır.
