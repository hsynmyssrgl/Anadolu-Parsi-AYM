# Build 112 Architecture Validation Report

## Kimlik

- Ürün: Panthera pardus tulliana Aile
- Application Version: `25.07.2026.112`
- Package Version: `25.7.2026-112`
- Aşama: **Bronze RC2 Active Development**

## Çözülen mimari sorunlar

1. `manifest.json` ve `SHA256SUMS.txt` teslim sonunda üretiliyor ancak kaynak ön-kontrolünün ilk kapısında gerçek kaynak ağacıyla çapraz doğrulanmıyordu.
2. Manifest üreticisi ile doğrulayıcı arasında ortak dosya-toplama ve yol güvenliği sözleşmesi bulunmuyordu.
3. Dosya ekleme, silme, değiştirme, byte/hash uyuşmazlığı, sıralama bozulması, tekrarlı yol ve manifest dışı kaynak ilk RC2 kapısında deterministik olarak tespit edilmiyordu.
4. Geçici doğrulama kanıtları manifestlenmiş kaynak dosyalarını değiştirebildiği için source-integrity tekrar çalıştırıldığında yanlış biçimde bozulabiliyordu.
5. Dışarıdan SIGINT/SIGTERM alan temiz npm yöneticisinin Unix üzerinde ayrılmış npm process grubunu yetim bırakma riski vardı.

## Uygulanan mimari

- `scripts/lib/source-manifest.mjs`, manifest üretimi ve doğrulaması için tek kaynak kuralıdır.
- Manifest şeması 3; paket sürümü, üretim zamanı, açık dosya sayısı, kanonik yol, byte ve SHA-256 değerlerini taşır.
- `SHA256SUMS.txt`, tüm manifest kaynaklarını ve `manifest.json` dosyasını doğrular; kendi kendisini hash'lemez.
- Mutlak yol, traversal, boş/tekrarlı segment, sırasız/tekrarlı kayıt, sembolik bağlantı ve desteklenmeyen dosya sistemi girdileri reddedilir.
- `artifacts/validation` değişken çalışma kanıtı alanıdır ve teslim manifestinden ayrıdır.
- Aktif sürüm, kontrollü TypeScript ve Build 112 mimari kanıtları değişken doğrulama alanına taşındı; manifestlenmiş tarihsel kanıtlar çalışma sırasında değiştirilmez.
- `source-integrity`, source-preflight zincirinin ilk ve zorunlu kontrolüdür.
- Temiz npm yöneticisi SIGINT/SIGTERM'i aktif npm process grubuna aktarır, `RUNNER_INTERRUPTED` olarak sınıflandırır, yeniden denemeyi durdurur ve kalıntıları temizler.

## Hedefli mimari doğrulama

`node scripts/verify-build112-architecture.mjs` gerçekten çalıştırıldı.

- Sonuç: **PASS**
- Hedefli assertion: **103**
- Doğrulanan senaryolar:
  - Güncel kaynak ağacının manifest/SHA eşitliği
  - Kaynak dosyası içerik ve byte değişikliği reddi
  - Manifest dışı yeni dosya reddi
  - Manifest paket sürümü kayması reddi
  - Bozuk ve tekrarlı SHA256SUMS reddi
  - Güvensiz kaynak yolu reddi
  - Geçici validation kanıtlarının manifest dışında kalması
  - Kaynak ön-kontrolünün 6/6 çalışması
  - Kesintiye uğrayan npm denemesinin yeniden denenmemesi
  - Gerçek SIGTERM altında npm process grubu ve alt çocuğunun kapanması
  - Kesinti kanıtı ve başarısız kurulum kalıntı temizliği

## Gerçek kaynak ön-kontrolü

- Source integrity: **PASS**
- Manifest kaynak dosyası: **896**
- SHA-256 girdisi: **897**
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**
- Dependency supply: **PASS — 1.349 assertion / 436 canonical tarball**
- Workspace dependency contracts: **PASS — 356 assertion / çevrimsiz production graph**
- Version sequence: **PASS — 25.07.2026.112**
- Active version contract: **PASS — 178 assertion / 14 workspace**

## Bağımlılık kapısı

Build 112 temiz kaynak kopyasında resmî npm registry için üç kontrollü erişim denemesi gerçekten yapıldı.

- Sonuç: **FAIL**
- Sınıflandırma: `EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE`
- Sinyaller: `EAI_AGAIN`, `ATTEMPT_TIMEOUT`
- Registry: yalnızca `https://registry.npmjs.org/`
- Kısmi `node_modules` kalıntı temizliği: **PASS**
- Yetim npm süreci: **yok**

Bu dış bağımlılık engeli nedeniyle tam root type-check, production build, blocking smoke, Windows gerçek açılış ve installer kapıları çalıştırılmamış ve PASS olarak raporlanmamıştır.

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
