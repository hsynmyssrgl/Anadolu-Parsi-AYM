# DEC-112 — Build220 gerçek Windows failure evidence ve Build221 workspace-build düzeltmesi

Build220 exact-source gerçek Windows testi kaynak bütünlüğü, root `npm ci` ve isolated `windows-packager` bootstrap adımlarını geçti; installer build ise workspace paketlerinin derlenmiş `dist` çıktıları olmadığı için `TS2307 Cannot find module @ppt/...` hatalarıyla exit code 1 verdi.

Build221, installer yaşam döngüsünden önce `npm run build:packages` adımını zorunlu prerequisite yapar. Ardından 13 workspace paketinin `dist/index.js` ve `dist/index.d.ts` çıktıları fail-closed guard ile doğrulanır. Bu iki adım PASS olmadan `package:win` başlatılmaz.

Build220 tarihsel teslimi değiştirilmez. OPEN-021/OPEN-022 exact Build221 gerçek Windows kanıtı gelmeden kapanmaz. ADR-095 ve `docs/security/BRONZE_WINDOWS_SECURITY_RETRY_BUILD221.md` bağlayıcıdır.
