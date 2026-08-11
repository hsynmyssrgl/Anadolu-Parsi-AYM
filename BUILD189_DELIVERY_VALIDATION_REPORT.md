# Build 189 Teslim Doğrulama Raporu

- Application Version: `30.07.2026.189`
- Package Version: `30.7.2026-189`
- Build: **189**
- Stage: **Bronze RC2 Active Development**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Hedefli kanıtlar

- Operasyonel izolasyon sözleşmesi
- Gerçek repository/SQLite davranış testi
- Doğrudan SQLite terminal durum makinesi testi
- Kontrollü TypeScript ve Build 188 regresyonu
- Segmentli source preflight ve source integrity
- Deterministik kaynak ZIP ve ayrık teslim tasdiki

## Platform sınırı

Clean npm install, tam kök TypeScript, bütün testler, Electron production build,
smoke ve gerçek Windows/installer doğrulaması Silver kampanyasında NOT_RUN olarak
korunur.

## Final Bronze kaynak sonucu

- Source preflight: **189/189 PASS**
- Segment: **24/24 PASS**
- Source integrity: **1.660/1.660 PASS**
- SHA-256 manifest girdisi: **1.661**
- Aktif sürüm sözleşmesi: **178/178 PASS**
- Aktif teslim belgeleri: **141/141 PASS**
- Teslim tasdik sözleşmesi: **135 kanıt / 8 kapı PASS**
