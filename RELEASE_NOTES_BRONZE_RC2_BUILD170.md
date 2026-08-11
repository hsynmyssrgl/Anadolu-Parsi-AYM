# Bronze RC2 Build 170 Sürüm Notları

## Yeni

- Adaptif IPC bakım yeniden doğrulamasında beş başarısız deneme sınırı.
- Beşinci sayılan hata sonrasında beş dakikalık geçici bakım kilidi.
- On dakikayı aşan eski hata denemelerinin otomatik sıfırlanması.
- Başarılı güçlü doğrulamada hata sayacının hemen temizlenmesi.
- Yalnız yanlış parola ve yanlış ikinci faktör kodunun sayaçta değerlendirilmesi.
- En fazla 256 kimlik bağlamıyla sınırlandırılmış geçici bellek kaydı.
- Yetki görünümünde kalan deneme, kilit ve yeniden deneme süresi.
- Renderer'da başarısız işlem sonrasında yetki durumunun yeniden yüklenmesi.
- Kimlik bilgisi içermeyen başarısız yeniden doğrulama denetim olayı.

## Korunan davranış

- Build 167'nin tek kullanımlık, işlem türüne bağlı ve 90 saniyelik bakım oturumları korunur.
- Build 168'in etkin `family_admin`, süresi dolmamış oturum ve güvenilir cihaz politikası korunur.
- Build 169'un parola ve etkinse TOTP ile güçlü yeniden doğrulama sınırı korunur.
- Parola ve TOTP; oturum, sayaç, günlük, telemetri ve tanı paketine yazılmaz.
- Aşama Bronze RC2 Active Development olarak kalır.
- Bağlı npm yanıt paketi dönmeden geniş RC2 kapıları çalıştırılmış sayılmaz.
