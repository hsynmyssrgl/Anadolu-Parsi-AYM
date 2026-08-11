# Bronze RC2 Build 139 Sürüm Notları

- Application Version: `28.07.2026.139`
- Package Version: `28.7.2026-139`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Manuel, çevrimdışı, snapshot ve bulut geçmişi kopyaları için envanter.
- Konum, sorumlu, erişilebilirlik, tarihsel veri riski ve dönemsel inceleme tarihleri.
- Kayıt kimliğine bağlı kesin teyit ve imha beyanı metinleri.
- Parola ve etkinse TOTP ile güçlü yeniden doğrulama.
- Hukuki/koruma bekletmesi ve CAS durum geçişleri.
- İsteğe bağlı SHA-256 kanıt özeti ve kalıcı beyan geçmişi.
- Güvenlik ekranında risk, teyit, bekletme ve imha beyanı yönetimi.

## Sınır

Kullanıcı beyanı otomatik fiziksel imha kanıtı değildir. Gerçek çevrimdışı medya ve bulut sağlayıcı sürüm geçmişi doğrulaması ayrı promotion kapısıdır.

## Hedefli kaynak doğrulaması

- Sözleşme: **PASS — 86/86**
- Runtime: **PASS — 29/29**
- Renderer/bridge sözdizimi: **PASS — 3/3**
- Ağır derleme, tam test ve Windows/installer kapıları: **NOT_RUN**
- Kaynak preflight: **PASS — 36/36**
- Kaynak bütünlüğü: **PASS — 1.148/1.148; 1.149 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.150 giriş / byte-identical**
