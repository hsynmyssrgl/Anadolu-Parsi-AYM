# Release Notes — Build219

Build219, OPEN-021 ve OPEN-022 gerçek Windows kanıt üretimini tek güncel kaynak snapshotında birleştirir.

- Yeni: `BRONZE_WINDOWS_GUVENLIK_KAPAT.cmd`
- Yeni: `scripts/run-build219-bronze-security-closure.ps1`
- Yeni: `scripts/windows-bronze-security-release-validation.ps1`
- Yeni: `scripts/verify-build219-bronze-security-windows-result.mjs`
- Yeni: OPEN-021 ve OPEN-022 için bağımsız partial-readiness semantiği.
- Tek dependency bootstrap, tek installer build, tek install/uninstall.
- Tek exact-source-bound evidence ZIP/SHA.
- OPEN-002 otomatik kapanmaz.
- Ana Build Defteri otomatik değişmez.
- Gerçek Windows evidence gelmeden OPEN-021/022 kapatılmaz.
