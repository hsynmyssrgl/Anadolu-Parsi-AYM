# B0-03/B0-04 Ürün Yüzeyi Yönetişim Tehdit Modeli

## Korunan varlıklar

- 17 ürün modülü ve 5 yönetişim yüzeyinden oluşan 22 rotalık kanonik sözleşme
- Renderer menüsü ile gerçek ekran dispatch zincirinin birebirliği
- Main/preload/renderer API gerçekliği
- `COMPLETE` gereksinimlerin 13 alanlı kanıt zinciri
- Güncel 14 kullanılmayan renderer API'sinin exact sınıflandırması

## Tehditler ve kontroller

1. **Sessiz menü drift'i:** Renderer yerel rota veya menü listesi tanımlayamaz;
   liste paylaşılan domain sabitlerinden üretilir.
2. **Dead UI:** Her kanonik rota exact bir ekran dispatch koluna bağlanır; eksik,
   fazla veya duplicate rota build kapısını durdurur.
3. **Dead API saklama:** Preload ile main kayıtları kaynak koddan çıkarılır,
   renderer referanslarıyla karşılaştırılır ve kullanılmayan küme exact 14 kayıtla
   eşleşmek zorundadır.
4. **Sınıflandırmasız API ekleme:** Yeni kullanılmayan API, kapalı taksonomi ve
   açık envanter kaydı olmadan kabul edilmez.
5. **Yanlış COMPLETE:** Herhangi bir zincir alanı false veya eksikse Feature
   Reality Gate fail-closed reddeder.
6. **Kapıyı sahte güvenceyle geçirme:** Eksik rota, sahte API ve false evidence
   mutasyonları her çalışmada negatif öz-test olarak doğrulanır.
7. **İstemciden yetki türetme:** IPC yalnız içeriksiz yönetişim sayımları ve
   sınıflandırma özeti taşır; kullanıcı verisi veya yeni yetki üretmez.
8. **Kapsam şişirme:** B9-01 ve genel Bronze kapanışı açık bırakılır; bu paket
   yalnız B0-03/B0-04 kabul ölçütlerini kapatır.

## Kalıntı risk

14 API'nin 11'i B9-01 uyumluluk incelemesi sonrası kaldırılabilir, 3 arka plan
operasyon API'si non-UI tutulabilir. Bu karar verilene kadar API'ler sınıflı ve
görünürdür; gizli dead-code olarak değerlendirilmez. Yeni veritabanı migration'ı
ve kullanıcı verisi işlemi bulunmaz.
