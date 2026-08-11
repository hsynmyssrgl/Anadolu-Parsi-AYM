# Release Notes — Build221

Build221, exact-source Build220 gerçek Windows testinde görülen workspace package build-order hatasını düzeltir.

- Build220 Windows failure evidence exact-source olarak kabul edildi ve sanitize edilerek kaydedildi.
- Root `npm ci` ve isolated `windows-packager` bootstrap adımları korunur.
- Installer öncesine zorunlu `npm run build:packages` prerequisite eklendi.
- 13 workspace paketi için `dist/index.js` + `dist/index.d.ts` fail-closed guard eklendi.
- Dist guard valid fixture kabul / eksik dosya tamper reddi runtime ile doğrulandı.
- Yeni: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD221.cmd`.
- Yeni: `scripts/run-build221-bronze-security-closure.ps1`.
- Yeni: `scripts/windows-bronze-security-release-validation-build221.ps1`.
- Yeni: `scripts/verify-build221-bronze-security-windows-result.mjs`.
- OPEN-021 ve OPEN-022 gerçek Build221 Windows evidence dönmeden kapanmaz.
- OPEN-002 otomatik kapanmaz.
