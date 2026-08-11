# DEC-186 — PPK-005 tam ve çoklu veri sınıflandırması

## Durum

32-A kapsamında kabul edildi ve tamamlandı. PPK-005 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Hassasiyet derecesi ile veri sınıfı birbirinden ayrılır. `public`, `internal`, `personal`, `sensitive` ve `highly_sensitive` değerleri koruma seviyesini; `general`, `personal`, `special`, `health`, `finance`, `child`, `location`, `communication`, `biometric` ve `legacy` değerleri verinin iş alanı sınıfını belirtir.

Bir kaynak birden fazla veri sınıfı taşıyabilir. Örneğin çocuk sağlık kaydı `health + child`, biyometrik sağlık kaydı `health + biometric` olarak korunur. Sınıf kümesi tekilleştirilir ve sabit kanonik sıraya alınır; eksik, yinelenen, desteklenmeyen veya kanonik olmayan sıkı istekler varsayılan-ret ile kapanır.

Kaynak çözücü sınıfları açıkça bildirirse otorite `declared` olur. Eski kaynak çözücüler sınıf bildirmiyorsa PEP, yetenek ve kaynak türüne dayalı kapalı ve deterministik `policy_default` sınıflandırması yapar. Sağlık, finans, konum ve iletişim sınıfları uyumsuz yetenekle kullanılamaz ve `DATA_CLASS_CAPABILITY_MISMATCH` ile reddedilir.

Çocuk verisi imzalı `no_ai` ve `no_export`; biyometrik veri `local_processing_only`, `no_cache`, `no_clipboard`, `no_export` ve `no_ai`; miras verisi `no_export` yükümlülüğü üretir. Özel sınıfların tamamı yüksek ayrıntılı denetime bağlanır. Bu yükümlülükler karar ve makbuz içinde imzalanır, PEP tarafından işlemden önce yürütülür.

Veri sınıfları PPK-004 bağlam özetinin parçasıdır; dolayısıyla sınıf değişikliği `contextHash`, karar ve imzalı makbuzu değiştirir. Aktif işlem bağlamı, kalıcı makbuz kaydı ve depo yürütme sınırı aynı kanonik sınıf kümesini doğrular. Core Service `policy.authorize` ve `policy.verify` uçları sınıfsız sıkı bağlam kabul etmez.

Veritabanı göçü 70, geçmiş satırları değiştirmeden `data_classes_json` sütununu ekler. Yeni makbuzlarda sınıf kümesi zorunludur. SQLite tetikleyicisi desteklenen değerleri, tekilliği ve kayıt/istek eşleşmesini doğrular.

## Güvenlik ve gerçeklik sınırı

Bu karar gerçek kasa veya aile verisini Core Service’e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Eski Desktop kasası aktif ve yetkilidir.

## Kapanış kanıtı

- `packages/platform-policy/policy-data-classification.test.ts`: 24/24 PASS.
- `artifacts/validation/32-A-ppk-005-complete-data-classification-contract.json`: 30/30 PASS.
- `artifacts/validation/32-A-ppk-005-complete-data-classification-runtime.json`: 8/8 PASS.
- Tam Vitest: 54 dosya, 318 test PASS.
- Kök TypeScript: 0 diagnostic.
- `docs/audit/32-A_PPK-005_VERI_SINIFLANDIRMA_UST_KAPANIS.md`: üst kapanış denetimi.

Bu kapanış yalnız PPK-005 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
