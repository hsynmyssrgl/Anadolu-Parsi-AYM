# DEC-188 — PPK-007 imzalı ve sürümlü politika paketi

## Durum

32-C kapsamında kabul edildi ve tamamlandı. PPK-007 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Platform Policy Kernel, politika sürümünü, uygulama sürümlerini, uygulama capability manifestlerini ve karar kurallarını tek bir kanonik `PlatformPolicyPackagePayload` içinde yayımlar. Paket sürümü pozitif tam sayıdır. Kanonik payload SHA-256 ile özetlenir ve politika anahtarıyla, alan ayrımlı HMAC-SHA-256 imzası üretilir. Kernel oluşurken paket kendi imzasını ve özetini doğrulayamıyorsa çalışma başlamaz.

Her strict politika isteği `policyPackageVersion`, `policyPackageSha256` ve `subject.applicationVersion` taşır. Bu alanlar tam yetkilendirme bağlamı hash’ine girer. Kernel paket sürümü, paket özeti veya uygulama sürümü uyuşmadığında sırasıyla `POLICY_PACKAGE_VERSION_MISMATCH`, `POLICY_PACKAGE_HASH_MISMATCH` veya `APPLICATION_VERSION_MISMATCH` ile varsayılan-ret kararı verir.

Karar ve imzalı receipt aynı paket sürümü, SHA-256 özeti ve uygulama sürümünü taşır. PEP, yerel kernel paketini doğrudan; süreç dışı Core Service paketini trusted provider metadata sınırından çözer. İstek, karar ve receipt aynı bağa sahip değilse makbuz kalıcılaştırılmadan ve işlem callback’i açılmadan çalışma reddedilir. Sağlayıcı paket metadata’sı yoksa yetki `AUTHORITY_INVALID` ile fail-closed kapanır.

Core Service sağlık sözleşmesi imzalı paketi yayımlar. Core Service kendi uygulama API sürümünün paket manifestiyle eşleşmesini kurulum anında zorunlu kılar. Desktop başlangıç bağlantısı payload SHA-256 bütünlüğünü, imza biçimini, politika sürümünü ve hem Desktop hem Core Service uygulama sürümlerini doğrular; uyuşmazlıkta uygulama güvenli biçimde başlamaz.

Veritabanı göçü 72, tarihsel satırları koruyarak `policy_package_version`, `policy_package_sha256` ve `application_version` sütunlarını ekler. Yeni makbuz tetikleyicisi bu sütunları receipt record, strict request, karar ve imzalı receipt kararıyla birebir eşleştirir. Repository aktif işlem bağlamındaki aynı üç değeri kalıcılaştırır ve drift’i reddeder.

## Güvenlik ve gerçeklik sınırı

Bu karar gerçek kasa veya aile verisini Core Service’e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Eski Desktop kasası aktif ve yetkilidir.

## Kapanış kanıtı

- `packages/platform-policy/policy-package-version-binding.test.ts`: 17/17 PASS.
- Platform Policy regresyonu: 78/78 PASS.
- `artifacts/validation/32-C-ppk-007-signed-versioned-policy-package-contract.json`: 32/32 PASS.
- `artifacts/validation/32-C-ppk-007-signed-versioned-policy-package-runtime.json`: 8/8 PASS.
- Veritabanı göç zinciri: 72/72 PASS.
- Tam Vitest: 56 dosya, 350 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-007 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
