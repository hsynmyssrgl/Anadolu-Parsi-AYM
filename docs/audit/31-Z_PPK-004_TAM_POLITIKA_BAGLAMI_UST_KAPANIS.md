# 31-Z PPK-004 tam politika bağlamı üst kapanış denetimi

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Hesap/kişi, cihaz, uygulama, rol, aile, hane, aile dalı, veri sahibi, amaç, zaman, eylem ve yetenek tek kanonik bağlamda birleştirilmiştir.
- Sıkı politika yolu boş rolü, eksik aile kapsamını, eksik amaç/korelasyonu, eksik hane/dal dizilerini ve yinelenen kapsam kimliklerini varsayılan-ret ile kapatır.
- SHA-256 bağlam kimliği karara, imzalı makbuza, aktif işlem bağlamına, depo kaydına ve SQLite sütununa aynı değerle bağlanır.
- Sağlayıcının etkili istek dışındaki bir bağlam kimliği döndürmesi işlemi açmadan reddedilir.
- Core Service politika API’si eksik veya legacy bağlamı kabul etmez.
- Göç 69, geçmiş satırları koruyarak yeni makbuzlarda kalıcı bağlam kimliğini ve tetikleyici doğrulamasını zorunlu kılar.
- Ortak Desktop API PEP’i, üretim repository kapsam kapısı ve preload IPC üzerinden UI/menü sınırlaması korunmuştur.

## Temiz doğrulama

- PPK-004 kapanış sözleşmesi: 28/28 PASS.
- PPK-004 hedefli test: 13/13 PASS.
- Core Service dispatcher regresyonu: 3/3 PASS.
- Kalıcı politika işlemi regresyonu: 17/17 PASS.
- Veritabanı göç zinciri: 69/69 uygulanabilir ve idempotent PASS.
- Tam Vitest: 53 dosya, 294 test PASS.
- Runtime kapanış demeti: 7/7 PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- Eski Desktop kasası korunmuştur.
- Gerçek veri taşınmamıştır.
- SQLite yazma sahipliği Core Service’e verilmemiştir.
- Cutover otoritesi bağlanmamış ve DEC-171 kaldırılmamıştır.
- Yeni Build verilmemiştir.

Bu kapanış yalnız PPK-004 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
