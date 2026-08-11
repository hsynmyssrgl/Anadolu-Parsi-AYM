# Panthera pardus tulliana Aile — Bronze RC2 Build 90

## Sürüm
- Uygulama: `24.07.2026.90`
- Paket: `24.7.2026-90`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Arşiv dosyalarının kaynak konumdan okunması, SHA-256 özetinin üretilmesi, dijital kasa anahtarıyla şifrelenmesi ve `.vault` dosyasına yazılması `FamilyDataStore` içinden çıkarıldı. Arşiv açma sırasında şifre çözme, beklenen SHA-256 ile bütünlük doğrulama ve geçici dosya oluşturma işlemleri de aynı application portu üzerinden masaüstü dosya sistemi adaptörüne taşındı.

Retention politikasıyla tetiklenen normal veya güvenli dosya silme işlemi artık `DestroyArchiveFileUseCase` üzerinden yürütülüyor. Veritabanı metadata kaydı, yetkilendirme, audit, outbox, açılma kaydı ve imha işaretleme sırası korunmuştur. Metadata importu başarısız olduğunda oluşturulan kasa dosyasının geri alınması davranışı da korunmaktadır.

## Doğrulama kapsamı
Hedef arşiv kasa dosya sınırı, DataStore içindeki doğrudan arşiv şifreleme/açma/silme kodunun kaldırılması, sürüm sırası, workspace sürüm tutarlılığı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
