# Build 161 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.161`
- Package Version: `29.7.2026-161`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 161 backpressure contract: **PASS — 34/34**
- Build 161 backpressure runtime: **PASS — 22/22**
- Build 161 backpressure syntax: **PASS — 2/2**
- Build 160 lifecycle continuity: **PASS — 54/54, 22/22, 7/7**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS — 100/100**
- Source integrity: **PASS — manifest 1.370 / source 1.370 / SHA256SUMS 1.371**
- Deterministic source archive: **PASS — 1.372 entries**
- Detached delivery attestation: **PASS — 46 evidence / 8 gate claims**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript,
tüm testler, Electron production build, blocking smoke ve Windows installer yaşam
döngüsü **NOT_RUN** olarak kalır.
