# Bronze RC2 Build 130 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.130`
- Package Version: `27.7.2026-130`
- Stage: **Bronze RC2 Active Development**
- Build: **130**

## Değişiklikler

- Yeni tam yedekler `anadolu-parsi-full-backup` v3 kapsayıcısına taşındı.
- İç payload AES-256-GCM ile şifreleniyor.
- Anahtar PBKDF2-SHA512, 310.000 iterasyon ve 32 bayt salt ile türetiliyor.
- Kapsayıcı başlığı AAD kapsamına alındı.
- Yanlış parola ve bozulmuş dosya güvenli biçimde reddediliyor.
- v1/v2 yedekler legacy ve `attention` olarak işaretleniyor.
- Manuel yedekleme ekranına parola ve parola doğrulama alanları eklendi.
- Zamanlanmış hedefler için parola OS güvenli depolamasında korunuyor.
- DEC-044 ve ADR-015 eklendi.
