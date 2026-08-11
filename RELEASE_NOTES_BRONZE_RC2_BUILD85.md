# Panthera pardus tulliana Aile — Bronze RC2 Build 85

## Sürüm
- Uygulama: `24.07.2026.85`
- Paket: `24.7.2026-85`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Sistem sağlığı görünümündeki SQLite `integrity_check` ve `journal_mode` sorguları `FamilyDataStore.getSystemHealth()` içinden çıkarıldı. Yeni `InspectDatabaseRuntimeHealthUseCase`, `DatabaseRuntimeHealthQueryPort`, masaüstü SQLite adaptörü ve database altyapı denetleyicisi üzerinden çalışıyor.

Mevcut bütünlük sonucu, journal mode değeri, sağlık durumu ve uyarı eşikleri korunmuştur.

## Doğrulama kapsamı
Hedef mimari sınır ve sürüm sırası doğrulandı. Tam workspace TypeScript derlemesi, Electron production build ve kapsamlı testler bu ara geliştirme adımında çalıştırılmadı.
