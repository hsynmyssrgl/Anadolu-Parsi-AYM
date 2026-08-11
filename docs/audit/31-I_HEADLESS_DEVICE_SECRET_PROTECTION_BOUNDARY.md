# 31-I — Headless cihaz-sır koruma sınırı

## Sonuç

Windows CurrentUser DPAPI cihaz-sır korumasının tek uygulama sahipliği `@ppt/security` paketine taşındı. Desktop’ın eski modül yolu yalnız uyumluluk re-export katmanıdır. Core Service, sağlayıcı enjekte edilmedikçe `detached`; sağlayıcı eklendiğinde gerçek kullanılabilirlik sonucuna göre `ready` veya `unavailable` bildirir.

## Güvenlik sınırı

- Core Service istemci protokolü yalnız durum bilgisi taşır.
- Anahtar, parola, korunan zarf, veritabanı yolu veya Electron bağımlılığı protokol sonucuna çıkmaz.
- Durum kontrol düzlemi `protect`/`unprotect` işlemlerini çağırmaz.
- Gerçek kasa açma ve bellek-içi SQLite sahipliği sonraki dilimlere açık bırakılmıştır.

## Doğrulama sınırı

31-I sözleşme kapısı, kök TypeScript, security/Core Service paket derlemeleri, üç dosyada 9 hedefli test, sistem kapıları, kasa/DPAPI geriye dönük kapıları, tam Vitest ve üretim derlemesiyle kanıtlanır. DHA-001, PPK-013 ve PPK-014 COMPLETE değildir; yeni Build verilmez.
