# Panthera pardus tulliana Aile — Bronze RC2 Build 96

## Sürüm
- Uygulama: `24.07.2026.96`
- Paket: `24.7.2026-96`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Doğrudan SQLite veritabanı dışa aktarımında kullanılan fiziksel dosya kopyalama işlemi `FamilyDataStore` içindeki Node `fs` çağrısından çıkarıldı. Application katmanında `DatabaseExportFilePort` ve `ExportDatabaseFileUseCase`, masaüstü ana süreçte ise `FileSystemDatabaseExportFilePort` eklendi.

Davranış korunmuştur: hedef `.db` uzantısı application use-case tarafından doğrulanır, önce WAL checkpoint uygulanır, ardından veritabanı dosyası hedefe kopyalanır ve yalnızca başarılı kopyalamadan sonra `backup.exported` audit kaydı oluşturulur.

## Doğrulama kapsamı
Hedef dosya sınırı, DataStore içindeki doğrudan `copyFileSync` kullanımının kaldırılması, checkpoint–kopyalama–audit sırasının korunması, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
