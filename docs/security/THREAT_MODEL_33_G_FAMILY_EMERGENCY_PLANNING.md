# 33-G tehdit modeli — Çevrimdışı aile acil durum planı

## Kapsam ve varlıklar

33-G; B5-07, EXT-009, EXT-010 ve EXT-013 için aile afet/tahliye planı, buluşma
noktası, şehir dışı irtibat, kontrol listesi ve üye durumu verisini yerel,
append-only bir defterde tutar. Adres, telefon, tahliye talimatı ve kişinin yardım
ihtiyacı hane güvenliği açısından hassastır; renderer yalnız yetkili aile kapsamının
güvenli projeksiyonunu görür.

## Tehditler ve kontroller

### Cross-family ve confused-deputy yazımı

Plan kökü var olan aktif aile ve koordinatör kişiye bağlıdır. Buluşma, irtibat ve
kontrol listesi olayları yalnız aynı plan köküne yazılır; family, owner ve privacy
komuttan bağımsız olarak kökten miras alınır. Üye durumu yalnız plan ailesindeki
aktif kişiyi hedefleyebilir. Makbuz kaynağının owner değeri hedef üye, receipt
subject person değeri ise `reportedByPersonId` olmalıdır. Bu ayrım self-service'i
korurken merkezi politika tarafından açıkça yetkilendirilen başkası adına bildirimi
görünür ve denetlenebilir kılar.

### Yetkisiz görünürlük ve hassas irtibat verisi

Görünürlük çocuk satırdan bağımsız açılmaz; planın `family` görünürlüğü ve deny-first
object permission kararı kullanılır. Telefon sıkı E.164 biçimindedir; acil durumda
çevrimdışı aranabilmesi için yalnız politika-yetkili aile çalışma alanında gösterilir,
genel dışa aktarım veya log yüzeyine verilmez. Audit/outbox; adres, telefon, talimat, checklist metni,
üye durumu veya not taşımaz.

### Replay, çakışma ve geçmişin değiştirilmesi

Her append exact family/purpose/capability/resource/action/owner/sensitivity alanlı
tek kullanımlık durable receipt ister. Receipt hash ve kimlik legacy life, managed
life, home inventory ve emergency ledger arasında tekrar kullanılamaz. Update/delete
fail-closed'dur. Checklist ve üye durumunun güncel hali, hedefe ait en son canonical
append-only olaydan türetilir.

### Gizli girdi ve yanlış iletişim iddiası

Recursive exact-key denetimi bilinmeyen alanları; parola, token, secret, credential,
PAN/CVV/PIN, path ve base64 verisini politika dispatch öncesi reddeder. Telefon alanı
mesajlaşma kimlik bilgisi değildir ve sağlayıcıya gönderilmez.

33-G yeni file/network/crypto primitive açmaz. Harita, canlı konum, SMS, e-posta,
mesaj sağlayıcısı veya acil servis çağrılmaz. UI ve workspace şu truth değerlerini
açıkça taşır: veri kaynağı `manual`, çevrimdışı kullanılabilirlik `local_only`;
`mapLookup`, `liveLocation`, `messageDelivery` ve `emergencyServiceContact`
`not_performed`; `emergencyServiceGuarantee` `not_claimed`.

## Kalan riskler ve açık kapsam

Manuel adres, telefon ve durum doğruluğu dış kaynaktan teyit edilmez. Aynı cihazı
kullanan yetkili aile üyeleri aile planını görebilir; cihaz güvenliği ürünün mevcut
oturum ve yerel veri koruma sınırına bağlıdır. EXT-011 acil durum çantası, resmi acil
yayın entegrasyonu ve diğer açık Bronze gereksinimleri bu paketle kapanmaz. Silver
readiness, Bronze Final veya acil servis garantisi iddia edilmez.
