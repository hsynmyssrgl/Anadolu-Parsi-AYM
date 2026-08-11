# Build 162 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.162`
- Package Version: `29.7.2026-162`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 162 read sharing contract: **PASS — 45/45**
- Build 162 read sharing runtime: **PASS — 33/33**
- Build 162 read sharing syntax: **PASS — 4/4**
- Build 159–161 continuity: **PASS**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS — 103/103**
- Source integrity: **PASS — manifest 1.381 / source 1.381 / SHA256SUMS 1.382**
- Deterministic source archive: **PASS — 1.383 entries**
- Detached delivery attestation: **PASS — 49 evidence / 8 gate claims**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript,
tüm testler, Electron production build, blocking smoke ve Windows installer yaşam
döngüsü **NOT_RUN** olarak kalır.
