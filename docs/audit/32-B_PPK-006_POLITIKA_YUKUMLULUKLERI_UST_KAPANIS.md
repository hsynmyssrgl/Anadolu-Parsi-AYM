# 32-B PPK-006 politika yükümlülükleri üst kapanış denetimi

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Maskeleme, yalnız yerel işleme, önbellek yasağı, dışa aktarım yasağı, AI yasağı, kayıt yasağı, filigran ve saklama yönergesi ayrı politika değerleridir.
- Veri sınıfları sekiz yükümlülüğü deterministik ve kanonik sırada üretir.
- Alan maskesi istenen alan kümesine; filigran politika sürümü ve correlation kimliğine; saklama yönergesi rıza veya veri sınıfı politikasına bağlanır.
- Geçersiz değer, tekrar, sıra veya bağlam içeren yükümlülükler işlem başlamadan reddedilir.
- Dışa aktarım, AI, kayıt ve yalnız yerel işleme ile çelişen operasyonlar makbuz kalıcılığı ve callback öncesinde fail-closed durur.
- PEP çalışma zamanı kontrolleri ve yürütülen yükümlülük sırası SHA-256 attestation ile imzalı makbuza bağlanır.
- Aktif işlem bağlamı ve repository aynı attestation kanıtını doğrular.
- Göç 71 ve SQLite tetikleyicisi yeni makbuzlarda `obligation_execution_hash` kalıcılığını zorunlu kılar.
- Ortak Desktop API PEP’i ve preload IPC üzerinden UI/menü sınırlaması korunmuştur.

## Temiz doğrulama

- PPK-006 kapanış sözleşmesi: 32/32 PASS.
- PPK-006 hedefli test: 15/15 PASS.
- Core Service yükümlülük regresyonu: 2/2 PASS.
- Kalıcı politika işlemi regresyonu: 17/17 PASS.
- Veritabanı göç zinciri: 71/71 uygulanabilir ve idempotent PASS.
- Tam Vitest: 55 dosya, 333 test PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- Eski Desktop kasası korunmuştur.
- Gerçek veri taşınmamıştır.
- SQLite yazma sahipliği Core Service’e verilmemiştir.
- Cutover otoritesi bağlanmamış ve DEC-171 kaldırılmamıştır.
- Yeni Build verilmemiştir.

Bu kapanış yalnız PPK-006 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
