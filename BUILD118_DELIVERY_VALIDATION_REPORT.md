# Build 118 Teslim Doğrulama Raporu

- Application Version: `25.07.2026.118`
- Package Version: `25.7.2026-118`
- Stage: **Bronze RC2 Active Development**

## Doğrulanmış sonuçlar

- Source-preflight: **PASS — 11/11**.
- Kaynak bütünlüğü: **PASS — 945 kaynak dosyası / 946 SHA-256 girdisi**.
- Deterministik kaynak arşivi yeniden üretimi: **PASS — 947 giriş / byte-identical**.
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**.
- Dependency supply: **PASS — 1.349 assertion / 436 canonical tarball**.
- Workspace contracts: **PASS — 356 assertion / çevrimsiz production graph**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- IPC sender trust sözleşmesi: **PASS — 40 assertion**.
- Build 118 hedefli mimari doğrulaması: **PASS — 17 entegrasyon assertion**.
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**.
- Electron-main kontrollü source type-check: **PASS**.
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**.
- Repository source doğrulaması: **PASS**.
- `.mjs` sözdizimi: **PASS — 123 dosya**.
- JSON ayrıştırma: **PASS — 284 dosya**.
- YAML ayrıştırma: **PASS — 2 dosya**.
- Npm offline cache readiness: **INCOMPLETE — 0/421 hazır; 421 eksik**.
- Gerçek cache transfer paketi üretimi: **INCOMPLETE — arşiv oluşturulmadı**.
- Clean `npm ci`: **FAIL — 3 resmî registry denemesi; EAI_AGAIN + ATTEMPT_TIMEOUT**.
- Timeout force-settle: **PASS — 3/3 deneme**.
- Kısmi kurulum kalıntısı temizliği: **PASS**.

## Çalıştırılmayan zorunlu kapılar

- Full root `tsc --noEmit`: **NOT_RUN — blockedBy: clean-npm-ci**.
- Electron production build: **NOT_RUN — blockedBy: clean-npm-ci**.
- Blocking smoke: **NOT_RUN — blockedBy: clean-npm-ci**.
- Windows real launch: **NOT_RUN — blockedBy: clean-npm-ci**.
- Windows installer: **NOT_RUN — blockedBy: clean-npm-ci**.

Çalıştırılmayan hiçbir kapı PASS olarak raporlanmamıştır.
