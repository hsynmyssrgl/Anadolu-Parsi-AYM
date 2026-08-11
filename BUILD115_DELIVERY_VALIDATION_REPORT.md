# Build 115 Teslim Doğrulama Raporu

- Application Version: `25.07.2026.115`
- Package Version: `25.7.2026-115`
- Stage: **Bronze RC2 Active Development**

## Doğrulanmış sonuçlar

- Source-preflight: **PASS — 9/9**.
- Build 115 mimari doğrulaması: **PASS — 48 assertion**.
- Ayrık teslim tasdik sözleşmesi: **PASS — 12 kanıt / 7 kapı iddiası**.
- Package-source ve Electron-main kontrollü type-check: **PASS**.
- Bronze database ve repository kaynak kapıları: **PASS**.
- Temiz `npm ci`: **FAIL — 3 bağımsız koşu / 9 deneme; resmî registry, EAI_AGAIN / ATTEMPT_TIMEOUT**.
- Npm force-settle: **PASS — 9/9 deneme**.
- Kısmi kurulum kalıntısı temizliği: **PASS — 3/3 koşu**.
- RC2 gate zinciri: source-preflight **PASS**, clean-npm-ci **FAIL**, kalan zorunlu kapılar **NOT_RUN — blockedBy: clean-npm-ci**.

## Çalıştırılmayan kapılar

- Full root `tsc --noEmit`: **NOT_RUN**.
- Electron production build: **NOT_RUN**.
- Blocking smoke: **NOT_RUN**.
- Windows real launch: **NOT_RUN**.
- Windows installer: **NOT_RUN**.

Çalıştırılmayan hiçbir kapı PASS olarak raporlanmamıştır.
