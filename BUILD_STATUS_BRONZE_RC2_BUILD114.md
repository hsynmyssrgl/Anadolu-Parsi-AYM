# Panthera pardus tulliana Aile — Bronze RC2 Build 114

- Application Version: `25.07.2026.114`
- Package Version: `25.7.2026-114`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 114 odağı

Kullanıcının ilk karşılaştığı aktif teslim belgelerinin sürüm, build referansları ve gerçek doğrulama durumundan kopmasını önleyen merkezi belge sözleşmesi oluşturuldu.

## Mimari değişiklikler

- `README.md`, `START_HERE_TR.md`, `PAKET_OZETI_TR.md`, `DELIVERY_SUMMARY_TR.md` ve `VERIFICATION_REPORT.md` sürüm yükseltme komutuyla birlikte güvenli biçimde yenilenir.
- Yeni build başlatıldığında önceki buildin PASS/FAIL sonuçları taşınmaz; zorunlu kapılar yeniden çalıştırılıncaya kadar `NOT_RUN` olarak sıfırlanır.
- Aktif belgelerde eski uygulama/paket sürümü, eski RC2/MVP dosya referansı ve yanlış aşama iddiası reddedilir.
- `VERIFICATION_REPORT.md` ile kök `BUILD_STATUS.md` kapı durumları çapraz doğrulanır.
- Paket özeti ve teslim özeti arasındaki drift engellenir.
- Belge sözleşmesi source-preflight zincirinin zorunlu kontrolü yapıldı.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.

## Gerçek doğrulama durumu

- Source-preflight: **PASS — 8/8**.
- Source integrity: **PASS — 911 kaynak dosyası / 912 iç SHA-256 girdisi**.
- Aktif teslim belge sözleşmesi: **PASS — 118 assertion / 5 belge**.
- Build 114 mimari doğrulaması: **PASS — 40 assertion**.
- Lockfile integrity: **PASS — 1.150 assertion**.
- Dependency supply: **PASS — 1.349 assertion / 436 tarball**.
- Workspace contracts: **PASS — 356 assertion**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- Package-source controlled type-check: **PASS**.
- Electron-main controlled source type-check: **PASS**.
- Bronze database source gate: **PASS**.
- Repository source gate: **PASS**.
- Temiz npm ci: **FAIL — resmî npm registry üzerinde 3 bağımsız kontrollü deneme; EAI_AGAIN / ATTEMPT_TIMEOUT**.
- Tam root `tsc --noEmit`, production build, blocking smoke, Windows launch ve installer: **NOT_RUN**.
