# 32-D PPK-008 uygulama kimliği, cihaz sertifikası ve capability manifesti üst kapanış denetimi

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Windows, Apple, service ve worker bileşenleri için on dört benzersiz kanonik uygulama kimliği kapalı sözlükte doğrulanıyor.
- Her kayıtlı uygulamanın sürümü, sıralanmış capability kümesi ve sertifika kuralı imzalı politika paketindeki SHA-256 manifestine bağlandı.
- Yinelenen veya bilinmeyen uygulama kimliği kaydı Kernel kurulumu sırasında fail-closed reddediliyor.
- Güvenilen cihaz deposunda doğrulanan açık anahtar parmak izi, cihaz kimliği ve oturum ömrü uygulama manifestine bağlı sertifikaya dönüştürülüyor.
- Sertifika bütünlüğü, cihaz, uygulama, manifest ve zaman uyuşmazlıkları işlem başlamadan reddediliyor.
- Strict request, karar, signed receipt, aktif işlem bağlamı ve kalıcı makbuz aynı manifest/sertifika özetini taşıyor.
- Üretim Desktop authority resolver'ları mevcut güvenlik epoch'u ve trusted-device açık anahtar doğrulamasını koruyor.
- Göç 73 iki kimlik sütunu ve exact JSON zincir tetikleyicisini kuruyor; repository farklı bağ yazamıyor.
- UI ve menü erişimleri evrensel PEP sınırının arkasında kalıyor.

## Temiz doğrulama

- PPK-008 kapanış sözleşmesi: 34/34 PASS.
- Hedefli test: 10/10 PASS.
- Platform Policy regresyonu: 88/88 PASS.
- Veritabanı göç zinciri: 73/73 uygulanabilir ve idempotent PASS.
- Tam Vitest: 57 dosya, 360 test PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- Eski Desktop kasası korunmuştur.
- Gerçek veri taşınmamıştır.
- SQLite yazma sahipliği Core Service'e verilmemiştir.
- Cutover otoritesi bağlanmamış ve DEC-171 kaldırılmamıştır.
- Yeni Build verilmemiştir.

Bu kapanış yalnız PPK-008 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
