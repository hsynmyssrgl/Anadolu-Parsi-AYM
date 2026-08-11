# 32-C PPK-007 imzalı ve sürümlü politika paketi üst kapanış denetimi

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Politika sürümü, uygulama sürümleri, capability manifestleri ve karar kuralları tek kanonik pakete bağlandı.
- Payload SHA-256 özeti ve alan ayrımlı HMAC-SHA-256 imzası Kernel tarafından doğrulanıyor.
- Strict istek, karar, receipt, aktif işlem bağlamı ve kalıcı receipt record aynı paket sürümü/özeti/uygulama sürümünü taşıyor.
- Paket sürümü, paket özeti ve uygulama sürümü uyuşmazlıkları işlem başlamadan varsayılan-ret ile kapanıyor.
- Süreç dışı sağlayıcı imzalı paket metadata’sı vermezse PEP fail-closed duruyor.
- Core Service ve Desktop başlangıç sınırları uygulama/politika paket sürüm uyuşmazlığında çalışmayı reddediyor.
- Göç 72, yeni receipt sütunlarını ve JSON zinciriyle tam eşleşmeyi zorunlu kılan SQLite tetikleyicisini kuruyor.
- Repository yalnız aktif işlem bağlamındaki tam paket bağını kalıcılaştırıyor.
- Ortak Desktop API PEP’i ve preload IPC üzerinden UI/menü sınırlaması korunmuştur.

## Temiz doğrulama

- PPK-007 kapanış sözleşmesi: 32/32 PASS.
- PPK-007 hedefli test: 17/17 PASS.
- Platform Policy regresyonu: 78/78 PASS.
- Veritabanı göç zinciri: 72/72 uygulanabilir ve idempotent PASS.
- Tam Vitest: 56 dosya, 350 test PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- Eski Desktop kasası korunmuştur.
- Gerçek veri taşınmamıştır.
- SQLite yazma sahipliği Core Service’e verilmemiştir.
- Cutover otoritesi bağlanmamış ve DEC-171 kaldırılmamıştır.
- Yeni Build verilmemiştir.

Bu kapanış yalnız PPK-007 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
