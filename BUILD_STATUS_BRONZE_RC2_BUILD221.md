# Build221 Durumu

- Application Version: `02.08.2026.221`
- Package Version: `2.8.2026-221`
- Stage: **Bronze RC2 Active Development**
- Build geliştirme durumu: `COMPLETED`
- Hedef: Build220 gerçek Windows testinde doğrulanan workspace paket build-sırası kaynak hatasını düzeltmek ve OPEN-021/OPEN-022 birleşik Windows testini installer aşamasının ötesine taşıyabilmek.

## Gerçek Windows bulgusu

- Build220 evidence ZIP bütünlüğü: PASS
- `.sha256` sidecar eşleşmesi: PASS
- Exact Build220 source binding: PASS
- Windows source integrity: PASS
- Root `npm ci` prerequisite: PASS
- Isolated `windows-packager` bootstrap: PASS
- Windows installer build: FAIL / exit code 1
- Hata sınıfı: SOURCE_BUG
- Kök neden: `package:win` öncesi workspace `packages/*/dist` çıktıları üretilmediği için `@ppt/domain`, `@ppt/core`, `@ppt/application`, `@ppt/repository-contracts` ve ilgili paketler çözümlenemedi.
- OPEN-021 probe: NOT_RUN
- OPEN-022 probe: NOT_RUN
- OPEN-021: IN_PROGRESS
- OPEN-022: IN_PROGRESS

## Build221 düzeltmesi

- `workspace-package-build-prerequisite` eklendi.
- `npm run build:packages` installer yaşam döngüsünden önce zorunlu hale getirildi.
- `workspace-package-dist-guard` eklendi.
- 13 workspace paketinin `dist/index.js` ve `dist/index.d.ts` çıktıları fail-closed doğrulanıyor.
- İzole `windows-packager` bootstrap ve builder CLI guard korunuyor.
- PowerShell 5.1 UTF-8 BOM davranışı korunuyor.
- Installer/process bounded stdout/stderr kanıtı korunuyor.
- Yeni tek tık runner: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD221.cmd`.
- Build221 failure-intake: PASS (18/18)
- Build221 workspace-build contract: PASS (66/66)
- Build221 workspace dist guard runtime: PASS (2/2)
- Build221 result runtime: PASS (7/7)
- Build220 regresyonları: PASS
- Kontrollü TypeScript kontrolleri: PASS
- Final source preflight: PASS (42/42)
- Final source integrity: PASS (2035/2035 + 2036 SHA)

## Bilinçli açık sınır

Build221 runner gerçek Windows üzerinde henüz `NOT_RUN` durumundadır. OPEN-021 ve OPEN-022 ancak exact Build221 kaynak snapshotından dönen gerçek EFS/DPAPI/paketli Electron kanıtıyla `READY_TO_CLOSE` olabilir.

## Proje ilerleme tahmini

- Tahmini kodlama tamamlanma: **%96.9**
- Tahmini kalan kodlama: **%3.1**
- Proje başlangıcı: **2026-07-20**
- Tahmini Bronze Final: **2026-08-07**
- Tahmini Silver: **2026-08-16**
- Tahmini Gold/genel bitiş: **2026-08-20**
- Tahmin güveni: **Orta**
