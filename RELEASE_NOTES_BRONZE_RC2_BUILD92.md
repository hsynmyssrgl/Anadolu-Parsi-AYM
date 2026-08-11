# Panthera pardus tulliana Aile — Bronze RC2 Build 92

## Sürüm
- Uygulama: `24.07.2026.92`
- Paket: `24.7.2026-92`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Zamanlanmış yedek hedeflerinin boş alan ölçümü ve yazılabilirlik testi, hedef `.pptbackup` dosya yolunun oluşturulması, üretilen dosyanın boyut ve SHA-256 geri-okuma doğrulaması ile retention kapsamındaki fiziksel dosya temizliği `FamilyDataStore` içinden çıkarıldı. İşlemler application use-case sınırı üzerinden masaüstü dosya sistemi adaptörüne taşındı.

Tam yedek kapsayıcısının oluşturulması, başarılı/başarısız yedek run kaydının tutulması, hedef başarı veya hata durumunun işaretlenmesi, retention veritabanı kayıtlarının silinmesi ve tanılama kaydı sırası korunmuştur. Hedef listesinde boş alan okunamadığında alanın boş bırakılması davranışı da değişmemiştir.

## Doğrulama kapsamı
Hedef yedek dosya sınırı, DataStore içindeki doğrudan `statfs`, yazma testi, yedek hash geri-okuması ve retention dosya sistemi işlemlerinin kaldırılması, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
