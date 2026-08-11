# Build222 Durumu

- Application Version: `02.08.2026.222`
- Package Version: `2.8.2026-222`
- Stage: **Bronze RC2 Active Development**
- Build geliştirme durumu: `COMPLETED`
- Hedef: Build221 gerçek Windows testindeki preload TS7017 kaynak hatasını dar kapsamda düzeltmek ve installer derlemesini OPEN-021/OPEN-022 problarına taşıyabilmek.

## Gerçek Windows bulgusu

- Build221 evidence ZIP bütünlüğü: PASS
- `.sha256` sidecar eşleşmesi: PASS
- Exact Build221 source binding: PASS
- Windows source integrity: PASS
- Root `npm ci`: PASS
- Isolated `windows-packager` bootstrap: PASS
- Workspace `npm run build:packages`: PASS
- Workspace dist guard: PASS
- Windows installer build: FAIL / exit code 1
- Hata: `preload.ts(146,12) TS7017`
- OPEN-021/OPEN-022 probe: NOT_RUN
- OPEN-021/OPEN-022: IN_PROGRESS

## Build222 düzeltmesi

- `globalThis.addEventListener` doğrudan erişimi kaldırıldı.
- Dar `rendererLifecycleTarget` structural type adapter eklendi.
- `beforeunload → cancelCurrentEpoch('renderer-unloaded')` runtime davranışı korundu.
- Failure intake: PASS (21/21)
- Preload lifecycle contract: PASS (18/18)
- ES2024-only TypeScript A/B runtime: PASS (4/4)
- Unified result runtime: PASS (7/7)
- Build221 workspace-build contract: PASS (66/66)
- Build221 dist guard runtime: PASS (2/2)
- Build220 retry contract/runtime: PASS
- Package source TypeScript: PASS
- Desktop main controlled TypeScript: PASS
- Final source preflight: PASS (46/46)
- Final source integrity: PASS (2053/2053 kaynak + 2054 SHA)

## Bilinçli açık sınır

Bu Linux ortamındaki clean `npm ci` denemesi iç npm aynasında `why-is-node-running@2.3.0` tarball E404 nedeniyle tamamlanamadı; dependency-backed full Electron build burada PASS değildir. Build221 gerçek Windows koşusunda npm ci PASS olduğundan bu Build222 kaynak hatası olarak sınıflandırılmaz. Build222 gerçek Windows runner henüz NOT_RUN; OPEN-021/OPEN-022 kapanmaz.
