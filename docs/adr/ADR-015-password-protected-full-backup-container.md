# ADR-015 — Parola Korumalı Tam Yedek Kapsayıcısı

- Tarih: 27.07.2026
- Durum: Kabul edildi
- Build: 130

## Bağlam

Önceki v2 tam yedek biçimi veritabanı ve kasa anahtarını JSON içinde Base64
olarak taşıyordu. Base64 şifreleme değildir ve yedek dosyasına erişen kişi kritik
sırlara erişebilirdi.

## Karar

Yeni yedek biçimi `anadolu-parsi-full-backup` v3 olacaktır. İç payload
PBKDF2-SHA512 (310.000 iterasyon, 32 bayt salt) ile türetilen anahtar ve
AES-256-GCM (12 bayt IV, 16 bayt doğrulama etiketi) kullanılarak şifrelenir.
Format, sürüm, tarih ve KDF parametreleri AAD kapsamındadır. Parola 12-1024
karakter arasında olmalıdır. Yanlış parola ve bütünlük bozulması aynı güvenli
hata yüzeyinde reddedilir.

Otomatik yedek hedefleri için parola işletim sistemi güvenli depolamasıyla
korunan yönetilen bir sırdır. v1/v2 yalnız legacy geri yükleme için okunur ve
yeni üretimde kullanılmaz.

## Sonuçlar

- Yedek başka cihaza kullanıcı parolasıyla taşınabilir.
- Parola kaybında yedek kurtarılamaz; UI bunu açıkça bildirir.
- Eski yedeklerin güvenilir ortam dışında tutulmaması gerekir.
- Gerçek Windows DPAPI ve installer yaşam döngüsü testi Silver öncesi kapıdır.
