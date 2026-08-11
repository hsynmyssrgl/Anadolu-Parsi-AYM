# Build 169 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.169`
- Package Version: `29.7.2026-169`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 169 güçlü yeniden doğrulama sözleşmesi: **PASS — 55/55**
- Build 169 runtime: **PASS — 19/19**
- Build 169 sözdizimi ve bağlantı: **PASS — 10/10**
- Build 168 devamlılığı: **PASS — 32/32 ve 12/12**
- Build 167 devamlılığı: **PASS — 50/50 ve 29/29**
- Controlled TypeScript: **PASS**
- Source preflight: **PASS — 124/124**
- Source integrity: **PASS**
- Deterministic source archive üretimi ve yeniden üretilebilirlik: **PASS**
- Ayrık teslim tasdiki: **PASS — 70 kanıt / 8 kapı iddiası**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript, tüm testler, Electron production build ve blocking smoke kapıları **NOT_RUN** kalır. Windows ortamı bulunmadığından Windows launch ve installer yaşam döngüsü de **NOT_RUN** kalır.

Doğrulama sınırı: **2 PASS / 0 FAIL / 6 NOT_RUN — INCOMPLETE**. Bu durum kaynak tesliminin doğrulandığını, fakat üretim veya Silver/Gold uygunluğunun ileri sürülmediğini gösterir.
