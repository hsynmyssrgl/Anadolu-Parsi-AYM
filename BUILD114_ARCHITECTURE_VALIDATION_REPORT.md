# Build 114 Architecture Validation Report

## Kimlik

- Product: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.114`
- Package Version: `25.7.2026-114`
- Stage: **Bronze RC2 Active Development**

## Build 114 odağı

Kullanıcının ilk karşılaştığı aktif teslim belgelerinin sürüm, build bağlantıları ve gerçek doğrulama durumundan kopmasını engelleyen merkezi belge sözleşmesi.

## Uygulanan mimari

- `scripts/set-workspace-version.mjs`, sürüm yükseltirken `README.md`, `START_HERE_TR.md`, `PAKET_OZETI_TR.md`, `DELIVERY_SUMMARY_TR.md` ve `VERIFICATION_REPORT.md` dosyalarını güncel build için yeniden oluşturur.
- Yeni build başında önceki buildin PASS/FAIL sonuçları taşınmaz; zorunlu kapılar güvenli biçimde `NOT_RUN` durumuna sıfırlanır.
- `scripts/verify-active-delivery-documents.mjs`, beş aktif belgede ürün, uygulama sürümü, paket sürümü, build ve aşama markerlarını doğrular.
- Eski uygulama/paket sürümü, eski MVP veya RC2 dosya bağlantısı, eksik güncel rapor ve yanlış aşama iddiası reddedilir.
- `PAKET_OZETI_TR.md` ile `DELIVERY_SUMMARY_TR.md` byte düzeyinde aynı tutulur.
- `VERIFICATION_REPORT.md` kapı durumları kök `BUILD_STATUS.md` ile çapraz doğrulanır; yanlış PASS raporu reddedilir.
- Belge sözleşmesi source-preflight zincirinin sekizinci zorunlu kontrolüdür.
- Linux CI ve Windows RC2 workflow kanıtlarına `active-delivery-documents.json` eklendi.
- Süre aşımında `close` olayı üretmeyen npm alt süreçleri için zorunlu force-settle eklendi; deneme raporu `forcedSettlement` alanını taşır.

## Hedefli doğrulama

- Build 114 mimari doğrulaması: **PASS — 40 assertion**.
- Aktif teslim belge sözleşmesi: **PASS — 118 assertion / 5 belge**.
- Eski display sürümü fixture'ı: **REJECTED**.
- Eski RC2 build bağlantısı fixture'ı: **REJECTED**.
- Kök durum `NOT_RUN` iken doğrulama raporunda yanlış `PASS`: **REJECTED**.
- Paket ve teslim özeti ayrışması: **REJECTED**.
- Güncel referans dosyasının eksikliği: sözleşme tarafından **REJECTED**.
- Npm timeout force-settle: gerçek temiz kurulum denemesinde **PASS**.

## Kaynak ve kontrollü TypeScript kapıları

- Source-preflight: **PASS — 8/8**.
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**.
- Dependency supply: **PASS — 1.349 assertion / 436 tarball**.
- Workspace dependency contracts: **PASS — 356 assertion**.
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**.
- Package-source controlled type-check: **PASS — TypeScript 5.8.3**.
- Electron-main controlled source type-check: **PASS**.
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC kanalı**.
- Repository source-only doğrulaması: **PASS**.

## Dış bağımlılık kapısı

Resmî npm registry üzerinde üç bağımsız kontrollü temiz `npm ci` denemesi her koşuda `EAI_AGAIN` ve `ATTEMPT_TIMEOUT` nedeniyle `EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE` olarak sonuçlandı. Süre aşan process-tree zorla kapatıldı ve kısmi `node_modules` kalıntıları temizlendi.

Bu nedenle tam root `tsc --noEmit`, Electron production build, blocking smoke, Windows gerçek açılış ve Windows installer kapıları çalıştırılmadı.
