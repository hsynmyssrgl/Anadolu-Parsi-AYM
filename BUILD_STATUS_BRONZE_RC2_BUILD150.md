# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 150 Durumu

- Application Version: `29.07.2026.150`
- Package Version: `29.7.2026-150`
- Stage: **Bronze RC2 Active Development**
- Build: **150**

- Uygulama sürümü: `29.07.2026.150`
- Paket sürümü: `29.7.2026-150`
- Aşama: **Bronze RC2 Active Development**
- Ana konu: **Yeniden üretilebilir bağımlılık kurulumu ve tam doğrulama kapılarının yeniden denenmesi**

## Kod ve mimari değişiklikleri

- Doğrulanmış npm cache aktarım paketi, `PPT_NPM_CACHE_BUNDLE` veya
  `--cache-bundle` ile temiz kurulum koşucusuna bağlandı.
- Cache paketi aktif `package-lock.json` SHA-256 değeri ve paket sürümüyle
  uyuşmadan içe aktarılamıyor.
- Tam cache bulunduğunda ağ kullanılmadan `npm ci --offline --ignore-scripts`
  çalıştırılıyor.
- Cache paketi uyuşmazlığında çevrimiçi kuruluma sessiz geçiş yapılmıyor;
  `CACHE_BUNDLE_REJECTED` ile fail-closed duruluyor.
- Kurulum betikleri temiz bağımlılık kapısında kapatıldı.
- Windows'a özgü `electron-builder` ve 229 ek kilit kaydı kök bağımlılık
  grafiğinden ayrılarak `tools/windows-packager` altına taşındı.
- Windows paketleyici ayrı kilit dosyası, güvenli override'lar ve fail-closed
  Squirrel uyumluluk stub'ı ile korunuyor.
- Kök kilit dosyası 375 kayıttan 146 kayda; resmî registry tarball kapsamı
  341'den 117'ye düşürüldü.

## Zorunlu kapılar

- Source preflight gate: **PASS** — 67/67
- Source integrity: **PASS** — manifest 1.246 / kaynak 1.246 / SHA256SUMS 1.247
- Clean install gate: **FAIL — EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE**
- Full root `tsc --noEmit`: **FAIL — bağımlılık kurulamadı (`node`, `vite/client`)**
- Unit and integration tests: **FAIL — `vitest` kurulamadı**
- Electron production build: **FAIL — ilk workspace TypeScript adımında eksik Node tipleri**
- Blocking smoke chain: **FAIL — ilk smoke TypeScript adımında eksik Node tipleri**
- Windows launch / installer: **NOT_RUN — Linux ortamı**

## Gerçekten geçen hedefli kontroller

- Build 150 doğrulanmış cache bootstrap sözleşmesi: **PASS — 19/19**
- Build 150 Windows paketleyici ayrıştırma sözleşmesi: **PASS — 15/15**
- Build toolchain güvenlik sözleşmesi: **PASS — 71 assertion**
- Lockfile bütünlüğü: **PASS — 438 assertion / 14 workspace**
- Bağımlılık tedarik kökeni: **PASS — 376 assertion / 117 tarball**
- Workspace bağımlılık sözleşmesi: **PASS — 360 assertion / 14 workspace**
- Build 149 devamlılık sözleşmesi: **PASS — 44/44**
- Sürüm sırası: **PASS — 29.07.2026.150 / Temmuz sıra 150**
- Build 150 dürüst doğrulama sözleşmesi: **PASS — 45/45**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 122 assertion / 5 belge**
- Teslim tasdik sözleşmesi: **PASS — 14 kanıt / 8 kapı iddiası**
- Doğrulama sınırı: **INCOMPLETE — 2 PASS / 5 FAIL / 1 NOT_RUN**

## Temiz kurulum sonucu

Build 150 temiz kurulum koşucusu gerçek kaynak ağacında tekrar çalıştırıldı.
Doğrulanmış cache paketi sağlanmadığı ve yerel cache `0/117` olduğu için resmî
npm kaynağına kontrollü erişim denendi. Ortam DNS/paket hizmeti erişilemezliği
30 saniyelik sınırda `EAI_AGAIN` ve `ATTEMPT_TIMEOUT` olarak sınıflandırıldı.
Kapı **PASS sayılmadı**.

## Aşama kararı

Bronze RC2 Active Development korunur. Bronze RC2 Final, Code Freeze, Silver veya
Gold aşamasına geçilmemiştir. Zorunlu kapılar PASS olmadığı için final sorusu
sorulamaz.
