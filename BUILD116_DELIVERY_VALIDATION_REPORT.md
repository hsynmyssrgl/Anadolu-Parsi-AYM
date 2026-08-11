# Build 116 Teslim Doğrulama Raporu

- Application Version: `25.07.2026.116`
- Package Version: `25.7.2026-116`
- Stage: **Bronze RC2 Active Development**

## Doğrulanmış sonuçlar

- Source-preflight: **PASS — 9/9**.
- Kaynak bütünlüğü: **PASS — 928 dosya / 929 SHA-256 girdisi**.
- Deterministik kaynak ZIP: **PASS — 930 giriş**.
- Build 116 mimari doğrulaması: **PASS — 40 assertion**.
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**.
- Dependency supply: **PASS — 1.349 assertion / 436 canonical tarball**.
- Workspace contracts: **PASS — 356 assertion / çevrimsiz production graph**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**.
- Electron-main kontrollü source type-check: **PASS**.
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**.
- Repository source doğrulaması: **PASS**.
- Sözdizimi/ayrıştırma: **PASS — 115 `.mjs`, 281 JSON, 2 YAML**.
- Npm offline cache readiness: **INCOMPLETE — 39/421 hazır, 382 eksik indeks kaydı**.
- Clean `npm ci`: **FAIL — 3 resmî registry denemesi; NPM_PROCESS_TIMEOUT / ATTEMPT_TIMEOUT**.
- Offline clean install: **NOT_RUN — cache incomplete**.
- Npm force-settle: **PASS — 3/3 deneme**.
- Kısmi kurulum kalıntısı temizliği: **PASS**.
- RC2 gate zinciri: source-preflight **PASS**, clean-npm-ci **FAIL**, kalan zorunlu kapılar **NOT_RUN — blockedBy: clean-npm-ci**.

## Çalıştırılmayan kapılar

- Full root `tsc --noEmit`: **NOT_RUN**.
- Electron production build: **NOT_RUN**.
- Blocking smoke: **NOT_RUN**.
- Windows real launch: **NOT_RUN**.
- Windows installer: **NOT_RUN**.

Çalıştırılmayan hiçbir kapı PASS olarak raporlanmamıştır.
