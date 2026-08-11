# Build 149 Mimari Doğrulama Raporu

## Kapsam

Build 149, uygulama özelliği eklemek yerine doğrulama ve bağımlılık bootstrap
mimarisini sertleştirir.

## Bulgular

- Masaüstü workspace'inde doğrudan tanımlanan `esbuild 0.25.12` mevcut üretim
  hattında kullanılmıyordu ve Vite/Rolldown zinciri için zorunlu değildi.
- Bu bağımlılık, kurulum hizmetindeki ilk 404 engelini oluşturuyordu; kaldırılması
  sonrası kurulum daha ileri giderek farklı bir paket olan `yargs-parser` üzerinde
  aynı hizmet 404'üne ulaştı.
- Böylece sorun tek bir bağımlılığa indirgenemedi; dış paket hizmeti engeli olarak
  sınıflandırıldı.
- Kaynak preflight kapsamı Build 142'de kalmıştı. Build 143–149 sözleşme ve runtime
  kontrolleri zincire eklendi.
- Geçmiş özellik sözleşmelerindeki aktif sürüm sabitlemeleri, ileri build
  devamlılık denetimini engelliyordu; özellik build'i veya sonrası yaklaşımıyla
  düzeltildi.

## Güvenlik kararı

Bağımlılık kurulumu atlanarak üretim build'i veya test sonucu üretmek yerine zincir
fail-closed bırakıldı. Kaynak-only kontroller bağımsız çalıştırılır; bağımlılık
isteyen kapılar FAIL olarak korunur.

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

## Doğrulama sınırı ve teslim tasdiki

- Build 149 doğrulama sınırı: **INCOMPLETE — 2 PASS / 5 FAIL / 1 NOT_RUN**
- Kaynak ve preflight kapıları PASS; temiz kurulum, TypeScript, test, build ve smoke FAIL.
- Windows yaşam döngüsü Linux ortamında NOT_RUN.
- Ayrık teslim tasdiki, Build 149 kanıt yollarını ve gerçek FAIL durumlarını kabul edecek şekilde güncellendi.
