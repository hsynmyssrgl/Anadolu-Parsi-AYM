# Build 165 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.165`
- Package Version: `29.7.2026-165`
- Stage: **Bronze RC2 Active Development**

## Kaynak kapıları

- Build 165 durable state contract: **PASS — 49/49**
- Build 165 durable state runtime: **PASS — 33/33**
- Build 165 durable state syntax: **PASS — 8/8**
- Build 164 continuity: **PASS — 42/42, 40/40, 7/7**
- Controlled package-source TypeScript: **PASS**
- Controlled desktop-main TypeScript: **PASS**
- Source preflight: **PASS — 112/112**
- Source integrity: **PASS — manifest 1.414 / source 1.414 / SHA256SUMS 1.415**
- Deterministic source archive: **PASS — 1.416 entries**
- Detached delivery attestation: **PASS — 58 evidence / 8 gate claims**

## Geniş kapı sınırı

Bağlı npm bağımlılık yanıtı dönmediği için clean `npm ci`, tam root TypeScript, tüm testler, Electron production build, blocking smoke ve Windows installer yaşam döngüsü **NOT_RUN** kalır.
