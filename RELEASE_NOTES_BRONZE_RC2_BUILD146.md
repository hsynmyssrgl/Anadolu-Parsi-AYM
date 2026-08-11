# Sürüm Notları — Bronze RC2 Build 146

**Uygulama:** Anadolu Parsı Aile Yaşam Merkezi  
**Sürüm:** `28.07.2026.146`  
**Paket:** `28.7.2026-146`  
**Aşama:** Bronze RC2 Active Development

## Ana konu

Gerçek aile verisi için doğrulanmış JSON içe aktarma, yalnız okunur ön izleme,
deterministik eşleşme planı, güçlü doğrulamalı atomik uygulama ve kontrollü geri
alma geliştirildi.

## Güvenlik ve bütünlük

- Renderer dosya yolu ve içerik gönderemez; seçim main process iletişim kutusundadır.
- 25 MiB, normal dosya, `.json`, katı UTF-8 ve NUL reddi uygulanır.
- Bilinmeyen alanlar, kırık referanslar, yinelenen kimlikler ve geçersiz değerler reddedilir.
- Ön izleme sonrası dosya stat bilgisi, ham SHA-256 ve veritabanı plan özeti yeniden doğrulanır.
- Yeni hedef kimlikleri ön izleme ve uygulama arasında sabit tutulur.
- Aynı SHA-256 veya `exportId` ile etkin paket replay'i engellenir.
- Uygulama tek transaction içinde; hata halinde tüm kayıtlar geri alınır.
- 24 saatlik geri alma yalnız batch tarafından oluşturulan kayıtları siler.
- Sonradan bağlanan gerçek kayıtlar varsa geri alma fail-closed engellenir.

## Kanıt sınırı

Hedefli sözleşme, bellek içi servis runtime, SQLite repository runtime ve sözdizimi kontrolleri çalıştırılmıştır.
Temiz kurulum, tam root TypeScript, tüm testler, Electron production build,
render edilmiş UAT, smoke ve Windows installer çalıştırılmamıştır.
