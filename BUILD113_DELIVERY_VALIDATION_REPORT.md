# Build 113 Delivery Validation Report

## Teslim kimliği

- Ürün: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.113`
- Package Version: `25.7.2026-113`
- Kanal: **Bronze RC2 Active Development**
- Kaynak teslimi: `Panthera_pardus_tulliana_Bronze_RC2_Gelistirme_Build113_Kaynak_Kod_25.07.2026.113.zip`

## Teslim sözleşmesi

- Kaynak ZIP yalnızca `manifest.json` tarafından tanımlanan kaynak dosyalarını, `manifest.json` dosyasını ve `SHA256SUMS.txt` dosyasını içerir.
- `node_modules`, `.tmp`, build çıktıları ve değişken `artifacts/validation` kanıtları ZIP'e girmez.
- ZIP32/STORE çıktısı kesin dosya sırası, UTF-8 yol adı, sabit zaman ve sabit izin modu ile üretilir.
- Aynı kaynak ağacından iki üretim byte düzeyinde aynı olmak zorundadır.
- ZIP'in yerel başlıkları, merkezi dizini, CRC-32, SHA-256, byte sayıları ve içerik kümesi çapraz doğrulanır.
- Dış kaynak ZIP SHA-256 değeri ayrı `.sha256` dosyasında tutulur.

## Gerçek doğrulama sonuçları

- Source-preflight: **PASS — 7/7**
- Kaynak ZIP yeniden üretilebilirliği: **PASS — iki üretim byte-identical**
- Build 113 mimari doğrulaması: **PASS — 44 assertion**
- Package-source kontrollü type-check: **PASS — TypeScript 5.8.3**
- Electron-main controlled source type-check: **PASS**
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC kanalı**
- Repository source-only doğrulaması: **PASS**
- Sistem ZIP uyumluluk testi: **PASS — `unzip -t`**
- Başarısız kurulum kalıntı temizliği: **PASS**
- RC2 sıralı rapor: source-preflight `PASS`, clean-npm-ci `FAIL`, sonraki kapılar `NOT_RUN — blockedBy: clean-npm-ci`

## Temiz npm sonucu

- Deneme sayısı: **3**
- Registry: yalnızca `https://registry.npmjs.org/`
- Sonuç: **FAIL — EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE**
- Sinyaller: `EAI_AGAIN`, `ATTEMPT_TIMEOUT`
- Alternatif registry: **kullanılmadı**
- Kısmi `node_modules` kalıntıları: **temizlendi**

## Çalıştırılmayan kapılar

- Tam root `tsc --noEmit`: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke zinciri: **NOT_RUN**
- Windows gerçek açılış testi: **NOT_RUN**
- Windows installer üretimi ve doğrulaması: **NOT_RUN**

Bu rapor yalnızca gerçekten çalıştırılmış kontrolleri PASS olarak gösterir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
