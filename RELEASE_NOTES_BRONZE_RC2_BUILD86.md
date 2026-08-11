# Panthera pardus tulliana Aile — Bronze RC2 Build 86

## Sürüm
- Uygulama: `24.07.2026.86`
- Paket: `24.7.2026-86`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Manuel ve otomatik veritabanı bakım işlemlerindeki SQLite `integrity_check`, WAL checkpoint, `ANALYZE` ve `VACUUM` komutları `FamilyDataStore.runMaintenance()` içinden çıkarıldı.

Yeni `RunDatabaseMaintenanceUseCase`, `DatabaseMaintenanceCommandPort`, masaüstü SQLite adaptörü ve `executeSqliteMaintenance()` database altyapı yürütücüsü üzerinden çalışıyor. Bakım geçmişi, başarı/başarısızlık sonucu ve tanılama kaydı davranışları korunmuştur.

## Doğrulama kapsamı
Hedef mimari sınır, sürüm sırası, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
