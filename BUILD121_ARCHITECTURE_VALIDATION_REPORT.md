# Build 121 Mimari Doğrulama Raporu

- Product: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.121`
- Package Version: `25.7.2026-121`
- Stage: **Bronze RC2 Active Development**
- Build: **121**

## Kapsam

Workspace manifest ve lockfile yolları, işletim sistemi ayırıcısından bağımsız ortak bir kanonikleştirme sınırından geçirilir. Aktif sürüm doğrulayıcısı ile sürüm artırıcı aynı yol sözleşmesini kullanır.

## Güvenlik ve doğrulama özellikleri

- Yalnız repository-relative yollar kabul edilir.
- `..`, `.`, boş segment, mutlak POSIX yolu ve Windows sürücü yolu reddedilir.
- Windows ters eğik çizgileri lockfile’ın kanonik ileri eğik çizgi biçimine çevrilir.
- Workspace manifestinden lockfile anahtarı tek ortak fonksiyonla türetilir.
- Sürüm artırıcı yalnız gerçek `apps/*` ve `packages/*` workspace lock girdilerini günceller.

## Sonuç

- Workspace path portability sözleşmesi: **PASS — 37 assertion**
- Build 121 mimari entegrasyonu: **PASS — 60 assertion**
- Tam root `tsc --noEmit`: **PASS — TypeScript 7.0.2**
- Package-source type-check: **PASS — TypeScript 7.0.2**
- Electron-main kontrollü type-check: **PASS**

Build 121 ayrıca TypeScript 7’de kaldırılan `baseUrl` seçeneğini temizler, bütün workspace alias yollarını açık göreli biçime taşır ve TypeScript compiler’ını Windows `.cmd` çözümlemesine bağlı kalmadan yerel Node entrypoint’i üzerinden çalıştırır.
