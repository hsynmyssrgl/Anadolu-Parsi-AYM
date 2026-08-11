# Build 164 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.164`
- Package Version: `29.7.2026-164`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 164 adaptive budget contract: **PASS — 42/42**
- Build 164 adaptive budget runtime: **PASS — 40/40**
- Build 164 adaptive budget syntax: **PASS — 7/7**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS — 109/109**
- Source integrity: **PASS — manifest 1.403 / source 1.403 / SHA256SUMS 1.404**
- Deterministic source archive: **PASS — 1.405 entries**
- Detached delivery attestation: **PASS — 55 evidence / 8 gate claims**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript, tüm testler, Electron production build, blocking smoke ve Windows installer yaşam döngüsü **NOT_RUN** kalır.
