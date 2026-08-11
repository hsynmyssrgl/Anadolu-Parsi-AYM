# Bronze RC2 Build 182 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.182`
- Package Version: `30.7.2026-182`
- Stage: **Bronze RC2 Active Development**
- Build: **182**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Eklenenler

- Yeni haricî kanıt sağlayıcısı kök Ed25519 anahtarı için kurum dışı çift kanıtlı güven töreni.
- Resmî tüzel kişi kimliği ve anahtar parmak izi için birbirinden farklı iki kanıt referansı.
- Bağımsız kanaldan alınan tam SHA-256 parmak izinin gerçek Ed25519 açık anahtarıyla birebir karşılaştırılması.
- Bağımsız tanık adı, tanık kurumu/rolü ve son 30 gün içindeki kontrol zamanı zorunluluğu.
- Sabit kanonik kök güven doğrulama makbuzu ve SHA-256 özeti.
- Eski kök anahtarlar için `legacy_unverified`, imzalı anahtar döndürmeyle gelen ardıl anahtarlar için `rotation_inherited` görünürlüğü.
- Güvenlik Merkezi'nde doğrulama yöntemi, tanık ve makbuz SHA-256 özetinin gösterimi.
- Veritabanı migrasyonu 28: `REVISION-182-EXTERNAL-EVIDENCE-ROOT-TRUST-VERIFICATION`.

## Güvenlik davranışı

Yanlış parmak izi, aynı kanala dayalı iki kanıt, eski/gelecek doğrulama zamanı,
eksik tanık veya yanlış açık onay; parola/TOTP doğrulamasından ve veritabanı
yazımından önce fail-closed reddedilir. Ham kurum belgesi ve özel anahtar saklanmaz.


## Kaynak doğrulaması

- Build 182 sözleşme/runtime/syntax: **56/56 + 18/18 + 3/3 PASS**
- Kaynak preflight: **162/162 PASS — 21 küçük segment**
- Kaynak bütünlüğü: **1.583/1.583 PASS — 1.584 SHA-256 girdisi**
- Başarısız kaynak kapısı: **0**
