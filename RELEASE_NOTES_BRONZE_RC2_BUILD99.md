# Panthera pardus tulliana Aile — Bronze RC2 Build 99

## Sürüm
- Uygulama: `25.07.2026.99`
- Paket: `25.7.2026-99`
- Durum: Bronze RC2 aktif geliştirme

## Mimari değişiklikler

### 1. Workspace sürüm bütünlüğü
Tüm workspace paketleri ve bunların internal `@ppt/*` bağımlılık bildirimleri `25.7.2026-99` sürümünde eşleştirildi. `package-lock.json` içindeki workspace kayıtları aynı sürüme çekildi ve `node_modules/@ppt/*` kayıtlarının yerel `apps/*` veya `packages/*` bağlantıları olarak kalması korundu.

### 2. Migration SQL sahipliği
Aile veritabanı şema ve migration SQL tanımları desktop main katmanından `@ppt/database` paketine taşındı. `apps/desktop/src/main/database-migrations.ts` yalnızca geriye dönük uyumluluk re-export'u içerir. `SqliteFamilyDatabaseRuntime`, migration çalıştırıcısını doğrudan `@ppt/database` üzerinden tüketir.

### 3. Repository composition root ve port sınırı
Tüm somut SQLite repository implementasyonları `apps/desktop/src/main/repository-composition-root.ts` içinde tek noktada oluşturulur. `FamilyDataStore` artık repository sınıflarını doğrudan örneklemez. Application adapter dosyaları somut `Sqlite…Repository` sınıflarına değil, `…RepositoryPort` sözleşmelerine type-only import ile bağımlıdır.

## Doğrulama sonucu
Hedefli Build 99 mimari doğrulaması 770 assertion ile geçti. Sürüm sırası doğrulaması geçti. Temiz `npm ci`, dış `esbuild@0.25.12` paketi için paket ağ geçidinin HTTP 503 dönmesi nedeniyle tamamlanmadı. Bu nedenle type-check, production build ve sonraki doğrulamalar çalıştırılmadı.

## Aşama kararı
Bronze RC2 Active Development devam eder. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
