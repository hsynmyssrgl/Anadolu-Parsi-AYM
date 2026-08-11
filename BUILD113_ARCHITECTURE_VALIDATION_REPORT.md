# Build 113 Architecture Validation Report

## Kimlik

- Ürün: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.113`
- Package Version: `25.7.2026-113`
- Aşama: **Bronze RC2 Active Development**

## Build 113 odağı

Kaynak teslim ZIP'inin dış ZIP aracı, dosya sistemi zaman damgası, dosya izinleri veya işletim sistemi sıralamasına bağlı olmadan aynı kaynak ağacından byte düzeyinde aynı biçimde yeniden üretilebilmesi.

## Uygulanan mimari

- Bağımlılıksız ZIP32/STORE yazıcı ve doğrulayıcı `scripts/lib/deterministic-zip.mjs` içinde oluşturuldu.
- ZIP yolu UTF-8, kesin sıralı, tekrarsız ve repository-relative olmak zorundadır.
- ZIP zamanı `1980-01-01 00:00:00`, Unix dosya modu `100644` olarak sabitlenir.
- Sıkıştırma yöntemi STORE'dur; zlib sürüm farklarının teslim hash'ini değiştirmesi engellenir.
- Yerel ZIP başlıkları ve merkezi dizin birbiriyle çapraz doğrulanır.
- CRC-32, SHA-256, byte sayısı, dosya kümesi, dosya sırası, izin ve zaman metadata'sı doğrulanır.
- `manifest.json` ve `SHA256SUMS.txt` kaynak arşive açık biçimde dahil edilir.
- İki bağımsız ZIP üretiminin byte düzeyinde aynı olması source-preflight zincirinin zorunlu ikinci kontrolüdür.
- Linux CI ve Windows RC2 workflow kanıtlarına `source-archive-reproducibility.json` eklendi.

## Hedefli doğrulama

- Build 113 mimari doğrulaması: **PASS — 44 assertion**
- Aynı içerikten iki ZIP üretimi: **PASS — byte-identical**
- Dosya mtime ve izin değişikliğinin ZIP hash'ini değiştirmemesi: **PASS**
- Değiştirilmiş içerik için CRC-32 reddi: **PASS**
- Kesilmiş ZIP reddi: **PASS**
- ZIP sonuna eklenen veri reddi: **PASS**
- Yerel zaman damgası oynama reddi: **PASS**
- Sırasız yol reddi: **PASS**
- Tekrarlı yol reddi: **PASS**
- Traversal yolu reddi: **PASS**
- Sistem `unzip -t` uyumluluğu: **PASS**

## Kaynak ve kontrollü TypeScript kapıları

- Source-preflight: **PASS — 7/7**
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**
- Dependency supply: **PASS — 1.349 assertion / 436 tarball**
- Workspace dependency contracts: **PASS — 356 assertion**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Package-source controlled type-check: **PASS — TypeScript 5.8.3**
- Electron-main controlled source type-check: **PASS**
- Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC kanalı**
- Repository source-only doğrulaması: **PASS**

## Dış bağımlılık kapısı

Temiz kaynak kopyasında resmî npm registry'ye üç kontrollü `npm ci` denemesi yapıldı. Üç deneme de `EAI_AGAIN` ve `ATTEMPT_TIMEOUT` sinyalleriyle `EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE` olarak sınıflandırıldı. Kısmi kök ve desktop `node_modules` kalıntıları kaldırıldı.

Bu nedenle tam root `tsc --noEmit`, Electron production build, blocking smoke, Windows gerçek açılış ve Windows installer kapıları çalıştırılmadı ve PASS olarak raporlanmadı.
