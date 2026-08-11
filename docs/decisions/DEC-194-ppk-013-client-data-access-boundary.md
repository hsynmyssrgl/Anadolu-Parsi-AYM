# DEC-194 — PPK-013 istemci veri erişim güvenlik çiti

## Durum

32-I kapsamında kabul edildi ve tamamlandı. PPK-013 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Renderer, preload ve Core Service istemci SDK'sı veri sağlayıcı katman değildir. Bu istemci alanlarında `@ppt/repositories`, repository sözleşmeleri, database/infrastructure uygulamaları, ham SQL, `node:sqlite`, `node:fs` ve Desktop kasa uygulamalarına doğrudan erişim sıfır istisnayla yasaktır. `CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS` boş ve değişmezdir.

İstemci veri işlemleri yalnız kayıtlı uygulama servisi kanalı üzerinden yürür. Desktop'ta bu yol tipli preload sözleşmesi, güvenilir ana-frame doğrulaması, IPC taşıma bağlamı, payload/integration kontrolleri, `ClientDataAccessBoundaryPolicy`, evrensel PEP ve repository policy transaction scope zinciridir. Gelecekteki istemciler için sürümlü Core Service API taşımacılığı modelde izinli olsa da PPK-014 bu kararla tamamlanmaz.

Authenticated yol uygulama, cihaz, hesap, aile, politika sürümü/paketi, capability manifesti, cihaz sertifikası ve aktif authorization context SHA-256 bağını exact karşılaştırır. Kayıtsız kanal, doğrudan yöntem, bağ uyuşmazlığı, kesin expiry ve bozuk/fazladan alanlı veri işlem callback'ini açmadan reddedilir. Bootstrap yalnız mevcut açık kanallarla sınırlıdır ve normal authenticated yol yerine kullanılamaz.

TypeScript sözdizimi fail gate'i renderer, preload ve `@ppt/core-service-client` kaynaklarını her kök typecheck ve üretim build öncesinde tarar. Repository/database/SQLite/filesystem/kasa importu, ham SQL literalı ve SQLite çalışma zamanı sembolü kapıyı düşürür. Kötücül öz-sınamalar kapının yasak örnekleri gerçekten yakaladığını doğrular.

PPK-013 kalıcı durum üretmediğinden yeni tablo veya migration eklenmez. PPK-009 migration 74 ile kalıcılaştırılan Core Service karar otoritesi/receipt bağı ve mevcut migration 76 zinciri yeniden kullanılır.

## Gerçeklik sınırı

Desktop kasası ve aktif bellek içi SQLite oturumu yetkili sağlayıcı alanında kalır. SQLite sahipliği değiştirilmez, gerçek veri taşınmaz, Core Service cutover otoritesi bağlanmaz ve DEC-171 kaldırılmaz. Kalıcı yol veya gizli malzeme istemci API'sine açılmaz. PPK-012 hassas cache kilidi ve policy-sensitive IPC `no-cache` kuralları gevşetilmez.

## Kapanış kanıtı

- İstemci kaynak fail gate'i: 3 alan / 11 dosya / 0 bulgu; 6/6 kötücül öz-sınama PASS.
- Hedefli PPK-013 testi: 20/20 PASS.
- Kapanış sözleşmesi: 36/36 PASS.
- Runtime kapanış demeti: 10/10 PASS.
- PPK-012 hassas cache/no-cache regresyonu: 15/15 PASS.
- Veritabanı göç zinciri: 76/76 PASS; yeni migration yok.
- Tam Vitest: Windows SQLite/receipt izolasyonu için tek worker ile 62 dosya / 425 test PASS.
- Kök TypeScript: 0 diagnostic.
- Üretim paket zinciri, Core Service, Electron main/preload ve Vite renderer: PASS.

Bu kapanış yalnız PPK-013 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
