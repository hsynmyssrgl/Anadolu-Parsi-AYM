# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 149 Durumu

- Application Version: `29.07.2026.149`
- Package Version: `29.7.2026-149`
- Stage: **Bronze RC2 Active Development**
- Build: **149**

- Uygulama sürümü: `29.07.2026.149`
- Paket sürümü: `29.7.2026-149`
- Aşama: **Bronze RC2 Active Development**
- Ana konu: **Toplu temiz doğrulama ve bağımlılık bootstrap sertleştirmesi**

Build 149'da temiz kurulum, tam TypeScript, bütün testler, Electron production build
ve blocking smoke gerçekten denendi. Paket tedarik hizmeti engeli nedeniyle temiz
kurulum tamamlanamadı; bağımlılığa bağlı sonraki kapılar FAIL oldu ve PASS olarak
raporlanmadı.

## Kod değişiklikleri

- Kullanılmayan doğrudan `esbuild 0.25.12` bağımlılığı kaldırıldı.
- Eski esbuild kurulum izni ve lockfile tedarik kayıtları kaldırıldı.
- Build 143–149 kaynak devamlılık kontrolleri preflight zincirine eklendi.
- Geçmiş özellik sözleşmeleri sonraki build doğrulamasına uygunlaştırıldı.
- Build 149 temiz doğrulama sözleşmesi eklendi.

## Kapılar

- Source preflight gate: **PASS** — 64/64 bağımlılıktan bağımsız kontrol
- Source integrity: **PASS** — 1.236 kaynak dosyası / 1.237 SHA256SUMS girdisi
- Clean install gate: **FAIL**
- Full root `tsc --noEmit`: **FAIL**
- Unit and integration tests: **FAIL**
- Electron production build: **FAIL**
- Blocking smoke chain: **FAIL**
- Windows launch / installer: **NOT_RUN**

## Bağımlılıktan bağımsız hedefli kontroller

- Build 143 güvenli HTTPS fetch devamlılığı: **PASS — 20/20**
- Build 144 sağlayıcı profil sözleşmesi: **PASS — 43/43**
- Build 144 pin geçişi runtime: **PASS — 26/26**
- Build 144 renderer/preload/global sözdizimi: **PASS — 3/3**
- Build 145 güvenli periyodik senkronizasyon sözleşmesi: **PASS — 17/17**
- Build 145 renderer/preload/global sözdizimi: **PASS — 3/3**
- Build 146 içe aktarma sözleşmesi/runtime/SQL: **PASS — 34/34, 25/25, 11/11**
- Build 146 renderer/preload/global sözdizimi: **PASS — 3/3**
- Build 147 performans sözleşmesi/runtime/SQL: **PASS — 42/42, 16/16, 14/14**
- Build 147 renderer/preload/global/main sözdizimi: **PASS — 4/4**
- Build 148 entegrasyon sözleşmesi/IPC/runtime: **PASS — 43/43, 22/22, 17/17**
- Build 148 renderer/preload/global/main/politika sözdizimi: **PASS — 5/5**
- Build 149 temiz doğrulama sözleşmesi: **PASS — 38/38**
- Lockfile bütünlüğü: **PASS — 917 assertion / 14 workspace**
- Bağımlılık tedarik kökeni: **PASS — 1.065 assertion / 344 tarball**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Sürüm sıra sözleşmesi: **PASS — 29.07.2026.149 / Temmuz sıra 149**
- Kontrollü package-source TypeScript: **FAIL — temiz kurulum olmadığı için `@types/node` yok**
- Kontrollü desktop-main TypeScript: **FAIL — temiz kurulum olmadığı için `@types/node` yok**

## Aşama kararı

Bronze RC2 Active Development korunur. Final, Code Freeze, Silver veya Gold aşamasına
geçilmemiştir.

## Doğrulama sınırı ve teslim tasdiki

- Build 149 doğrulama sınırı: **INCOMPLETE — 2 PASS / 5 FAIL / 1 NOT_RUN**
- Kaynak ve preflight kapıları PASS; temiz kurulum, TypeScript, test, build ve smoke FAIL.
- Windows yaşam döngüsü Linux ortamında NOT_RUN.
- Ayrık teslim tasdiki, Build 149 kanıt yollarını ve gerçek FAIL durumlarını kabul edecek şekilde güncellendi.
