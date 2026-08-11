# DEC-166 — PPK-002 aile içe aktarma yeni-konum bağlı etkinlik zinciri

## Durum

ACTIVE — 31-F resmî çalışma seçimi.

## Seçim

31-E kullanıcıya görünen sürüm sınırı D: haricî disk makbuzu ve geri-okumasıyla `COMPLETED/PASS` olmuştur. DEC-137 sırası ve 31-D makbuzunda açık bırakılan sınır korunarak, aynı içe aktarma batch’i içinde yeni oluşturulan bir konuma bağlanan etkinliğin atomik politika zinciri 31-F olarak seçilmiştir.

## Dar kapsam

- Yeni konum için exact `location.create`, bağlı etkinlik için exact `event.create` yetkilendirmesi alınır.
- Konum henüz yokken normal mevcut-kaynak okuması yapılmaz. Exact `location.read` yetkilendirmesi, aynı batch’teki exact konum-oluşturma makbuzunun hash’ine bağımlı öngörülü kaynak olarak çözülür.
- Oluşturma, bağımlı okuma ve etkinlik makbuzları aynı SQLite transaction içinde yeniden doğrulanıp kaydedilir.
- Konum oluşturulduktan sonra yetkili repository üzerinden okunur; etkinliğe hedef `locationId`, veritabanındaki yetkili etiket ve bağımlı exact okuma makbuzu hash’i yazılır.
- Commit öncesi tamamlanma çiti, gerçek konum satırının aile, sahip ve oluşturma makbuzu hash’inin bağımlı okuma planıyla tam eşleştiğini doğrular.
- Herhangi bir yetki, makbuz, satır, provenance veya olay yazımı uyuşmazlığında transaction bütünü geri alınır.

## Fail-closed ve kapsam dışı

- Bağımlı okuma isteği önceki ve aynı kaynak kimlikli bir konum-oluşturma isteğine bağlı değilse işlem başlamaz.
- Governed rollback/silme makbuzu, evrensel repository enforcement, obligation execution ve haricî monoton rollback otoritesi bu checkpoint’te tamamlanmaz.

PPK-002 `PARTIAL` kalır. Yeni Build verilmez. 31-F yalnız typecheck, hedefli atomiklik/fail-closed testleri, tam regresyon, platform-policy kapısı ve D: Library makbuzu PASS olduğunda tamamlanır.
