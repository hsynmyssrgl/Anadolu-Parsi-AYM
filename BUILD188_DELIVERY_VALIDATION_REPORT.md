# Build 188 Teslim Doğrulama Raporu

- Application Version: `30.07.2026.188`
- Package Version: `30.7.2026-188`
- Build: **188**
- Stage: **Bronze RC2 Active Development**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Hedefli kanıtlar

- Claim kronolojisi sözleşmesi
- Claim kronolojisi davranış testi
- Gerçek SQLite claim kronolojisi testi
- Kontrollü TypeScript ve Build 187 regresyonu
- Segmentli source preflight ve source integrity
- Deterministik kaynak ZIP ve ayrık teslim tasdiki

## Platform sınırı

Clean npm install, tam kök TypeScript, bütün testler, Electron production build,
smoke ve gerçek Windows/installer doğrulaması Silver kampanyasında NOT_RUN olarak
korunur.

## Final Bronze kaynak sonucu

- Source preflight: **185/185 PASS**
- Segment: **24/24 PASS**
- Source integrity: **1.649/1.649 PASS**
- SHA-256 manifest girdisi: **1.650**
- Aktif sürüm sözleşmesi: **178/178 PASS**
- Aktif teslim belgeleri: **121/121 PASS**
- Teslim tasdik sözleşmesi: **131 kanıt / 8 kapı PASS**
