# PPK-015 network egress historical closure and current ratchet

Bu kayıt yeni bir kapanış kararı değildir. Amaç, 32-K tarihsel kanıtını değiştirmeden güncel üretim ağ yüzeyini ayrı doğrulamaktır.

## Historical closure

DEC-196 ve 32-K kapanışı oluşturulduğunda latest migration 76 idi. Paket yalnız iptal-listesi adaptörünü yetkilendirmiş, mevcut migration 23 allowlist şemasını yeniden kullanmış ve migration 77 eklememişti. Tarihsel scope, karar ve audit dosyaları yeniden yazılmadı; current ratchet bu üç dosyayı byte-exact SHA-256 ile doğrular.

DEC-196 karar defterinde aktif tarihsel kayıt olarak kalır fakat daha sonraki kararların eklenmesi nedeniyle artık son kayıt değildir. Son karar olma şartı bir güvenlik koşulu değildir.

## Current ratchet

Güncel politika 2 adapter ve 3 purpose içerir:

- `secure-revocation-list-fetcher.ts` / `external-backup-revocation-list.fetch` / `GET`
- `secure-oidc-network-adapter.ts` / `oidc.token.exchange` / `POST`
- `secure-oidc-network-adapter.ts` / `oidc.jwks.fetch` / `GET`

OIDC adaptörü yalnız tam token ve JWKS primary/secondary SPKI pinleri, TLS 1.3, işletim sistemi sertifika güveni, public DNS, çözümlenen ve bağlanılan IP eşitliği, redirect yasağı, exact JSON içerik türü, boyut ve süre sınırlarıyla çalışır. Sağlayıcı görünürlüğü secure-network-ready profile ve main-only deep-link callback kaydına bağlıdır. Apple, korumalı `private_key_jwt` assertion sağlayıcısı olmadığı sürece görünmez. Provider availability veya delivery garantisi verilmez.

Güncel kaynak ratchet'i 18 source zone, 474 dosya, 7 malicious self-test, 2 adapter, 3 purpose, sıfır doğrudan primitive istisnası ve sıfır bulgudur. Üretim kaynak özeti `558fcdbc467332950d2210c3d3631f5cac2cbadff4f27f0089c41421dbd62192`; yetkili adapter/purpose özeti `8c3764ee962b55dda7fa85520b8fbb34088a65ab722febd30254416b7d6898bb` değeridir.

## Migration ayrımı

Migration 77 daha sonra PPK-016 tarafından türetilmiş-veri metadata zinciri için eklenmiştir; PPK-015 tarafından eklenmiş değildir. Güncel latest migration 101, 33-W onaya bağlı aile AI asistanı yerel zinciri tarafından sahiplenilir. Bu ardıl migrationlar, 32-K kapanış anındaki migration 76 gerçeğini veya PPK-015'in yeni persistence eklemediği gerçeğini değiştirmez.

## Gerçeklik sınırı

Bu ratchet gerçek internet isteği gerçekleştirmez, gerçek kullanıcı verisi taşımaz, Desktop kasa ya da SQLite sahipliğini değiştirmez, cutover otoritesi oluşturmaz ve tarihsel kapanış yüzdelerini yeniden hesaplamaz.
