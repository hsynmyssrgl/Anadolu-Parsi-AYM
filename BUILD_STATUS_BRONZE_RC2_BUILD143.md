# Bronze RC2 Active Development — Build 143

- Application Version: `28.07.2026.143`
- Package Version: `28.7.2026-143`
- Stage: **Bronze RC2 Active Development**
- Focus: Güvenli HTTPS üzerinden imzalı sağlayıcı iptal listesi alma.

## Tamamlanan kodlama

- HTTPS zorunluluğu ve URL kimlik bilgisi reddi.
- TLS sertifika zinciri doğrulaması ve SHA-256 SPKI pinning.
- DNS çözümlemesi sonrası özel, loopback ve link-local ağ hedeflerinin reddi.
- Aynı-origin ile sınırlı en fazla iki yönlendirme.
- 10 saniye varsayılan zaman aşımı ve 1 MiB yanıt sınırı.
- `application/json` ve Build 142 iptal listesi şema doğrulaması.
- Electron IPC, preload ve renderer API tip bağlantıları.

## Gerçek doğrulama

- Build 143 kaynak sözleşmesi: PASS — 20/20.
- Kontrollü package-source TypeScript: PASS.
- Kontrollü desktop-main TypeScript: PASS.

## Çalıştırılmayan ağır kapılar

Temiz npm ci, tam root tsc, tüm testler, Electron production build, gerçek internet sağlayıcı uç noktası, Windows açılışı ve installer: NOT_RUN.
