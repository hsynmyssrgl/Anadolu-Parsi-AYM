# DEC-189 — PPK-008 uygulama kimliği, cihaz sertifikası ve capability manifesti

## Durum

32-D kapsamında kabul edildi ve tamamlandı. PPK-008 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Platformun Windows, Apple, service ve worker sınırları için on dört kanonik `PlatformApplicationId` değeri tek kapalı sözlükte tutulur. Core Service üretim politika paketi bu kimliklerin tamamı için benzersiz bir uygulama manifesti yayımlar. Henüz dağıtılmayan bileşenler `not-deployed` sürümü ve boş capability kümesiyle açıkça kayıtlıdır; dolayısıyla capability verilmeden işlem yapamazlar.

Her uygulama manifesti uygulama kimliğini, uygulama sürümünü, sıralanmış capability listesini ve cihaz sertifikası zorunluluğunu içerir. Bu kanonik payload SHA-256 ile özetlenir ve `capabilityManifestSha256` olarak PPK-007'nin imzalı politika paketine girer. Yinelenen veya sözlük dışı sertifika uygulama kaydı Kernel kurulumunu durdurur.

Cihaz sertifikası, mevcut Ed25519 cihaz kimliğinin güvenilen cihaz deposunda doğrulanmış açık anahtar parmak izinden üretilir. Sertifika cihaz kimliği, uygulama kimliği, capability manifest özeti, düzenleme zamanı ve oturum son kullanma zamanını tek SHA-256 özetiyle bağlar. PEP yalnız trusted authority resolver tarafından sağlanan parmak izi ve güven zamanı üzerinden sertifika üretir. Sertifikanın bütünlüğü, cihaz/uygulama/manifest eşleşmesi ve zaman aralığı yetkilendirmeden önce doğrulanır.

Sertifika tek başına güven üretmez. Güven; üretim resolver'larının hesap güvenlik epoch'unu, aktif trusted-device satırını, açık anahtarı ve parmak izini mevcut cihaz kimliğiyle eşleştirmesinden gelir. Sertifika bu doğrulanmış gerçeği uygulama manifestine bağlar; strict istek, karar, imzalı receipt, aktif işlem bağlamı ve kalıcı receipt record aynı manifest ve sertifika özetini taşır.

Veritabanı göçü 73, tarihsel satırları koruyarak `capability_manifest_sha256` ve `device_certificate_sha256` sütunlarını ekler. Yeni makbuzlarda manifest özeti zorunludur. Sertifika gerektiren üretim uygulamalarında sertifika özeti request, decision, signed receipt ve record boyunca birebir eşleşir. Repository aktif PEP işlem bağlamından farklı bir kimlik bağını yazmayı reddeder.

## Güvenlik ve gerçeklik sınırı

Bu karar gerçek kasa veya aile verisini Core Service'e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. UI gizleme bir güvenlik kararı sayılmaz; bütün erişim mevcut evrensel PEP sınırının arkasında kalır.

## Kapanış kanıtı

- Hedefli PPK-008 testi: 10/10 PASS.
- Platform Policy regresyonu: 88/88 PASS.
- Kapanış sözleşmesi: 34/34 PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Veritabanı göç zinciri: 73/73 PASS.
- Tam Vitest: 57 dosya, 360 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-008 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
