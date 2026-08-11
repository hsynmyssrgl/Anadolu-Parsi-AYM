# Bronze Database Gate — MVP-43

## Amaç

Bu kapı, REVİZYON-060 / B060-M4 kapsamında SQLite altyapısı ve migration sisteminin geliştirmeyi engelleyecek temel güvenlik koşullarını doğrular.

## Zorunlu koşullar

1. Kullanıcı sürümü `23.07.2026.43`, paket sürümü `23.7.2026-43` olmalıdır.
2. Sürüm sıra defterinde Temmuz 2026 sırası önceki sürümün tam bir fazlası olmalıdır.
3. Masaüstü workspace'i `@ppt/database` paketine bağlı olmalıdır.
4. Eski tek parça `FamilyDataStore.#migrate()` metodu bulunmamalıdır.
5. SQLite bağlantısı ve PRAGMA ayarları merkezi database paketinden uygulanmalıdır.
6. Üç migration dosyasının adı ve checksum değerleri kod kataloğuyla eşleşmelidir.
7. Legacy MVP-40 schema fingerprint değeri açıkça tanımlanmalıdır.
8. Bilinen legacy şema için migration öncesi güvenlik yedeği alınmalıdır.
9. Bilinmeyen şema hiçbir mutation yapılmadan durdurulmalıdır.
10. Uygulama tablosu sayısı 40 olmalıdır.
11. `schema_migrations` ve `database_metadata` altyapı tabloları ayrı sayılmalıdır.
12. Main-process ve preload IPC kanalları 124/124 eşleşmelidir.
13. Migration, foundation, runtime ve data-store doğrulama artifact'leri başarılı olmalıdır.
14. Eski ürün adı, broker entegrasyonu ve açık TODO/FIXME bulunmamalıdır.

## Çalıştırma

```bash
npm run verify:version
npm run verify:migrations
npm run verify:data-store-smoke
npm run verify:electron-main
npm run verify:bronze
```

Kapsamlı Electron/Vite/Vitest ve manuel ekran doğrulamaları Silver aşamasında toplu yapılır.
