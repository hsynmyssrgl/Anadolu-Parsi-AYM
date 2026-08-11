# Build 132 Teslim Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.132`
- Package Version: `27.7.2026-132`
- Stage: **Bronze RC2 Active Development**
- Build: **132**

## Hedefli kaynak doğrulama sonuçları

- Build 132 başlangıç güvenlik sözleşmesi: **PASS — 59/59**
- Build 132 başlangıç güvenlik çalışma zamanı: **PASS — 22/22**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Build 131 restore transaction devamlılığı: **PASS — 45/45 sözleşme; 21/21 runtime**
- Build 130 şifreleme devamlılığı: **PASS — 39/39 sözleşme; 17/17 runtime**

## Teslim zinciri

- Kaynak preflight: **PASS — 19/19**
- Kaynak bütünlüğü: **PASS — 1.074/1.074 kaynak dosyası**
- SHA-256 kaynak listesi: **PASS — 1.075 girdi**
- Kaynak arşiv tekrar üretilebilirliği: **PASS — 1.076 giriş / byte-identical**
- Lockfile: **PASS — 973 assertion**
- Bağımlılık kökeni: **PASS — 1.147 assertion / 371 tarball**
- Workspace bağımlılıkları: **PASS — 360 assertion / 14 workspace**
- Build toolchain güvenliği: **PASS — 64 assertion**
- Aktif sürüm: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**

Nihai kaynak ZIP doğrulaması ve ayrık teslim tasdiki, değişmeyecek kaynak ağacından dış teslim dosyaları olarak oluşturulur.

## Çalıştırılmayan ağır kapılar

- Temiz `npm ci`: **NOT_RUN**
- Tam root `tsc --noEmit`: **NOT_RUN**
- Tüm birim ve entegrasyon testleri: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke zinciri: **NOT_RUN**
- Gerçek Windows development/paketli DPAPI açılışı: **NOT_RUN**
- Windows installer yaşam döngüsü: **NOT_RUN**
