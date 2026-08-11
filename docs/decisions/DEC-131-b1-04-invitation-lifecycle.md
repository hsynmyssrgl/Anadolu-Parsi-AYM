# DEC-131 — B1-04 Güvenli Davet Yaşam Döngüsü

## Durum

Kabul edildi ve 30-G kapsamında uygulanıyor.

## Karar

Aile üyeliği daveti tek kullanımlık kriptografik kodla kabul edilir. Kodun yaşam döngüsü `ready`, `not_yet_active`, `expired`, `used`, `revoked` ve `invalid` sonuçlarından biriyle güvenli biçimde sınıflandırılır. Alıcıya e-posta veya aile içeriği açığa çıkarılmadan anlaşılır durum mesajı verilir.

Yeniden gönderme eski kodu aynı transaction içinde iptal eder, yeni kod ve yeni davet kaydı üretir, iki kaydı ileri ve geri bağlarla ilişkilendirir. Yeni kod varsayılan olarak yedi gün geçerlidir. Kullanılmış veya daha önce başka bir kodla değiştirilmiş davet yeniden gönderilemez.

## Güvenlik ve bütünlük

- Kodun yalnız SHA-256 özeti kalıcı veritabanında tutulur.
- Kabul, yalnız `pending`, etkinlik başlangıcı gelmiş ve süresi dolmamış davette çalışır.
- `accepted`, `revoked`, `expired` ve geçersiz kodlar fail-closed sonuç verir.
- İptal zaman damgası ve `manual`/`resent` gerekçesi zorunlu ve denetlenebilirdir.
- Yeniden gönderme eski ve yeni daveti bire bir bağlar; döngüsel veya yinelenen bağlar veritabanı tarafından reddedilir.
- İptal, yeniden gönderme ve kabul audit/outbox kanıtı üretir.
- Tarihsel 29 ve tamamlanmış 30-A–30-F checkpointleri değiştirilmez.

## Teslim sınırı

30-G domain, şema, migration, repository, application use-case, güvenli durum politikası ve hedefli doğrulama temelini kapsar. Alıcı kabul ekranı ile yönetici yeniden gönderme IPC/UI/menü bağlantıları ayrı sonraki governed mikro-adımda tamamlanacaktır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
