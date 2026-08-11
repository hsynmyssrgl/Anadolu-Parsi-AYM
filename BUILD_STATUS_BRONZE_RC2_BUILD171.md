# Bronze RC2 Build 171 Durumu

- Application Version: `29.07.2026.171`
- Package Version: `29.7.2026-171`
- Stage: **Bronze RC2 Active Development**

Build 171, adaptif IPC bakım yeniden doğrulama sayaçlarını ve geçici kilidi işletim sistemi korumasıyla şifrelenmiş atomik durumda uygulama yeniden başlatmaları arasında korur. Bozuk kayıtlar karantinaya alınır ve bakım işlemleri beş dakikalık güvenli toparlanma kilidine girer.

## Doğrulama

- Build 171 sözleşme: **PASS — 66/66**
- Build 171 runtime: **PASS — 31/31**
- Build 171 sözdizimi ve bağlantı: **PASS — 12/12**
- Build 170 sınırlı deneme/kilit devamlılığı: **PASS — 67/67 sözleşme, 26/26 runtime, 11/11 sözdizimi**
- Build 169 güçlü doğrulama devamlılığı: **PASS — 55/55 sözleşme, 19/19 runtime**
- Build 168 yetki devamlılığı: **PASS — 32/32 sözleşme, 12/12 runtime**
- Build 167 bakım oturumu devamlılığı: **PASS — 50/50 sözleşme, 29/29 runtime**
- Controlled TypeScript: **PASS — paket kaynakları ve desktop-main**
- Source preflight: **PASS — 130/130**
- Source integrity: **PASS — final kaynak manifesti doğrulandı**
- Deterministic source archive: **PASS — yeniden üretilebilir kaynak ZIP**
- Detached delivery attestation: **PASS — 76 kanıt / 8 kapı iddiası**
- Geniş RC2 kapıları: **NOT_RUN — bağlı bağımlılık yanıtı ve Windows ortamı yok**

Build otomatik olarak Final, Freeze, Silver veya Gold aşamasına geçirilmemiştir.
