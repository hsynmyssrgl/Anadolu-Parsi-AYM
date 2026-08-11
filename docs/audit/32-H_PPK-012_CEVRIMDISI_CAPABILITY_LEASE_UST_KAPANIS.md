# 32-H PPK-012 çevrimdışı capability lease üst kapanışı

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Çevrimdışı lease; aile, hesap, cihaz, capability, zaman aralığı, politika paketi ve capability manifestine bağlanır.
- Kira 60 saniye–24 saat aralığında sonludur ve kesin bitiş anında geçersizdir.
- Kanonik SHA-256 bütünlüğü payload değişikliğini fail-closed durdurur.
- Çevrimiçi kullanım, erken kullanım, iptal ve tüm bağlam uyuşmazlıkları reddedilir.
- Migration 76 kalıcı tablo, indeks, değişmez kimlik ve tek yönlü iptal trigger'larını kurar.
- Repository ve merkezi yönetim use-case'leri gerçek SQLite yolunda kira üretme, listeleme ve iptali uygular.
- Tipli IPC/preload yolları ve Yetkiler menüsü kira/kilit durumunu gösterir.
- Hassas bellek cache'i varsayılan kilitli başlar; bitiş, iptal, uyuşmazlık ve logout tüm girdileri temizleyip kilitler.
- Cache TTL'i hiçbir zaman kira bitişini aşamaz.

## Temiz doğrulama

- PPK-012 kapanış sözleşmesi: 32/32 PASS.
- Hedefli politika/cache testi: 12/12 PASS.
- DataStore use-case/repository runtime: 1/1 PASS.
- Veritabanı göç zinciri: 76/76 PASS.
- Tam Vitest: 61 dosya / 405 test PASS.
- Kök TypeScript: 0 diagnostic.
- Bronze güncel denetimi: `PASS_WITH_OPEN_SCOPE`.

## Gerçeklik sınırı

- Kalıcı hassas payload cache eklenmemiştir.
- Konum taşıyan mevcut no-cache IPC kanalları gevşetilmemiştir.
- Eski Desktop kasası korunmuştur; gerçek veri ve SQLite yazma sahipliği Core Service'e taşınmamıştır.
- Cutover otoritesi bağlanmamış, DEC-171 kaldırılmamış ve yeni Build verilmemiştir.

Bu kapanış yalnız PPK-012 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
