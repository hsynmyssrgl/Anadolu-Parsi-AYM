# Haricî Kanıt Sağlayıcısı Kök Güven Doğrulaması V1

**Aktif sürüm:** 02.08.2026.228

- Karar: `DEC-072`
- Mimari: `ADR-055`
- Politika: `PPT-LIFECYCLE-STRICT-V1`
- İlk uygulama: Bronze Build 182

## Amaç

Bir sağlayıcının Ed25519 kök açık anahtarının yalnız kullanıcı tarafından
kopyalanmasıyla güvenilir ilan edilmesini önlemek; kurum kimliği ve anahtar
parmak izini iki bağımsız kurum dışı kanala bağlamak.

## Zorunlu girdiler

- sağlayıcı etiketi ve resmî tüzel kişi adı,
- Ed25519 PUBLIC KEY PEM,
- resmî kurum kimliği kanıt referansı,
- bundan farklı anahtar parmak izi kanıt referansı,
- bağımsız kanaldan alınmış 64 karakter küçük onaltılık SHA-256 parmak izi,
- tanık adı ve tanık kurumu/rolü,
- son 30 gün içindeki kontrol zamanı,
- parola ve etkinse ikinci faktör,
- `KÖK GÜVENİNİ DOĞRULA <ilk-16-parmak-izi>` açık onayı.

## Fail-closed kurallar

- Anahtar Ed25519 değilse reddedilir.
- Gerçek anahtar parmak izi beklenen değerle birebir eşleşmezse reddedilir.
- İki kanıt referansı aynıysa reddedilir.
- Kontrol zamanı gelecekte veya 30 günden eskiyse reddedilir.
- Tanık, kurum adı veya kanıt referansı eksikse reddedilir.
- Aynı parmak izi daha önce kayıtlıysa replay/çakışma olarak reddedilir.
- Bu ön kontroller güçlü doğrulama ve veritabanı yazımından önce çalışır.

## Kalıcılık ve görünürlük

Doğrulama alanları kök sağlayıcı kaydıyla atomik saklanır. Sabit kanonik makbuzun
SHA-256 özeti değişikliğe duyarlı kanıt olarak tutulur. Ham kimlik belgesi,
parola, TOTP, özel anahtar veya oturum belirteci saklanmaz. Güvenlik Merkezi,
`out_of_band_dual_evidence`, `rotation_inherited` ve `legacy_unverified`
yöntemlerini açık metinle gösterir.

## Kanal sınırı

Bu ürün kabiliyeti Bronze'da tamamlanır. Gerçek insan/kurum doğrulaması, belge
hukuk incelemesi, erişilebilirlik UAT'si ve Windows paketli çalışma Silver test
kampanyasında kanıtlanır. Gerçek çevrimiçi sağlayıcı kimlik API'si ağır entegrasyon
olarak askıda kalabilir; yerel güven töreni bundan bağımsız çalışır.
