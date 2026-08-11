# Panthera pardus tulliana Aile — Bronze RC2 Build 118

- Application Version: `25.07.2026.118`
- Package Version: `25.7.2026-118`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 118 odağı

Electron IPC çağrılarını kayıtlı ana renderer penceresi, ana frame ve tam güvenilir renderer belgesiyle bağlayarak renderer-main süreç güven sınırını sertleştirme.

## Tamamlanan mimari

- Her IPC çağrısı kayıtlı ana renderer `webContents.id` değeriyle eşleşir.
- Alt frame ve farklı pencere çağrıları iş handler’ına ulaşmadan reddedilir.
- Renderer URL’si prefix kontrolü yerine kanonik tam belge eşleşmesiyle doğrulanır.
- Paketli uygulama yalnız beklenen `file:` belgesini kabul eder.
- Geliştirme URL’si yalnız loopback `http:`/`https:` hostlarından kabul edilir.
- Güvenilmeyen çağrılar security kategorili AppError ve yapılandırılmış uyarı logu üretir.
- Harici açılış yalnız kimlik bilgisi içermeyen HTTPS URL’leriyle sınırlandırılır.

## Gerçek doğrulama durumu

- IPC sender trust sözleşmesi: **PASS — 40 assertion**.
- Build 118 mimari entegrasyonu: **PASS — 17 assertion**.
- Electron-main kontrollü source type-check: **PASS**.
- Source-preflight: **PASS — 11/11**.
- Kaynak bütünlüğü: **PASS — 945 dosya / 946 SHA girdisi**.
- Package-source ve Electron-main kontrollü type-check: **PASS**.
- Bronze database ve repository source kapıları: **PASS**.
- Npm offline cache readiness: **INCOMPLETE — 0/421 hazır, 421 eksik**.
- Temiz `npm ci`: **FAIL — 3 resmî registry denemesi; EAI_AGAIN + ATTEMPT_TIMEOUT**.
- Full root `tsc --noEmit`, production build, blocking smoke, Windows launch ve installer: **NOT_RUN — blockedBy: clean-npm-ci**.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
