# Panthera pardus tulliana Aile — Bronze RC2 Build 89

## Sürüm
- Uygulama: `24.07.2026.89`
- Paket: `24.7.2026-89`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
SQLite bağlantısının açılması, başlangıç PRAGMA ayarlarının uygulanması, aile veritabanı migration zincirinin yürütülmesi, migration sonucunun üst katmana bildirilmesi, transaction executor kurulması ve bağlantının kapatılması `FamilyDataStore` içinden çıkarıldı.

Yeni `SqliteFamilyDatabaseRuntime` masaüstü altyapı bileşeni veritabanı yaşam döngüsünü tek yerde yönetiyor. `FamilyDataStore` artık hazır database ve transaction executor örneklerini runtime bileşeninden alıyor; normal kapanışta ve tam yedek geri yükleme öncesinde bağlantıyı aynı runtime sınırı üzerinden kapatıyor. Varsayılan WAL, busy timeout ve synchronous ayarları ile migration güvenlik yedeği davranışı korunmuştur.

## Doğrulama kapsamı
Hedef runtime sınırı, DataStore içindeki doğrudan bağlantı yaşam döngüsü kaldırılması, sürüm sırası, workspace sürüm tutarlılığı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
