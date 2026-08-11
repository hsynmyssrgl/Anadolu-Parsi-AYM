# Bronze RC2 Build 169 Sürüm Notları

## Yeni

- Adaptif IPC bakım oturumu öncesinde hesap parolasıyla güçlü yeniden doğrulama.
- TOTP etkin hesaplarda zorunlu ikinci faktör doğrulaması.
- Bakım yetki görünümünde güçlü doğrulama ve 2FA gereksinimi.
- IPC kimlik girdilerinde yalnız izinli alanlar ve uzunluk sınırları.
- Renderer'da işlem sonucu ne olursa olsun parola ve 2FA alanlarını temizleme.
- Kimlik bilgisi içermeyen yeniden doğrulama başarı denetim olayı.

## Korunan davranış

- Build 167'nin tek kullanımlık, işlem türüne bağlı ve 90 saniyelik bakım oturumları korunur.
- Build 168'in etkin `family_admin`, süresi dolmamış oturum ve güvenilir cihaz politikası korunur.
- Aşama Bronze RC2 Active Development olarak kalır.
- Bağlı npm yanıt paketi dönmeden geniş RC2 kapıları çalıştırılmış sayılmaz.
