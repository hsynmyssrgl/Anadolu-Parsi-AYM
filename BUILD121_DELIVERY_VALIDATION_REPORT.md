# Build 121 Teslim Doğrulama Raporu

- Product: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.121`
- Package Version: `25.7.2026-121`
- Stage: **Bronze RC2 Active Development**
- Build: **121**

## Kaynak teslimi

- Build 120 kaynak ZIP SHA-256 doğrulaması: **PASS**
- Beklenen ve hesaplanan SHA-256: `2c49689210a96269c83f6d9de655ec6fa831ba77998d968dba04f5cf7a481a3a`
- Build 121 source preflight: **PASS — 11/11**
- Build 121 kaynak bütünlüğü: **PASS — 967 kaynak / 968 SHA-256 girdisi**
- Deterministik kaynak ZIP: **Teslim paketleme aşamasında doğrulanacak**
- Ayrık teslim tasdiki: **Teslim paketleme aşamasında doğrulanacak**

## Zorunlu RC2 kapıları

- Clean `npm ci`: **PASS — resmî npm registry / 349 paket**
- Tam root `tsc --noEmit`: **PASS — TypeScript 7.0.2**
- Electron production build: **FAIL — esbuild kaynak dizini erişim hatası**
- Blocking smoke zinciri: **NOT_RUN — blockedBy: electron-production-build**
- Windows gerçek açılış: **NOT_RUN — blockedBy: electron-production-build**
- Windows installer: **NOT_RUN — blockedBy: electron-production-build**

Yalnız gerçekten çalıştırılan kontroller PASS olarak raporlanır.
