# 32-A PPK-005 veri sınıflandırma üst kapanış denetimi

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Genel, kişisel, özel, sağlık, finans, çocuk, konum, iletişim, biyometrik ve miras sınıfları ayrı politika değerleri olarak tanımlanmıştır.
- Hassasiyet seviyesi ile iş alanı sınıfı birbirinden ayrılmıştır.
- Çoklu sınıf kümesi tekil ve kanonik sırada imzalı bağlama eklenmiştir.
- Açık `declared` ve deterministik `policy_default` sınıflandırma otoriteleri ayrılmıştır.
- Sağlık, finans, konum ve iletişim verisinin uyumsuz yetenekle işlenmesi reddedilir.
- Çocuk, biyometrik ve miras verisinin ek yükümlülükleri imzalı karar ve PEP yürütmesine bağlanmıştır.
- Core Service, aktif işlem bağlamı ve depo kalıcılığı aynı sınıf kümesini doğrular.
- Göç 70 ve SQLite tetikleyicisi yeni makbuzlarda sınıf kalıcılığını zorunlu kılar.
- Ortak Desktop API PEP’i ve preload IPC üzerinden UI/menü sınırlaması korunmuştur.

## Temiz doğrulama

- PPK-005 kapanış sözleşmesi: 30/30 PASS.
- PPK-005 hedefli test: 24/24 PASS.
- Core Service dispatcher regresyonu: 3/3 PASS.
- Kalıcı politika işlemi regresyonu: 17/17 PASS.
- Veritabanı göç zinciri: 70/70 uygulanabilir ve idempotent PASS.
- Tam Vitest: 54 dosya, 318 test PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- Eski Desktop kasası korunmuştur.
- Gerçek veri taşınmamıştır.
- SQLite yazma sahipliği Core Service’e verilmemiştir.
- Cutover otoritesi bağlanmamış ve DEC-171 kaldırılmamıştır.
- Yeni Build verilmemiştir.

Bu kapanış yalnız PPK-005 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
