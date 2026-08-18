# DEC-231 — Hane operasyonları merkezi

## Durum

33-T, EXT-001–EXT-008 için yerel uygulama başlangıcıdır. Domain, migration, repository, merkezi PEP/UoW, masaüstü facade, IPC ve mevcut Yaşam Merkezi ekranına eklenen UI zinciri yerel hedef testlerde çalışır. 33-N bağımlılığı ve aktif 33-P yönetişim zinciri atomik olarak kapanmadığı, registry/roadmap elle ilerletilmediği ve dış/manual kabul kanıtları tamamlanmadığı için gereksinimler PASS sayılmaz; `countsAsRequirementPass=false` korunur.

## Karar

Aile başına tek `household_operations_center` aggregate kullanılır. Sekiz alan ve on üç item kind alışveriş listeleri/atamaları, gıda-temizlik stoğu ve son kullanım, tarif/öğün ve alerjen filtresi, görev/rutin, fatura-abonelik-ortak gider, teslimat, misafir erişim planı ve evcil hayvan bakımını kapsar. Yazımlar optimistic center/item revision, idempotent client operation, state fingerprint ve exact `family.write` / `general` PEP receipt-fence-projection kanıtı gerektirir. Okuma exact aile kapsamlı `family.read` receipt’iyle yapılır.

Alışveriş öğesi etkin listeye, öğün planı etkin tarife bağlanır. Tarif alerjenleri ile öğünün kaçınılan alerjenleri kesişirse işlem reddedilir. Ortak giderde etkin ve aynı ailedeki farklı kişilerin basis point toplamı tam 10.000 olmalıdır. Silme fiziksel değildir; immutable mutation ve current row ilişkisi korunarak soft-delete yapılır.

Eksik iş akışı kaydı oluşturulamaz: gıda stoğu son kullanma tarihi, öğün planı zaman, ev işi/rutin etkin kişi ataması, rutin ve abonelik tekrar bilgisi, fatura/abonelik son ödeme tarihi, evcil hayvan bakım görevi ise zaman gerektirir. Güncelleme bu zorunlu alanları kaldıramaz ve etkin başlangıç-bitiş sırasını tersine çeviremez. IPC aynı semantik matrisi dispatch öncesinde uygular; DataStore entegrasyonu sekiz alanın tamamını tek gerçek SQLite/PEP zincirinde doğrular. Stok son kullanma tarihi renderer listesinde açık etiketle gösterilir.

## Yerel gerçeklik sınırı

Bu paket dış alışveriş siparişi vermez, otomatik stok taraması yapmaz, ödeme çalıştırmaz, taşıyıcı sistemine bağlanmaz, uzaktan anahtar/erişim kontrol etmez ve evcil hayvan bakım hizmeti teslim etmez. Teslimatta yalnız kullanıcı tarafından girilen sağlayıcı etiketi ve son dört karakterlik görünüm ipucu tutulur; tam takip numarası yoktur. Misafir anahtar veya erişim kodu saklanmaz. Alerjen kesişim filtresi tıbbi veya beslenme tavsiyesi değildir.

Migration 98 üç tabloyu ekler: `household_operation_mutations`, `household_operations_centers`, `household_operation_items`. Kanonik checksum `b5a09712e4f9611e928509441005ede824a9fceb516caa3b3d74cf83dc8f4d60` değeridir. PPK-021 güncel ratchet’i 563 dosya / 886 yüzey / `58a90febf9382776c2b1472e6ffd6a645c9a24a4cd69e499a8afc1fff2e72b30`; PPK-022 ratchet’i 563 dosya / 422 yüzey / `dc0234d84a50ff1872f9cde4fb7ab286446b236a69019034055fa938dbb3be1e` değerindedir. Statik manifest runtime yetkisi değildir.

## Fail-honest sınırlar

- Yerel 5 dosya / 22 test ve teknik gate sonuçları gereksinim kapanışı değildir.
- Gerçek aile kullanıcıları, alışveriş/öğün/gider/teslimat/misafir/evcil hayvan senaryoları ile beslenme, finans, erişilebilirlik, gizlilik, hukuk ve güvenlik incelemeleri `NOT_RUN` durumundadır.
- Dış sipariş, ödeme, taşıyıcı, uzaktan erişim ve bakım teslimi `NOT_CONFIGURED` veya `NOT_PERFORMED` durumundadır.
- Saklama süresi, kaynak silme/yedek yayılımı ve fiziksel secure erase kabulü tamamlanmamıştır.
- Registry, roadmap, work plan ve active ledger değiştirilmez; persistent completion receipt üretilmez.

## Sonuç

33-T `PLANNED / LOCAL_IMPLEMENTATION_STARTED` kalır. Yerel bileşim sonraki kapanış adımına hazırdır; dış/manual kanıtlar ve öncül yönetişim kapanışları tamamlanmadan certification veya production acceptance iddiası üretilmez.
