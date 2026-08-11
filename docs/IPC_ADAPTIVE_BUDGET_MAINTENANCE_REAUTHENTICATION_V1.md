# Adaptif IPC Bakım Güçlü Yeniden Doğrulama V1

## Amaç

Adaptif IPC bütçesini sıfırlama ve teknik tanı paketi oluşturma işlemlerini, yalnız açık yönetici oturumuna değil, işlem anındaki güçlü yeniden doğrulamaya bağlamak.

## Güvenlik zinciri

1. Etkin ve süresi dolmamış oturum doğrulanır.
2. Rolün `family_admin` olduğu doğrulanır.
3. Geçerli ve güvenilir cihaz kimliği doğrulanır.
4. Hesap parolası yeniden doğrulanır.
5. TOTP etkinse ikinci faktör kodu doğrulanır.
6. Kullanıcıya işlem türüne özel yerel onay gösterilir.
7. Gönderici, renderer oturumu, kimlik bağlamı ve işlem türüne bağlı tek kullanımlık 90 saniyelik bakım oturumu açılır.
8. Oturum yalnız aynı işlem için bir kez tüketilir.

## Veri minimizasyonu

- Parola ve TOTP kodu diske yazılmaz.
- Kimlik bilgileri denetim günlüğüne, IPC telemetrisine veya tanı paketine girmez.
- Denetim kaydı yalnız işlem türü, gönderici ve ikinci faktör gereksinimi gibi teknik metadata taşır.
- Renderer kimlik alanlarını başarılı, iptal veya hatalı işlemden sonra temizler.

## IPC sınırı

Bakım oturumu açma kanalı tam olarak üç argüman kabul eder: işlem türü, sınırlı renderer oturum kimliği ve yalnız `password` / isteğe bağlı `code` alanlarını taşıyan kimlik nesnesi. Bilinmeyen alan, boş parola, aşırı uzun değer veya eksik argüman fail-closed reddedilir.
