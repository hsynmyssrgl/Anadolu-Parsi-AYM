# DEC-193 — PPK-012 sonlu çevrimdışı capability lease ve hassas cache kilidi

## Durum

32-H kapsamında kabul edildi ve tamamlandı. PPK-012 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Çevrimdışı erişim, süresiz veya yalnız kullanıcı arayüzü durumuna dayalı bir izin değildir. Her çevrimdışı capability lease; aile, hedef hesap, cihaz, tek bir platform yeteneği, başlangıç ve kesin bitiş zamanı, politika sürümü/paketi ve uygulama capability manifestiyle bağlanır. Kira süresi en az 60 saniye, en fazla 86.400 saniyedir. Kanonik kira payload'ının SHA-256 özeti saklanır; payload değişikliği, cihaz/hesap/yetenek/politika bağlamı uyuşmazlığı, çevrimiçi kullanım, erken kullanım, kesin bitiş anı ve iptal fail-closed reddedilir.

Kira yalnız çevrimdışı fallback içindir; çevrimiçi policy değerlendirmesinin yerine geçemez. İptal tek yönlüdür ve yeni bütünlük özeti üretir. Kalıcı şema migration 76 ile `offline_capability_leases` tablosunu, kapsam indeksini, kimlik değişmezliği trigger'ını ve tek seferlik iptal trigger'ını ekler. Repository, merkezi yönetim use-case'leri, Desktop adaptörü, tipli IPC/preload sözleşmesi ve Yetkiler menüsündeki yönetim yüzeyi aynı modeli taşır.

Bellek içi `OfflineSensitiveCacheRegistry` varsayılan olarak kilitli başlar. Yalnız yapısal olarak geçerli ve aktif bir kira açabilir; cache girdileri kira SHA-256 kimliğine ve kira bitişine bağlanır. Bitiş, iptal, bağlam uyuşmazlığı veya oturum kapatma tüm hassas girdileri temizler ve yeni geçerli kira etkinleştirilene kadar cache'i kilitli bırakır. Bir cache girdisinin TTL'i kira bitişini aşamaz.

## Gerçeklik sınırı

Bu karar kalıcı hassas payload cache eklemez. Konum taşıyan mevcut politika-hassas IPC kanallarının `no-cache` davranışı korunur; PPK-012 sınırı gelecekteki veya açıkça kira kapsamına alınan bellek içi hassas cache için zorunlu güvenlik kapısıdır. Gerçek aile verisi taşınmamış, SQLite yazma sahipliği Core Service'e verilmemiş, DEC-171 cutover kilidi kaldırılmamış ve yeni Build verilmemiştir.

## Kapanış kanıtı

- Hedefli PPK-012 politika/cache testi: 12/12 PASS.
- DataStore use-case/repository kalıcılık testi: 1/1 PASS.
- Kapanış sözleşmesi: 32/32 PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Veritabanı göç zinciri: 76/76 PASS.
- Tam Vitest: 61 dosya, 405 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-012 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
