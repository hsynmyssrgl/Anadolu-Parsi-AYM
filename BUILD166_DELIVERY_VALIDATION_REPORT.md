# Build 166 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.166`
- Package Version: `29.7.2026-166`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 166 operator contract: **PASS — 46/46**
- Build 166 operator runtime: **PASS — 26/26**
- Build 166 operator syntax: **PASS — 8/8**
- Build 165 continuity: **PASS — 49/49, 33/33, 8/8**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS — 115/115**
- Source integrity: **PASS — manifest 1.424 / source 1.424 / SHA256SUMS 1.425**
- Deterministic source archive: **PASS — 1.426 entries**
- Detached delivery attestation: **PASS — 61 evidence / 8 gate claims**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript, tüm testler, Electron production build, blocking smoke ve Windows installer yaşam döngüsü **NOT_RUN** kalır.
