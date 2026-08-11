# 32-J PPK-014 sürümlü Core Service API üst kapanışı

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Core Service dışındaki üretim kaynaklarında Core Service iç modül, istemci SDK bypass'ı ve doğrudan socket primitive erişimi sıfır istisnalıdır.
- İstek zarfı protokol/API sürümü, istemci uygulama kimliği, imzalı uygulama sürümü, request ID, issued-at, yöntem, kimlik doğrulama belirteci ve payload exact alan kümesiyle doğrulanır.
- Bilinmeyen yöntem, kimlik/sürüm/bağlam uyuşmazlığı, bozuk veya fazladan alan, kesin expiry, gelecek zaman ve replay callback açılmadan reddedilir.
- Bounded tekrar defteri dolduğunda koruma gevşetilmez; istek fail-closed reddedilir.
- İstemci exact yanıt alanlarını, Core Service kimliğini, API/protokol sürümünü, request ID'yi ve kanonik hata kodunu doğrular.
- Desktop başlangıç handshake'i API sınır durumunu exact denetler; tipli IPC/preload ve Sistem menüsü güvenlik duruşunu gösterir.
- Yeni kalıcı durum gerekmediğinden migration eklenmemiştir.

## Çalıştırılmış doğrulamalar

- PPK-014 hedefli politika ve gerçek yerel taşıma testi: 17/17 PASS.
- Core Service dispatcher ile birleşik hedefli regresyon: 20/20 PASS.
- Core Service Local Admin runtime: 50/50 kontrol PASS.
- Desktop Core Service başlangıç runtime: 50/50 kontrol PASS.
- PPK-013 doğrudan veri erişim regresyonu: 20/20 PASS.
- PPK-012 hassas cache ve policy-sensitive IPC no-cache regresyonu: 15/15 PASS.
- Core dışı uygulama kaynak taraması: 1 uygulama alanı / 113 dosya / 0 bulgu; 5/5 kötü niyetli öz-sınama PASS.
- TypeScript: 0 diagnostic.
- Tam Vitest: tek worker ile 63 dosya / 442 test PASS.
- Veritabanı göç zinciri: migration 76 son sürüm; yeni migration yok, 9/9 runtime kontrolü PASS.
- Lockfile: 533 doğrulama / 18 workspace PASS.
- Supply: 435 doğrulama / 135 kanonik dış tarball PASS.
- Workspace: 497 doğrulama / 18 workspace; üretim grafiği döngüsüz PASS.
- Üretim build: 18 workspace paket zinciri, Core Service, Electron main/preload ve renderer PASS.
- Resmî PPK-014 sözleşmesi: 46/46 PASS.
- Resmî PPK-014 runtime demeti: 12/12 PASS.

## Gerçeklik sınırı

- Gerçek veri taşınmamıştır.
- Desktop kasası ve etkin SQLite oturumu korunmuş; SQLite sahipliği Core Service'e aktarılmamıştır.
- Core Service family-data oturumu bağlanmamış, cutover otoritesi eklenmemiş ve DEC-171 kaldırılmamıştır.
- İstemci API'sine kalıcı yol, anahtar veya gizli malzeme eklenmemiştir.
- PPK-012 hassas önbellek/no-cache ve PPK-013 doğrudan veri erişim çitleri gevşetilmemiştir.

Bu kapanış yalnız PPK-014 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır.
