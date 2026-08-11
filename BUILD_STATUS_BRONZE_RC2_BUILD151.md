# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 151 Durumu

- Application Version: `29.07.2026.151`
- Package Version: `29.7.2026-151`
- Stage: **Bronze RC2 Active Development**
- Build: **151**
- Ana konu: **Doğrulanmış ve sürdürülebilir npm bağımlılık edinme kiti**

## Kod ve mimari değişiklikleri

- Aktif lockfile için deterministik npm edinme planı üretimi.
- Yalnız resmî npm HTTPS origin'i ve SHA-512 tarball doğrulaması.
- Güvenli staging, bozuk dosyanın yeniden alınması ve atomik tamamlama.
- Retry/backoff ve iç `fetch.cause` ağ kodlarının doğru sınıflandırılması.
- Mevcut cache transfer formatında deterministik bundle üretimi.
- Windows PowerShell ve Linux/macOS bağlantılı makine yardımcıları.
- Çevrimdışı gerçek `npm ci` fixture doğrulaması.

## Zorunlu kapılar

- Source preflight gate: **PASS — 69/69**
- Source integrity: **PASS — manifest 1.260 / kaynak 1.260 / SHA256SUMS 1.261**
- Clean install gate: **FAIL — EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE**
- Full root `tsc --noEmit`: **FAIL — bağımlılık kurulamadı (`node`, `vite/client`)**
- Unit and integration tests: **FAIL — `vitest` kurulamadı**
- Electron production build: **FAIL — ilk workspace TypeScript adımında eksik Node tipleri**
- Blocking smoke chain: **FAIL — ilk smoke TypeScript adımında eksik Node tipleri**
- Windows launch / installer: **NOT_RUN — Linux ortamı**

## Gerçekten geçen hedefli kontroller

- Build 151 dependency acquisition contract: **PASS — 35/35**
- Build 151 acquisition plan: **PASS — 117 resmî tarball**
- Gerçek edinme hata sınıflandırması: **PASS — EAI_AGAIN doğru yüzeye çıkarıldı**
- Build 150 dependency bootstrap continuity: **PASS — 19/19**
- Build 150 Windows packager split continuity: **PASS — 15/15**
- Package-source controlled TypeScript: **PASS — TypeScript 5.8.3**
- Desktop-main controlled TypeScript: **PASS**
- Active version contract: **PASS — 178 assertion / 14 workspace**
- Active delivery documents: **PASS — 121 assertion / 5 belge**
- Validation boundary: **INCOMPLETE — 2 PASS / 5 FAIL / 1 NOT_RUN**

## Aşama kararı

Proje **Bronze RC2 Active Development** aşamasında kalır. Bronze RC2 Final,
Code Freeze, Silver veya Gold aşamasına geçilmemiştir. Zorunlu kapılar PASS
olmadığı için final sorusu sorulamaz.
