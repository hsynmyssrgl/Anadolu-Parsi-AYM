# Bronze RC2 Build 148 Sürüm Notları

## Sürüm

- Uygulama: `29.07.2026.148`
- Paket: `29.7.2026-148`
- Aşama: **Bronze RC2 Active Development**

## Ana konu

Kalan kod açıkları ve Build 145–147 entegrasyon sertleştirmesi.

## Değişiklikler

- Kritik yeni IPC kanalları için merkezi, kanal bazlı argüman sözleşmesi eklendi.
- Bilinmeyen nesne alanları, fazla argümanlar, hatalı türler ve sınır dışı sayfa
  değerleri ana işlemden önce reddediliyor.
- Ham HTTPS iptal listesi renderer API’sinden ve preload köprüsünden kaldırıldı.
- Güvenli ağ içeriği yalnız ana süreçte bekletiliyor; renderer sadece liste özeti
  ve tek kullanımlık bekleyen kimliği üzerinden güçlü doğrulama talep ediyor.
- Bekleyen iptal listeleri endpoint profil parmak izine bağlandı; URL, sağlayıcı,
  pin, geçiş penceresi veya durum değişikliği bekleyen kaydı geçersiz kılıyor.
- Sağlayıcı anahtar döndürme veya iptal işlemi tüm bekleyen senkronizasyonları
  geçersiz kılıyor.
- Aile içe aktarma ön izleme önbelleği kullanıcı/aile bağlamına bağlandı ve
  çıkışta temizleniyor.
- Büyük veri sayfalama imleçleri kullanıcı ile etkin filtre kapsamına bağlandı.
- Main/preload kanal paritesi 179/179 olarak korundu.

## Aşama notu

Bu paket Bronze RC2 Final, Code Freeze, Silver veya Gold değildir. Temiz bağımlılık
kurulumu, tam TypeScript, bütün testler, Electron build ve smoke Build 149 toplu
doğrulama aşamasına bırakılmıştır.
