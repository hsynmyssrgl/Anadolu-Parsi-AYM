# Build 117 Teslim Doğrulama Raporu

- Application Version: `25.07.2026.117`
- Package Version: `25.7.2026-117`
- Stage: **Bronze RC2 Active Development**

## Doğrulanmış sonuçlar

- Source-preflight: **PASS — 10/10**.
- Kaynak bütünlüğü: **PASS**.
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**.
- Dependency supply: **PASS — 1.349 assertion / 436 canonical tarball**.
- Workspace contracts: **PASS — 356 assertion / çevrimsiz production graph**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- Npm cache transfer sözleşmesi: **PASS — 33 assertion**.
- Build 117 hedefli mimari doğrulaması: **PASS — 33 assertion**.
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**.
- Electron-main kontrollü source type-check: **PASS**.
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**.
- Repository source doğrulaması: **PASS**.
- Npm offline cache readiness: **INCOMPLETE — 39/421 hazır; 382 eksik**.
- Gerçek cache transfer paketi üretimi: **INCOMPLETE — arşiv oluşturulmadı**.
- Clean `npm ci`: **FAIL — 3 resmî registry denemesi; NPM_PROCESS_TIMEOUT**.
- Timeout force-settle: **PASS — 3/3 deneme**.
- Kısmi kurulum kalıntısı temizliği: **PASS**.

## Çalıştırılmayan zorunlu kapılar

- Full root `tsc --noEmit`: **NOT_RUN**.
- Electron production build: **NOT_RUN**.
- Blocking smoke: **NOT_RUN**.
- Windows real launch: **NOT_RUN**.
- Windows installer: **NOT_RUN**.

Çalıştırılmayan hiçbir kapı PASS olarak raporlanmamıştır.
