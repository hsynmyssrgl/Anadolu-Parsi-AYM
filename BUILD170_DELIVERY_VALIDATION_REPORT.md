# Build 170 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.170`
- Package Version: `29.7.2026-170`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 170 yeniden doğrulama koruması sözleşmesi: **PASS — 67/67**
- Build 170 runtime: **PASS — 26/26**
- Build 170 sözdizimi ve bağlantı: **PASS — 11/11**
- Build 169 devamlılığı: **PASS — 55/55 ve 19/19**
- Build 168 devamlılığı: **PASS — 32/32 ve 12/12**
- Build 167 devamlılığı: **PASS — 50/50 ve 29/29**
- Controlled TypeScript: **PASS**
- Source preflight: **PASS — 127/127**
- Source integrity: **PASS**
- Deterministic source archive üretimi ve yeniden üretilebilirlik: **PASS**
- Ayrık teslim tasdiki: **PASS — 73 kanıt / 8 kapı iddiası**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript, tüm testler, Electron production build ve blocking smoke kapıları **NOT_RUN** kalır. Windows ortamı bulunmadığından Windows launch ve installer yaşam döngüsü de **NOT_RUN** kalır.

Doğrulama sınırı **2 PASS / 0 FAIL / 6 NOT_RUN** ve genel durum **INCOMPLETE** olarak korunur. Bu paket Final, Freeze, Silver veya Gold değildir.
