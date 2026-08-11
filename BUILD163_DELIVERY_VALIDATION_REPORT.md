# Build 163 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.163`
- Package Version: `29.7.2026-163`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 163 telemetry contract: **PASS — 40/40**
- Build 163 telemetry runtime: **PASS — 29/29**
- Build 163 telemetry syntax: **PASS — 6/6**
- Build 159–162 continuity: **PASS**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS — 106/106**
- Source integrity: **PASS — manifest 1.392 / source 1.392 / SHA256SUMS 1.393**
- Deterministic source archive: **PASS — 1.394 entries**
- Detached delivery attestation: **PASS — 52 evidence / 8 gate claims**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript,
tüm testler, Electron production build, blocking smoke ve Windows installer yaşam
döngüsü **NOT_RUN** olarak kalır.
