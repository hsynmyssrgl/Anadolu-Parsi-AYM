# Build 160 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.160`
- Package Version: `29.7.2026-160`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 160 lifecycle contract: **PASS — 54/54**
- Build 160 lifecycle runtime: **PASS — 22/22**
- Build 160 lifecycle syntax: **PASS — 7/7**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS** — 97/97
- Source integrity: **PASS** — manifest 1.362 / source 1.362 / SHA256SUMS 1.363
- Deterministic source archive: **PASS** — 1.364 entries
- Detached delivery attestation: **PASS** — 43 evidence / 8 gate claims

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript,
tüm testler, Electron production build, blocking smoke ve Windows installer yaşam
döngüsü **NOT_RUN** olarak kalır.
