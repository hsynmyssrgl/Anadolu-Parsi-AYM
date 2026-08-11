# 31-H — Core Service korumalı aile-verisi oturumu sahiplik kontrol düzlemi

## Sonuç

31-H, Core Service’in korumalı bir aile-verisi oturum portu gerçekten bağlanmadan sahiplik veya yazılabilirlik iddia etmesini engelleyen kontrol düzlemini kurar. Başlangıç gerçeği `desktop-transition / detached / none / writable=false / epoch=0` durumudur.

## Teslim edilen ana yapı

- Kanonik Core Service yöntem haritasında tip güvenli `family-data.status` çağrısı.
- Gerçek oturum portu bağlantısı ile başlayan, monoton epoch kullanan ve mükerrer bağlantıyı reddeden sahiplik yaşam döngüsü.
- Kapanışta sunucunun durdurulmasından sonra oturumu mühürleyen, mühürleme hatasında fail-closed kalan süreç sırası.
- Architecture manifest ile aile-verisi durumunun aynı sahipliği bildirmesini zorunlu tutan Desktop başlangıç el sıkışması.
- İstemci protokolünde kalıcı veritabanı yolu yayınlamayan `persistentPathExposed=false` sözleşmesi.

## Doğrulama sınırı

Yerel PASS; 44 maddelik 31-H sözleşme kapısı, kök TypeScript kontrolü, etkilenen üç paket derlemesi, iki dosyada 5 hedefli test, sekiz sistem kapısı, 178 testlik tam regresyon ve üretim derlemesi ile verilir.

## Açık kalanlar

Korumalı kasa oturumunun süreçler arası devri, Core Service’in gerçek SQLite tek-yazar sahipliği, aile graph okuma/yazma API’leri, backup/sync sahipliği ve onay gerektiren Windows servis kurulumu bu dilimde COMPLETE değildir. DHA-001, PPK-003 ve PPK-014 açık kalır; yeni Build verilmez.
