# ADR-025 — İmzalı Haricî Yedek İmha Kanıtı ve Sağlayıcı Güven Zinciri

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Tarih: 28.07.2026
- Build: 140
- Kanal: Bronze RC2 Active Development

## Bağlam

Build 139, manuel ve uygulama dışı yedeklerin envanterini ve kullanıcı imha
beyanını kurdu. Kullanıcı beyanı veya tek başına SHA-256 özeti, fiziksel medyanın
ya da bulut sürümünün gerçekten imha edildiğini bağımsız olarak doğrulamaz.

## Karar

Uygulama yalnız güvenilen sağlayıcı veya bağımsız denetçi **Ed25519 açık
anahtarlarını** kabul eder. Özel anahtar, RSA anahtarı veya belirsiz algoritma
kabul edilmez. Güvenilen açık anahtar SPKI PEM olarak normalize edilir ve
SHA-256 parmak iziyle kaydedilir.

İmzalanan kanonik makbuz alanları sabittir: `schemaVersion`, `type`, `receiptId`,
`copyId`, `issuerId`, `issuedAt`, `evidenceSha256` ve `statement=destroyed`. Aynı
sağlayıcı/makbuz kimliği tekrar kullanılamaz. İleri tarihli, kopya kaydından önce
düzenlenmiş, hukuki bekletmeye aykırı veya imzası geçersiz makbuz fail-closed
reddedilir.

Sağlayıcı güveni iptal edildiğinde bağlı imha kanıtları ve envanter kayıtları
`revoked` güven durumuna düşer. Bu işlem kanıtı silmez; denetim geçmişini korur.
Güven ekleme, iptal ve imzalı kanıt doğrulama aile yöneticisi, kesin onay metni,
parola ve etkinse TOTP güçlü doğrulaması gerektirir.

## Güvenlik sınırı

Geçerli imza, makbuzun güvenilen özel anahtar sahibi tarafından üretildiğini ve
kanonik içeriğin değiştirilmediğini kanıtlar. İmza; fiziksel diskin, snapshot'ın,
bulut sağlayıcı sürümünün veya üçüncü taraf kopyanın mutlak biçimde yok edildiğini
tek başına kanıtlamaz. Sağlayıcı API'si, sözleşme, bağımsız denetim ve gerçek dünya
UAT/kanıtı ayrı promotion kapısıdır.

## Sonuç

Kullanıcı beyanı ile kriptografik olarak doğrulanmış sağlayıcı kanıtı ayrı güven
seviyelerinde tutulur; özel anahtar uygulamaya alınmaz ve güven iptali geçmişe
yayılır.
