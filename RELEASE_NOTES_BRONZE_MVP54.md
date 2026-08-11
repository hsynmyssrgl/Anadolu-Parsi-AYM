# Panthera pardus tulliana — Bronze MVP-54 Release Notları

**Sürüm:** `23.07.2026.54`  
**Milestone:** `B060-M14 Health Records & Medication Application Migration`

## Eklenenler

- `SqliteHealthRepository`
- Sağlık query portu ve transaction unit-of-work adapter'ı
- Sağlık kaydı listeleme ve oluşturma use-case'leri
- İlaç planı listeleme ve oluşturma use-case'leri
- Aile sağlık geçmişi listeleme ve oluşturma use-case'leri
- Merkezi nesne yetkisine bağlı hassas sağlık erişimi
- Sağlık işlemleri için audit ve transactional outbox olayları
- Migration 9: `health_application_indexes`
- `verify-health-use-cases.mjs` ve 14 senaryoluk doğrulama paketi

## Güvenlik ve yetki davranışı

- Aile yöneticisi sağlık kayıtlarına yönetim politikası kapsamında erişebilir.
- Bağlı kullanıcı yalnızca kendisine ait sağlık nesnelerine sahiplik kapsamında erişebilir.
- Başka bir kişiye ait kayıt için açık nesne izni veya uygun yönetici rolü gerekir.
- `deny` kaydı, sahiplik ve `allow` dâhil bütün olumlu kararlardan önce değerlendirilir.
- Sağlık kaydına verilen ret, ilaç planı gibi farklı nesne türlerine otomatik yayılmaz.
- `family` görünürlük etiketi, hassas sağlık içeriği için tek başına erişim yetkisi oluşturmaz.

## Transaction ve veri bütünlüğü

- Sağlık verisi, audit ve outbox aynı transaction içinde yazılır.
- Eksik kişi, geçersiz ilaç tarih aralığı veya yetki reddinde kısmi kayıt bırakılmaz.
- Sağlık verileri uygulama yeniden başlatıldığında korunur.
- Audit hash zinciri sağlık işlemlerinden sonra geçerli kalır.
- Outbox olayları mevcut dispatcher tarafından yayınlanabilir.

## Değiştirilenler

- Sağlık IPC sözleşmeleri korunarak `FamilyDataStore` içindeki doğrudan SQL erişimi use-case delegasyonuna dönüştürüldü.
- Migration sayısı `8`den `9`a yükseldi.
- IPC sayısı `132` olarak korundu.
- Uygulama/güvenlik tablosu sayısı `42`, altyapı tablosu sayısı `4` olarak korundu.
- Şema fingerprint'i `1792e245001eed0a8e6d293390b9d565adccf2e84f312c82a70280d1ec6ec0c9` olarak korundu; migration 9 yalnızca indeks ekler.
