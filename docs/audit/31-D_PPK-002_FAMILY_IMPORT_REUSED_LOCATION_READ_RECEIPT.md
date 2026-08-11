# 31-D — PPK-002 aile içe aktarma mevcut konum okuma makbuzu

## Sonuç sınırı

31-D yalnızca kaynak verideki konumun hedef ailede zaten bulunduğu durumda etkinlik içe aktarmayı kapsar. Etkinlik yazma yetkisi ile tam hedef konuma ait `location.read` yetkisi aynı politika batch’i ve aynı SQLite transaction sınırı içinde kurulur.

## Uygulanan zincir

1. Önizleme, kaynak `locationId` değerini hedef ailedeki mevcut konuma eşler.
2. Yeni oluşturulacak bir konuma bağlı etkinlik `import.event_new_location_policy_chain_required` ile fail-closed kalır.
3. Mevcut konuma bağlı etkinlik için benzersiz `event-location-read:<eventId>` isteği oluşturulur.
4. Etkinlik yazma intent’i konumu `sourceResourceId` olarak taşır.
5. Transaction içinde konum governed repository ile tekrar okunur; aile ve kimlik eşitliği doğrulanır.
6. Tam okuma makbuzunun hash’i etkinlikte `sourceLocationReceiptHash` alanına projekte edilir.

## Doğrulama

- Masaüstü ana süreç TypeScript `--noEmit`
- Hedefli Vitest: 31-D runtime, aile import batch ve konum çapraz-yüzey gizlilik testleri
- Tam Vitest regresyonu
- Platform-policy kapısı: yeni bypass sıfır ve runtime PASS
- D: haricî USB Library üzerinde tam dosya kümesi, boyut ve SHA-256 geri-okuması

## Açık kalan sınırlar

- Yeni oluşturulan konuma bağlı etkinlik import zinciri tamamlanmadı; fail-closed.
- Governed import rollback makbuz çiti tamamlanmadı.
- Evrensel repository enforcement tamamlanmadı.
- Obligation execution çalıştırılmadı ve PASS sayılmadı.
- PPK-002 `PARTIAL` kalır; yeni Build verilmez.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
