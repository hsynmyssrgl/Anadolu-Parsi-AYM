# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 152 Durumu

- Application Version: `29.07.2026.152`
- Package Version: `29.7.2026-152`
- Stage: **Bronze RC2 Active Development**
- Build: **152**
- Ana konu: **Çevrimdışı bağımlılık paketi kabulü, makbuz bütünlüğü ve karantina**

## Kod ve mimari değişiklikleri

- ZIP + SHA-256 yan dosyası zorunlu fail-closed kabul sınırı.
- Normal dosya, uzantı, boyut ve checksum dosya adı doğrulaması.
- Aktif package-lock ve paket sürümüne bağlı transfer ZIP doğrulaması.
- Atomik kabul alanı ve yeni npm cache'e güvenli import.
- Lock hash + ZIP hash bağlı kabul/red makbuzları ve makbuz SHA-256 dosyası.
- Aynı paketin güvenli idempotent yeniden kabulü.
- Bozuk veya uyuşmayan paketler için ayrı karantina.
- Windows PowerShell ve Linux/macOS çevrimdışı kabul yardımcıları.

## Gerçekten geçen hedefli kontroller

- Build 152 cache bundle acceptance contract: **PASS — 26/26**
- Fixture transfer bundle doğrulaması: **PASS**
- Fixture gerçek offline `npm ci`: **PASS**
- Package-source controlled TypeScript: **PASS — TypeScript 5.8.3**
- Desktop-main controlled TypeScript: **PASS**

## Zorunlu kapılar

- Source preflight gate: **PASS** — 71/71
- Source integrity: **PASS** — manifest 1.273 / kaynak 1.273 / SHA256SUMS 1.274
- Clean install gate: **NOT_RUN — gerçek 117 tarball paketi henüz sağlanmadı**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

## Aşama kararı

Proje **Bronze RC2 Active Development** aşamasında kalır. Bronze RC2 Final,
Code Freeze, Silver veya Gold aşamasına geçilmemiştir. Geniş zorunlu kapılar
PASS olmadığı için final sorusu sorulamaz.
