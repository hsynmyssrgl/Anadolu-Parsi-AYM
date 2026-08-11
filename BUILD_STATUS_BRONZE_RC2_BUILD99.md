# Build 99 Status

- Channel: Bronze
- Phase: RC2 Active Development
- RC2 Final: No
- Code Freeze: No
- Silver: No
- Gold: No
- Application Version: `25.07.2026.99`
- Package Version: `25.7.2026-99`
- Target: Workspace dependency alignment, database migration ownership and repository composition root

## Tamamlanan mimari düzeltmeler

1. Tüm internal `@ppt/*` bağımlılıkları aktif workspace sürümü `25.7.2026-99` ile eşleştirildi.
2. Aile migration SQL sahipliği `packages/database/src/family-database-migrations.ts` dosyasına taşındı; desktop katmanında ham SQL bırakılmadı.
3. Somut SQLite repository sınıfları yalnızca `repository-composition-root.ts` içinde oluşturuluyor.
4. Application adapter bağımlılıkları somut `Sqlite…Repository` tiplerinden `…RepositoryPort` tiplerine çevrildi.
5. `FamilyDataStore`, repository örneklerini doğrudan oluşturmuyor; composition root çıktısını tüketiyor.

## Gerçekten yapılan doğrulamalar

- `node scripts/verify-build99-architecture.mjs`: **PASS** — 770 hedefli assertion.
- `node scripts/verify-version-sequence.mjs`: **PASS** — `25.07.2026.99`, Temmuz 2026 sıra 99.
- Temiz klasörde `npm ci --no-audit --no-fund`: **PASS DEĞİL / TAMAMLANMADI** — ilk dış bağımlılık `esbuild@0.25.12` indirilirken paket ağ geçidi HTTP 503 döndürdü; komut süre sınırında sonlandırıldı. Internal `@ppt/*` registry çözümleme isteği gözlenmedi.

## Çalıştırılmayan doğrulamalar

Temiz `npm ci` tamamlanmadığı için sıralı doğrulama zinciri durduruldu. Aşağıdakiler çalıştırılmadı ve PASS değildir:

- Tam workspace compile
- `tsc --noEmit`
- Electron production build
- Smoke testleri
- Windows gerçek açılış testi
- Installer doğrulaması
- Güncel ekran görüntüsü üretimi
- Son kullanıcı dokümantasyonu
