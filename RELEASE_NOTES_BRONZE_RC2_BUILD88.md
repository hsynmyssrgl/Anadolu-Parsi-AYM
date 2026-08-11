# Panthera pardus tulliana Aile — Bronze RC2 Build 88

## Sürüm
- Uygulama: `24.07.2026.88`
- Paket: `24.7.2026-88`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Denetim günlüğünü değiştirilemez tutan SQLite `UPDATE` ve `DELETE` koruma tetikleyicilerinin kurulumu `FamilyDataStore` içindeki doğrudan SQL kodundan çıkarıldı.

Yeni `InstallAuditStorageProtectionUseCase`, `AuditStorageProtectionCommandPort`, masaüstü SQLite adaptörü ve `installSqliteAuditAppendOnlyGuards()` database altyapı yürütücüsü üzerinden çalışıyor. Başlangıç sırası korunmuş; audit zinciri backfill işleminden sonra ve yönetici hesabı güvence altına alınmadan önce koruma tetikleyicileri kurulmaya devam etmektedir. Mevcut `AUDIT-APPEND-ONLY` hata davranışı değiştirilmemiştir.

## Doğrulama kapsamı
Hedef mimari sınır, sürüm sırası, workspace sürüm tutarlılığı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
