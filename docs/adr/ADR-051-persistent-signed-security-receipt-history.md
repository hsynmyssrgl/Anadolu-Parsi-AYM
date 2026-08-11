# ADR-051 — Kalıcı İmzalı Güvenlik Makbuzu Geçmişi

## Durum

Kabul edildi — Bronze RC2 Build 178.

## Bağlam

Build 176 kurtarma sonrası cihaz yeniden yetkilendirmesi için Ed25519 imzalı bir makbuz üretti; Build 177 bu akışı ayrı Güvenlik Merkezi ekranına bağladı. Makbuz yalnız işlem sonucunda renderer belleğinde kaldığı için uygulama yeniden başlatıldığında kullanıcı geçmişi göremiyor ve dışarıdan alınmış bir makbuzu güven sınırı içinde doğrulayamıyordu.

## Karar

- Makbuzlar ana süreçte, kullanıcı veri dizinindeki ayrı bir JSON zarfında saklanır.
- Dosya `0600` izinle, `wx` geçici dosya, `fsync` ve `rename` sırasıyla atomik yazılır.
- En fazla 256 makbuz ve 2 MiB dosya sınırı uygulanır.
- Arşiv ham hesap kimliği yerine makbuzdaki SHA-256 hesap parmak izine göre filtrelenir.
- Listeleme yalnız aktif oturum hesabına ait makbuzları döndürür.
- Her listelemede payload SHA-256 ve Ed25519 imzası yeniden doğrulanır.
- Haricî makbuz doğrulaması renderer içinde yapılmaz; JSON ana sürece gönderilir ve şema, boyut, hash ve imza orada denetlenir.
- Bozuk veya ayrıştırılamayan arşiv uygulama güvenlik ekranını çökertmez; geçmiş boş kabul edilir ve sonraki geçerli yazımla yeniden oluşturulur.
- Parola, TOTP sırrı, kurtarma kodu ve oturum belirteci makbuz arşivine girmez.

## Sonuçlar

Kullanıcı güvenlik olayının kanıtını uygulama yeniden başlatıldıktan sonra görebilir, kopyalayabilir ve dışarıdan aldığı makbuzun değiştirilip değiştirilmediğini doğrulayabilir. Dosya tabanlı arşiv denetim veritabanının yerine geçmez; imzalı kullanıcı kanıtı için sınırlı bir yerel görünüm sağlar.

## Sınırlamalar

Makbuz arşivi tek cihazdaki yerel geçmişi tutar. Bulut senkronizasyonu, merkezi şeffaflık günlüğü ve bağımsız zaman damgası otoritesi bu buildin kapsamında değildir.
