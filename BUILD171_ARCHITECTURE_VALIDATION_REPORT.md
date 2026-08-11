# Build 171 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.171`
- Package Version: `29.7.2026-171`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 167'nin tek kullanımlık bakım oturumu, Build 168'in merkezi yetki politikası, Build 169'un güçlü yeniden doğrulaması ve Build 170'in sınırlı deneme/geçici kilit davranışı korunur. Build 171, yalnız SHA-256 bağlam anahtarı ile zaman/sayaç alanlarını işletim sistemi sır koruması altında kalıcılaştırır.

## Mimari sonuç

- Sayaç ve kilit durumu Electron `safeStorage` üzerinden işletim sistemi korumasıyla şifrelenir.
- Kalıcı payload parola, TOTP, kullanıcı adı, IPC payload'ı veya oturum belirteci içermez.
- Korunan zarf; şema, sağlayıcı kimliği, dosya boyutu ve SHA-256 bütünlüğü doğrulanmadan kabul edilmez.
- Yazım, ayrı geçici dosya, `fsync`, atomik yeniden adlandırma ve mümkün olduğunda `0600` kipinde yapılır.
- Uygulama yeniden başlatıldığında başarısız deneme sayısı ve özgün kilit bitiş zamanı geri yüklenir.
- Süresi dolan kilitler ve on dakikalık pencereyi aşan denemeler kalıcı kayıttan da temizlenir.
- Bozuk/değiştirilmiş kayıt karantinaya alınır; en fazla dört karantina dosyası tutulur.
- Reddedilen kayıt sonrasında beş dakikalık global güvenli toparlanma kilidi oluşturulur ve yeni korunan kayda yazılır.
- Normal kapanış yalnız bellek içi kopyayı temizler; kalıcı güvenlik durumu silinmez.
- Active stage korunur; otomatik Final, Freeze, Silver veya Gold geçişi yapılmaz.
