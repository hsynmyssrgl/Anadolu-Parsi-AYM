# Panthera pardus tulliana Aile — Bronze RC2 Build 115

- Application Version: `25.07.2026.115`
- Package Version: `25.7.2026-115`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 115 odağı

Kaynak ZIP, makine tarafından üretilen doğrulama raporları ve kullanıcıya dönük kapı durumları arasında SHA-256 temelli ayrık teslim kanıt tasdiki oluşturuldu.

## Tamamlanan mimari değişiklikler

- Kaynak ZIP hash'i, byte sayısı, giriş sayısı ve deterministik ZIP durumu tasdik dosyasına bağlandı.
- 12 zorunlu kanıt JSON dosyasının yolu, byte sayısı, SHA-256 değeri ve bildirdiği durum kaydediliyor.
- Yedi kullanıcı kapısı `BUILD_STATUS.md`, `VERIFICATION_REPORT.md` ve gerçek kanıt raporları arasında çapraz doğrulanıyor.
- Yanlış PASS, değiştirilmiş kanıt, eksik kanıt, yanlış ZIP belgesi ve bozuk arşiv reddediliyor.
- Tasdik dosyası için bağımsız `.sha256` yan dosyası üretiliyor.
- Linux ve Windows iş akışları tasdik sözleşmesi kanıtını saklıyor.
- Mekanizma dijital imza değil, değişikliği görünür kılan SHA-256 köken zinciridir.

## Gerçek doğrulama durumu

- Source-preflight: **PASS — 9/9**.
- Build 115 mimari doğrulaması: **PASS — 48 assertion**.
- Ayrık teslim tasdik sözleşmesi: **PASS — 12 kanıt / 7 kapı iddiası**.
- Lockfile integrity: **PASS — 1.150 assertion**.
- Dependency supply: **PASS — 1.349 assertion / 436 tarball**.
- Workspace contracts: **PASS — 356 assertion**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**.
- Electron-main kontrollü source type-check: **PASS**.
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC**.
- Repository source gate: **PASS**.
- Temiz npm ci: **FAIL — 3 bağımsız koşu / 9 deneme; EAI_AGAIN ve ATTEMPT_TIMEOUT**.
- Force-settle ve kalıntı temizliği: **PASS**.
- Tam root `tsc --noEmit`, production build, blocking smoke, Windows launch ve installer: **NOT_RUN**.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
