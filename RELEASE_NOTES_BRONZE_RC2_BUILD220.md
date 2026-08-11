# Release Notes — Build220

Build220, Build219 gerçek Windows testinde görülen installer bootstrap hatasını düzeltir.

- Gerçek Build219 Windows failure evidence exact-source olarak kabul edildi ve sanitize edilerek kaydedildi.
- Root `npm ci` sonrasına ayrı `npm run windows-packager:install` prerequisite eklendi.
- İzole `electron-builder` CLI varlığı fail-closed doğrulanır.
- Build220 PowerShell dosyaları Windows PowerShell 5.1 uyumluluğu için UTF-8 BOM taşır.
- Process stdout/stderr son 12.000 karakterle sınırlı tanı kanıtı olarak lifecycle JSON'a yazılır.
- Yeni: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD220.cmd`.
- Yeni: `scripts/run-build220-bronze-security-closure.ps1`.
- Yeni: `scripts/windows-bronze-security-release-validation-build220.ps1`.
- Yeni: `scripts/verify-build220-bronze-security-windows-result.mjs`.
- OPEN-021 ve OPEN-022 gerçek Build220 Windows evidence dönmeden kapanmaz.
- OPEN-002 otomatik kapanmaz.
- Build210 active-version regression doğrulayıcısındaki 01.08.2026 tarih sabitlemesi kaldırıldı; gün.ay.yıl.build biçimindeki Build210+ sürümler genel olarak kabul edilir.
