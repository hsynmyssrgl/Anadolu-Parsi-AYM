# Bronze RC2 Build 140 Sürüm Notları

- Application Version: `28.07.2026.140`
- Package Version: `28.7.2026-140`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Güvenilen Ed25519 sağlayıcı ve bağımsız denetçi açık anahtarı kaydı.
- SPKI PEM normalizasyonu ve SHA-256 parmak izi.
- Sabit kanonik imha makbuzu ve detached imza doğrulaması.
- Replay, zaman, kopya oluşturma tarihi ve hukuki bekletme kontrolleri.
- Kesin onay, parola ve etkinse TOTP güçlü yeniden doğrulaması.
- Sağlayıcı güven iptalinin bağlı kanıt ve kopya güven durumuna yayılması.
- Kullanıcı beyanı ile doğrulanmış makbuzun ayrı güven seviyesinde gösterimi.

## Sınır

Geçerli imza makbuzun kökeni ve bütünlüğü için kanıttır; fiziksel imhanın mutlak
gerçekleştiğini tek başına kanıtlamaz. Gerçek sağlayıcı API'si ve bağımsız UAT ayrı kapıdır.

## Hedefli kaynak doğrulaması

- Sözleşme: **PASS — 130/130**
- Runtime: **PASS — 30/30**
- Renderer/bridge sözdizimi: **PASS — 3/3**
- Ağır derleme, tam test, gerçek sağlayıcı ve Windows/installer kapıları: **NOT_RUN**
- Kaynak preflight: **PASS — 39/39**
- Kaynak bütünlüğü: **PASS — 1.158/1.158; 1.159 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.160 giriş / byte-identical**
