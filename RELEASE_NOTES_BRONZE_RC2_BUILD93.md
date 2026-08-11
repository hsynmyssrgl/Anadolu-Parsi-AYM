# Panthera pardus tulliana Aile — Bronze RC2 Build 93

## Sürüm
- Uygulama: `24.07.2026.93`
- Paket: `24.7.2026-93`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Tam yedek kapsayıcısının v2 biçiminde oluşturulması, veritabanı, kasa anahtarı ve şifreli arşiv girdilerinin SHA-256 manifestiyle paketlenmesi `FamilyDataStore` içinden çıkarıldı. V1/v2 yedek incelemesi, SQLite başlığı, kasa anahtarı, bileşen hash değerleri ve şifreli arşiv girdilerinin açılabilirlik doğrulaması application portu üzerinden masaüstü dosya sistemi adaptörüne taşındı.

Geri yükleme staging klasörünün hazırlanması, staged veritabanı ve arşiv dosyalarının yazılması, mevcut verilerin `.restore-old` yollarına alınması, atomik dosya değişimi, başarısızlık durumunda rollback ve `restore-required-login.json` işaretinin oluşturulması da aynı sınırın sorumluluğuna verildi.

Mevcut güvenlik sırası korunmuştur: yedek önce incelenir, emniyet yedeği hazırlanır, restore içeriği staging alanına yazılır, staged SQLite dosyası doğrulanır, WAL checkpoint uygulanır, runtime kapatılır, atomik değişim yapılır ve başarılı işlemden sonra oturum temizlenir.

## Doğrulama kapsamı
Hedef tam yedek dosya sınırı, DataStore içindeki doğrudan yedek kapsayıcısı JSON, dosya sistemi, SHA-256, arşiv şifre çözme ve restore rename/rollback işlemlerinin kaldırılması, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
