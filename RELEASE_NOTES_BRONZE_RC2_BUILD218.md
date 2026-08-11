# Release Notes — Build218

Build218 OPEN-022 kapanışını ayrı bir gerçek Windows kanıt kapısı haline getirir.

- Yeni: `OPEN022_WINDOWS_KAPAT.cmd`
- Yeni: `scripts/run-open022-windows-closure.ps1`
- Yeni: `scripts/windows-open022-release-validation.ps1`
- Yeni: `scripts/windows-open022-launch-test.mjs`
- Yeni: `apps/desktop/src/main/windows-open022-side-artifact-evidence-probe.ts`
- Yeni: `scripts/verify-build218-open022-windows-result.mjs`
- Düzeltme: stabil key-envelope kimliği `electron-safe-storage-v1`; Windows DPAPI ayrı backend/provider kanıtıdır.
- OPEN-021 durumu otomatik değiştirilmez.
- Silver RC2 gate zinciri OPEN-022 kapanış şartı değildir.
- Gerçek Windows evidence gelmeden OPEN-022 kapatılmaz.
