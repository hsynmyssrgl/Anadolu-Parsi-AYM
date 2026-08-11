# DEC-187 — PPK-006 tam politika yükümlülükleri

## Durum

32-B kapsamında kabul edildi ve tamamlandı. PPK-006 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Politika kararı yalnız `allow` veya `deny` üretmez. İzinli kararlar gerektiğinde `mask_fields`, `local_processing_only`, `no_cache`, `no_export`, `no_ai`, `no_recording`, `watermark` ve `delete_after` yükümlülüklerini taşır. Bu sekiz yükümlülük sabit bir alan sözleşmesiyle yayımlanır ve kararın imzalı parçasıdır.

Özel, sağlık, finans, çocuk, konum, iletişim, biyometrik ve miras sınıfları için koruma yükümlülükleri veri sınıfından deterministik olarak türetilir. Yetkili olmayan okuyucuda istenen alanlar kanonik sırada maskelenir; alan projeksiyonu yoksa tek `*` maskesi kullanılır. Paylaşım filigranı politika sürümü ve correlation kimliğine bağlanır. Saklama yönergesi rıza politikasına veya en sıkı veri sınıfına bağlanır.

PEP, izinli işlem callback’ini açmadan önce kararın bütün yükümlülüklerini çalışma zamanı kontrollerine çevirir. Değer almaması gereken yükümlülüğe değer verilmesi; yinelenen veya sırasız maske alanları; bağlamsız filigran; tanımsız saklama yönergesi varsayılan-ret ile kapanır. `no_export` ile dosya paylaşımı, `no_ai` ile AI işleme, `no_recording` ile kayıt ve yerel olmayan uygulamada `local_processing_only` birlikte kullanılamaz; işlem kalıcılık ve callback öncesinde reddedilir.

Yürütülen yükümlülük listesi, üretilen kontroller, istek hash’i, nonce ve yürütme zamanı SHA-256 `attestationHash` ile bağlanır. Aktif işlem bağlamı bu kanıtı tekrar doğrular. Repository yalnız aktif bağlamdaki aynı yürütme hash’ini kabul eder.

Veritabanı göçü 71, geçmiş satırları değiştirmeden `obligation_execution_hash` sütununu ekler. Yeni makbuzlarda yürütme kanıtı zorunludur. SQLite tetikleyicisi sütun hash’ini kayıt JSON’u, karar yükümlülükleri, yürütülen sıra ve sonuç kontrolleriyle eşleştirir.

Ortak Desktop API PEP’i, ana süreç menü çağrıları ve preload IPC sınırı aynı yükümlülük kontrollerinden geçer. UI görünürlüğü tek başına yetki sayılmaz; asıl uygulama PEP ve Core Service karar sınırındadır.

## Güvenlik ve gerçeklik sınırı

Bu karar gerçek kasa veya aile verisini Core Service’e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Eski Desktop kasası aktif ve yetkilidir.

## Kapanış kanıtı

- `packages/platform-policy/policy-obligation-suite.test.ts`: 15/15 PASS.
- `apps/core-service/tests/platform-policy-obligation-execution.test.ts`: 2/2 PASS.
- `artifacts/validation/32-B-ppk-006-complete-policy-obligation-suite-contract.json`: 32/32 PASS.
- `artifacts/validation/32-B-ppk-006-complete-policy-obligation-suite-runtime.json`: 8/8 PASS.
- Kalıcı repository regresyonu: 17/17 PASS.
- Tam Vitest: 55 dosya, 333 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-006 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
