# Build 141 Teslim Doğrulama Raporu

- Application Version: `28.07.2026.141`
- Package Version: `28.7.2026-141`
- Stage: **Bronze RC2 Active Development**

## Gerçek sonuçlar

- Kaynak preflight: **PASS — 42/42**
- Kaynak bütünlüğü: **PASS — 1.166/1.166 kaynak; 1.167 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.168 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 40 kanıt / 8 kapı**

Temiz `npm ci`, tam root `tsc --noEmit`, tüm testler, Electron production build, blocking smoke, gerçek sağlayıcı/Windows ve installer: **NOT_RUN**.
