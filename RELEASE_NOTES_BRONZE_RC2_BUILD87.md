# Panthera pardus tulliana Aile — Bronze RC2 Build 87

## Sürüm
- Uygulama: `24.07.2026.87`
- Paket: `24.7.2026-87`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Tam yedek, geri yükleme ve doğrudan `.db` dışa aktarma akışlarındaki SQLite WAL checkpoint komutları ile sahnelenmiş geri yükleme veritabanının `integrity_check` doğrulaması `FamilyDataStore` içinden çıkarıldı.

Yeni `PrepareBackupDatabaseUseCase`, `VerifyBackupDatabaseIntegrityUseCase`, `BackupDatabaseSafetyPort`, masaüstü SQLite adaptörü ve database altyapı güvenlik yürütücüleri üzerinden çalışıyor. Yedek kapsayıcısı, SHA-256 manifest kontrolleri, güvenli arşiv doğrulaması, geri yükleme öncesi emniyet yedeği ve hata halinde geri alma davranışları korunmuştur.

## Doğrulama kapsamı
Hedef mimari sınır, sürüm sırası, workspace sürüm tutarlılığı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
