# Build 131 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.131`
- Package Version: `27.7.2026-131`
- Stage: **Bronze RC2 Active Development**
- Build: **131**

## Hedefli kaynak doğrulama sonuçları

- Build 131 restore işlem sözleşmesi: **PASS — 46/46**
- Build 131 restore çalışma zamanı doğrulaması: **PASS — 21/21**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Build 130 şifreleme sözleşmesi devamlılığı: **PASS — 39/39**
- Build 130 şifreleme runtime devamlılığı: **PASS — 17/17**

## Teslim zinciri

- Kaynak preflight: **PASS — 17/17**
- Kaynak bütünlüğü: **PASS — 1.065/1.065 kaynak dosyası**
- SHA-256 kaynak listesi: **PASS — 1.066 girdi**
- Kaynak arşiv tekrar üretilebilirliği: **PASS — 1.067 giriş / byte-identical**
- Lockfile: **PASS — 973 assertion**
- Bağımlılık kökeni: **PASS — 1.147 assertion / 371 tarball**
- Workspace bağımlılıkları: **PASS — 360 assertion / 14 workspace**
- Aktif sürüm: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**

Nihai kaynak ZIP doğrulaması ve ayrık teslim tasdiki, değişmeyecek kaynak ağacından dış teslim dosyaları olarak oluşturulur.

## Çalıştırılmayan ağır kapılar

- Temiz `npm ci`: **NOT_RUN**
- Tam root `tsc --noEmit`: **NOT_RUN**
- Tüm birim ve entegrasyon testleri: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke zinciri: **NOT_RUN**
- Gerçek Windows açılış ve installer yaşam döngüsü: **NOT_RUN**
- Gerçek elektrik kesintisi / süreç öldürme geri yükleme provası: **NOT_RUN**
