# Build223 Durumu

- Application Version: `02.08.2026.223`
- Package Version: `2.8.2026-223`
- Stage: **Bronze RC2 Active Development**
- Build geliştirme durumu: `COMPLETED`
- Hedef: Build222 gerçek Windows testinde doğrulanan preload CommonJS staging kaynak hatasını dar kapsamda düzeltmek ve installer derlemesini OPEN-021/OPEN-022 problarına taşıyabilmek.

## Gerçek Windows bulgusu

- Build222 evidence ZIP bütünlüğü: PASS
- `.sha256` sidecar eşleşmesi: PASS
- Exact Build222 source binding: PASS
- Windows source integrity: PASS
- Root `npm ci`: PASS
- Isolated `windows-packager` bootstrap: PASS
- Workspace `npm run build:packages`: PASS
- Workspace dist guard: PASS
- Windows installer build: FAIL / exit code 1
- Hatalar: üç yerel preload modülünde `TS2307`; `.cts` generic arrow sözdiziminde iki `TS7060`
- OPEN-021/OPEN-022 probe: NOT_RUN
- OPEN-021/OPEN-022: IN_PROGRESS

## Build223 düzeltmesi

- `preload.ts` ile birlikte `ipc-transport-context.ts`, `ipc-request-lifecycle.ts`, `ipc-read-sharing.ts` CommonJS staging grafiğine alındı.
- Staged relative IPC import specifier'ları `.js` → `.cjs` olarak yeniden yazılıyor.
- Staged `.cts` generic arrow type-parametreleri CJS-uyumlu trailing-comma biçimine normalize ediliyor.
- Preload içindeki iki generic invoker function declaration'a çevrildi.
- Failure intake: PASS (27/27)
- Preload CJS graph contract: PASS (25/25)
- CJS graph compile + missing-module tamper runtime: PASS (13/13)
- Unified result runtime: PASS (7/7)
- Build222 / Build221 regresyonları: PASS
- Package source TypeScript: PASS
- Desktop main controlled TypeScript: PASS
- Final source preflight: PASS (50/50)
- Final source integrity: PASS (2071/2071 kaynak + 2072 SHA)

## Bilinçli açık sınır

Dependency-backed full Electron/installer build bu Linux ortamında resmî Windows PASS değildir. Build223 gerçek Windows runner henüz NOT_RUN; OPEN-021/OPEN-022 kapanmaz. Çalıştırılmamış hiçbir EFS/DPAPI/paketli Electron kapısı PASS sayılmaz.

## Proje ilerleme tahmini

- Tahmini kodlama tamamlanma: **%97.1**
- Tahmini kalan kodlama: **%2.9**
- Proje başlangıcı: **2026-07-20**
- Geçen süre: **13 gün**
- Tarihsel build hızı: **17.15 build/gün**
- Tahmini Bronze Final: **2026-08-07**
- Tahmini Silver: **2026-08-16**
- Tahmini Gold/genel bitiş: **2026-08-20**
- Tahmin güveni: **Orta**
