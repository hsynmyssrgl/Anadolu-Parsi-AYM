# Build 119 Teslim Doğrulama Raporu

- Application Version: `25.07.2026.119`
- Package Version: `25.7.2026-119`
- Stage: **Bronze RC2 Active Development**

## Doğrulanmış sonuçlar

- Source-preflight: **PASS — 12/12**.
- Kaynak bütünlüğü: **PASS — 952 kaynak dosyası / 953 SHA-256 girdisi**.
- Deterministik kaynak arşivi yeniden üretimi: **PASS — 954 giriş / byte-identical**.
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**.
- Dependency supply: **PASS — 1.349 assertion / 436 canonical tarball**.
- Workspace contracts: **PASS — 356 assertion / çevrimsiz production graph**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- IPC sender trust sözleşmesi: **PASS — 41 assertion**.
- Renderer session security sözleşmesi: **PASS — 33 assertion**.
- Build 119 hedefli mimari doğrulaması: **PASS — 27 entegrasyon assertion**.
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**.
- Electron-main kontrollü source type-check: **PASS**.
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**.
- Repository source doğrulaması: **PASS**.
- `.mjs` sözdizimi: **PASS — 125 dosya**.
- JSON ayrıştırma: **PASS — 268 dosya**.
- YAML ayrıştırma: **PASS — 2 dosya**.
- Npm offline cache readiness: **INCOMPLETE — 0/421 hazır; 421 eksik**.
- Gerçek cache transfer paketi üretimi: **INCOMPLETE — arşiv oluşturulmadı**.
- Clean `npm ci`: **FAIL — 3 resmî registry denemesi; dış hizmet süre aşımı**.
- Kısmi kurulum kalıntısı temizliği: **PASS**.

## Çalıştırılmayan zorunlu kapılar

- Full root `tsc --noEmit`: **NOT_RUN — blockedBy: clean-npm-ci**.
- Electron production build: **NOT_RUN — blockedBy: clean-npm-ci**.
- Blocking smoke: **NOT_RUN — blockedBy: clean-npm-ci**.
- Windows real launch: **NOT_RUN — blockedBy: clean-npm-ci**.
- Windows installer: **NOT_RUN — blockedBy: clean-npm-ci**.

Çalıştırılmayan hiçbir kapı PASS olarak raporlanmamıştır.
