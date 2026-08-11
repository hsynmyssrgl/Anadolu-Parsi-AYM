# Build 170 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.170`
- Package Version: `29.7.2026-170`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 167'nin tek kullanımlık bakım oturumu, Build 168'in merkezi yetki politikası ve Build 169'un güçlü yeniden doğrulaması korunur. Build 170, güçlü yeniden doğrulama hatalarını yalnız SHA-256 kimlik bağlamı anahtarıyla izleyen, sınırlı ve geçici bir çalışma zamanı koruması ekler.

## Mimari sonuç

- Beş sayılan hata sonrasında beş dakikalık geçici kilit uygulanır.
- Hata penceresi on dakika, bağlam kapasitesi 256 kayıtla sınırlıdır.
- Yalnız `AUTH_INVALID_CREDENTIALS` ve `AUTH_SECOND_FACTOR_INVALID` hataları sayılır.
- Başarılı güçlü doğrulama aynı bağlamın sayacını temizler.
- Kilit, bakım yetkisi hesaplanırken fail-closed değerlendirilir.
- Kimlik bilgileri sayaç durumunda, denetim metadatasında veya tanı verisinde tutulmaz.
- Renderer kalan deneme ve bekleme bilgisini gösterir; kilitli kontroller kapalıdır.
- Sayaç çalışma zamanı kapsamındadır ve uygulama yeniden başlatıldığında sıfırlanır; bu sınır ADR-043'te açıkça kayıtlıdır.
- Build 167, 168 ve 169 güvenlik sınırları korunur.
- Active stage korunur.
