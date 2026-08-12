# B4-05/B4-06 kart yönetimi tehdit modeli

## Korunan varlıklar

- Kart sahibinin finans gizliliği ve limit/borç/ekstre özeti.
- Tam PAN, CVV/CVC, PIN ve banka parolasının sisteme hiç alınmaması.
- Finance policy kararı, exact receipt kimliği, audit ve outbox içerik sınırı.

## Tehditler ve kontroller

1. **Tam kart numarası veya sır girişi:** exact IPC anahtar denetimi, kanonik sır
   alanı reddi ve serbest ürün adında Luhn-geçerli PAN taraması uygulanır;
   application katmanı aynı kontrolü tekrarlar.
2. **Sır için kalıcı sütun açılması:** migration 79 yalnız `last4` tutar; PAN,
   `card_number`, CVV/CVC, PIN ve parola sütunları yoktur.
3. **Receipt'siz veya replay yazma:** exact finance receipt, projection ve yazılır
   fence zorunludur; finans kaydı, değerleme, banka hesabı ve kart arasında receipt
   yeniden kullanımı trigger ile reddedilir.
4. **Audit/outbox sızıntısı:** audit içeriksiz resource metadata taşır; outbox kart
   türü ve kurum metadata'sı taşır, son dört hane veya parasal özet taşımaz.
5. **Yetkisiz okuma:** merkezi finance read kararı sonrası kişi sahipliği ve kayıt
   gizliliği filtresi uygulanır.
6. **Otomatik ödeme iddiası:** UI ve karar kaydı takip modu ile banka talimatını
   açıkça ayırır; network egress ve ödeme adaptörü yoktur.
7. **Tutarsız finans özeti:** negatif/sonsuz tutarlar, kullanılabilir limitin toplam
   limiti aşması, tarih sırası ve taksit sayı/tutar çelişkisi application ve SQLite
   constraint katmanlarında fail-closed reddedilir.

## Kalan riskler

Bilgiler manuel girildiğinden güncellik ve banka gerçeği doğrulanmaz. Kart
hareketleri, gerçek zamanlı uyarılar, banka senkronizasyonu ve ödeme icrası kapsam
dışıdır. Cihaz/veritabanı korumasının genel platform riskleri ayrı güvenlik
profilleriyle yönetilir.
