# Bronze RC2 Build 141 Sürüm Notları

- Application Version: `28.07.2026.141`
- Package Version: `28.7.2026-141`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Önceki güvenilen Ed25519 anahtarıyla imzalanmış ardıl anahtar yetkilendirmesi.
- Sabit kanonik döndürme makbuzu ve replay/anahtar çakışması koruması.
- Atomik önceki `validUntil` ve ardıl `validFrom` kesim zamanı.
- Makbuz düzenlenme anına göre tarihsel anahtar güveni doğrulaması.
- Kesin onay, parola ve etkinse TOTP güçlü yeniden doğrulaması.
- Sağlayıcı anahtar döndürme geçmişinin kullanıcı ekranında gösterilmesi.

## Sınır

Gerçek sağlayıcı API'si, çevrimiçi iptal listesi, kurumsal kimlik doğrulaması,
Windows paketli çalışma ve installer kapıları bu buildde çalıştırılmadı.

## Hedefli kaynak doğrulaması

- Sözleşme: **PASS — 87/87**
- Runtime: **PASS — 21/21**
- Renderer/bridge: **PASS — 3/3**
- Kaynak preflight: **PASS — 42/42**
- Kaynak bütünlüğü: **PASS — 1.166/1.166; 1.167 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.168 giriş / byte-identical**
- Ağır derleme, tam test, gerçek sağlayıcı ve Windows/installer kapıları: **NOT_RUN**
