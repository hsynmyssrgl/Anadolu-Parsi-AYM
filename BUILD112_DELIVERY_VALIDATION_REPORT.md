# Build 112 Delivery Validation Report

## Teslim kimliği

- Ürün: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.112`
- Package Version: `25.7.2026-112`
- Kanal: **Bronze RC2 Active Development**
- Kaynak teslimi: `Panthera_pardus_tulliana_Bronze_RC2_Gelistirme_Build112_Kaynak_Kod_25.07.2026.112.zip`

## Teslim sözleşmesi

- Kaynak ZIP `node_modules`, `.tmp`, build çıktısı veya geçici `artifacts/validation` kanıtı içermez.
- `manifest.json` şema 3 ile kaynak yollarını, byte sayılarını ve SHA-256 değerlerini taşır.
- `SHA256SUMS.txt` tüm manifest kaynaklarını ve `manifest.json` dosyasını doğrular.
- Haricî kaynak ZIP SHA-256 değeri ayrı `.sha256` dosyasında tutulur.
- Kaynak paketi ayrı klasöre çıkarılarak iç SHA-256 zinciri ve source-integrity tekrar çalıştırılır.

## Gerçek doğrulama sonuçları

- Source-preflight: **PASS — 6/6 kontrol**
- Build 112 mimari doğrulaması: **PASS — 103 assertion**
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**
- Electron-main kontrollü source type-check: **PASS**
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC kanalı**
- Repository source doğrulaması: **PASS**
- Node `.mjs` syntax: **PASS — 100 dosya**
- JSON parse: **PASS — 267 dosya**
- YAML parse: **PASS — 2 dosya**
- Temiz npm erişimi: **FAIL — 3 kontrollü denemede EAI_AGAIN / ATTEMPT_TIMEOUT**
- Başarısız kurulum kalıntı temizliği: **PASS**
- RC2 sıralı rapor: source-preflight `PASS`, clean-npm-ci `FAIL`, sonraki kapılar `NOT_RUN — blockedBy: clean-npm-ci`

## Çalıştırılmayan kapılar

- Tam root `tsc --noEmit`: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke zinciri: **NOT_RUN**
- Windows gerçek açılış testi: **NOT_RUN**
- Windows installer üretimi ve doğrulaması: **NOT_RUN**

Bu rapor yalnızca gerçekten çalıştırılmış kontrolleri PASS olarak gösterir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
