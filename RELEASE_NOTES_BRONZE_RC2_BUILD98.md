# Panthera pardus tulliana Aile — Bronze RC2 Build 98

## Sürüm
- Uygulama: `24.07.2026.98`
- Paket: `24.7.2026-98`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Veritabanına bağlı depolama yollarının oluşturulması `FamilyDataStore` içindeki doğrudan `node:path` kullanımından çıkarıldı. Application katmanına `FamilyStorageLayoutPort` ve `ResolveFamilyStorageLayoutUseCase`, masaüstü ana sürece `NodeFamilyStorageLayoutPort` eklendi.

Yeni sınır; veritabanı yolundan cihaz kimliği, arşiv, kasa anahtarı ve geçici arşiv açma yollarını üretir. `deviceIdentityPath` ve `archivePath` seçenekleri verilirse aynen korunur; verilmezse önceki `secrets/device-identity.json`, `archive`, `vault.key` ve `temp-open` dizilimleri kullanılır. Veritabanı runtime'ı ve arşiv kasası aynı çözülmüş yol görünümünü tüketir.

## Doğrulama kapsamı
Application port ve use-case ihracı, Node path adaptörünün klasör düzeni, DataStore bağlantısı, yol geçersiz kılmalarının korunması, DataStore içindeki doğrudan `node:path`/`node:os` importlarının kaldırılması, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
