# Bronze RC2 Build 170 Durumu

- Application Version: `29.07.2026.170`
- Package Version: `29.7.2026-170`
- Stage: **Bronze RC2 Active Development**

Build 170, adaptif IPC bakım oturumlarının güçlü yeniden doğrulamasına sınırlı deneme ve geçici kilit katmanı ekler. Aynı kimlik/oturum/cihaz bağlamında beş sayılan hata sonrasında bakım yeniden doğrulaması beş dakika kapatılır; arayüz kalan denemeyi ve bekleme süresini gösterir.

## Doğrulama

- Build 170 sözleşme: **PASS — 67/67**
- Build 170 runtime: **PASS — 26/26**
- Build 170 sözdizimi ve bağlantı: **PASS — 11/11**
- Build 169 güçlü doğrulama devamlılığı: **PASS — 55/55 sözleşme, 19/19 runtime**
- Build 168 yetki devamlılığı: **PASS — 32/32 sözleşme, 12/12 runtime**
- Build 167 oturum devamlılığı: **PASS — 50/50 sözleşme, 29/29 runtime**
- Controlled TypeScript: **PASS — paket kaynakları ve desktop-main**
- Source preflight: **PASS — 127/127**
- Source integrity: **PASS — final kaynak manifesti doğrulandı**
- Deterministic source archive: **PASS — yeniden üretilebilir kaynak ZIP**
- Detached delivery attestation: **PASS — 73 kanıt / 8 kapı iddiası**
- Geniş RC2 kapıları: **NOT_RUN — bağlı bağımlılık yanıtı ve Windows ortamı yok**

Build otomatik olarak Final, Freeze, Silver veya Gold aşamasına geçirilmemiştir.
