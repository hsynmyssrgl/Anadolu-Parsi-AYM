# DEC-207 — PPK-026 typed policy SDK ve XPF-003 ortak finans/sağlık policy yolu

Tarih: 2026-08-12
Durum: ACTIVE
Adım: 32-V
Gereksinimler: PPK-026, XPF-003

## Karar

Core Service policy kararlarına erişim iki exact wire metodundan oluşan deterministik generated client üzerinden yapılır. Masaüstü uygulaması ham `PolicyAuthorizationContractResult` veya `PolicyReceiptVerificationContractResult` yorumlayamaz; sonuçların provider biçimine çevrilmesi, imzalı paket gözlemi ve monotonic cluster-fence durumu yalnız `CoreServicePolicySdk` içindedir.

Üretim Desktop kodu `PlatformPolicyEnforcementPoint` nesnesini doğrudan kuramaz. Arşiv, universal API, finans, sağlık, yaşam, konum ve zaman çizelgesi bileşenlerinin tamamı `createTypedPolicyEnforcementPoint` fabrikasını kullanır. Generated client yalnız Core Service application adapter tarafından oluşturulur. Ham wire metodu, ham sonuç tipi, doğrudan PEP kurulumu veya generated client kaçışı pre-typecheck ve pre-build kapısında reddedilir.

## Fail-closed kuralları

- Doğrulanmış health gözlenmeden policy paketi ve cluster fence kullanılamaz.
- Paket doğrulanmamışsa önceki paket ve fence birlikte silinir.
- Fence eksik, bozuk, gerileyen veya aynı epoch içinde değişen ise işlem reddedilir ve güvenilen durum temizlenir.
- Generated client cevabı gereken biçimde değilse uygulama bir varsayım üretmez; durum temizlenir ve işlem reddedilir.
- Generated dosyanın schema çıktısından tek byte sapması build kapısını durdurur.

## XPF-003 kapanışı

Finans ve sağlık için mevcut domain, use-case, repository, IPC, ekran ve menü zincirleri korunmuştur. Her iki üretim runtime'ı aynı Core Service provider'ını, aynı typed factory'yi, aynı PEP obligation/receipt/fence uygulamasını kullanır. Ayrı güvenlik yorumu veya daha zayıf yerel yol kalmamıştır. Mevcut finans ve sağlık runtime regresyon testleri yeni SDK boundary testleriyle birlikte çalıştırılır.

## Kapsam dışı

Bu karar DHA-011'i kapatmaz. HTTPS Client API, WebSocket değişiklik akışı, internal gRPC/protobuf, OpenAPI/Protobuf üretimi, N-1 uyumluluk ve dağıtık typed error modeli ayrı çalışmadır. 32-V yalnız daha sonra kullanılabilecek deterministik typed-client örüntüsünü sağlar.

Yeni migration, repository persistence, kullanıcı verisi taşıma, backfill, cutover veya SQLite/vault sahiplik değişimi yapılmaz; son migration 77 kalır.
