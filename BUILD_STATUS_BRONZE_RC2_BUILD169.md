# Bronze RC2 Build 169 Durumu

- Application Version: `29.07.2026.169`
- Package Version: `29.7.2026-169`
- Stage: **Bronze RC2 Active Development**

Build 169, adaptif IPC bakım oturumunu parola ve etkinse TOTP ile güçlü yeniden doğrulamaya bağlar. Kimlik bilgileri yalnız kısa ömürlü IPC girdisi olarak kullanılır; bakım oturumu, denetim metadatası, telemetri ve tanı paketi bunları içermez.

## Doğrulama

- Build 169 sözleşme: **PASS — 55/55**
- Build 169 runtime: **PASS — 19/19**
- Build 169 sözdizimi ve bağlantı: **PASS — 10/10**
- Build 168 yetki devamlılığı: **PASS — 32/32 sözleşme, 12/12 runtime**
- Build 167 oturum devamlılığı: **PASS — 50/50 sözleşme, 29/29 runtime**
- Controlled TypeScript: **PASS — paket kaynakları ve desktop-main**
- Source preflight: **PASS — 124/124**
- Source integrity: **PASS**
- Deterministic source archive: **PASS**
- Detached delivery attestation: **PASS — 70 kanıt / 8 kapı iddiası**
- Geniş RC2 kapıları: **NOT_RUN — bağlı bağımlılık yanıtı ve Windows ortamı yok**

Build otomatik olarak Final, Freeze, Silver veya Gold aşamasına geçirilmemiştir.
