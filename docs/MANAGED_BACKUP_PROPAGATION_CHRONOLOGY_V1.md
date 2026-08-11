# Managed Backup Propagation Chronology V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Yönetilen yedek imha yayılımının başlangıç, hedef karantinası, tombstone tamamlama
ve çalışma tamamlanma zamanlarını gerçek işlem sırasına göre üretmek; işlem
başında önceden oluşturulmuş bir `completedAt` değerinin denetim ve geçmiş
kayıtlarına yazılmasını yasaklamaktır.

## Saat modeli

1. Masaüstü ana süreç, iş başlamadan hemen önce duvar saati `startedAt` ve
   `performance.now()` tabanlı `startedMonotonicMs` değerini birlikte alır.
2. Application use-case yalnız geçen monotonik süreyi başlangıç duvar saatine
   ekleyerek karantina ve tamamlanma zamanlarını üretir.
3. Her hedefin `quarantinedAt` değeri doğrulanmış yeni yedek oluştuktan sonra,
   eski yönetilen kopya taşınmadan hemen önce alınır.
4. `completedAt`, bütün hedef işlemleri tamamlandıktan sonra alınır ve tombstone
   tamamlama güncellemesiyle aynı değer olarak kullanılır.
5. Monotonik saat `NaN`, sonsuz, başlangıçtan küçük veya önceki okumadan gerideyse
   işlem fail-closed hata verir. İlgili karantina ya da tombstone tamamlama adımı
   yürütülmez.

## Güvenlik ve mahremiyet

Kronoloji yalnız operasyon zamanı ve çalışma kimliği taşır; kullanıcı içeriği,
parola, TOTP, yedek sırrı veya dosya içeriği eklemez. Sistem duvar saatindeki ileri
veya geri ayarlamalar, çalışan yayılımın sırasını tersine çeviremez.

## Doğrulama

Bronze kaynak kapısı; sözleşme yayılımı, sentetik monotonik saat davranışı, gerçek
SQLite kalıcılığı ve kontrollü TypeScript/regresyonu çalıştırır. Gerçek Windows
donma/uyku, saat ayarı, uzun disk işlemi ve installer yaşam döngüsü Silver tam test
kampanyasında `NOT_RUN` durumundan çıkarılır.
