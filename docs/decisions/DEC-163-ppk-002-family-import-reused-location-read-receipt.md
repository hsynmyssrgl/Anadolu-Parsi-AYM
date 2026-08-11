# DEC-163 — PPK-002 aile içe aktarma mevcut-konum okuma makbuzu

## Durum

ACTIVE — 31-D resmî çalışma seçimi.

## Seçim

31-C aile içe aktarma çoklu politika makbuzu batch checkpoint’i D: haricî USB Library makbuzu ve geri-okumasıyla `COMPLETED/PASS` olmuştur. DEC-137 sırası korunarak, 31-C’de açık bırakılan `locationId` taşıyan içe aktarılmış etkinliklerin kaynak-konum okuma makbuzu zinciri 31-D olarak seçilmiştir.

## Dar kapsam

- Kaynak etkinliğin `locationId` alanı aynı içe aktarma belgesindeki bir konuma bağlanır.
- Yalnız mevcut veritabanı konumuyla eşleşip `reused` olan kaynak konumlar bu dilimde desteklenir.
- Her oluşturulan konum-bağlı etkinlik için benzersiz correlation kimlikli exact `location.read` ve event `family.write` yetkilendirmesi alınır.
- Exact konum okuma makbuzu ile etkinlik yazma makbuzu aynı SQLite transaction içinde yeniden doğrulanır ve kaydedilir.
- Konum yetkili repository üzerinden tekrar okunur; etkinliğe hedef `locationId`, yetkili konum etiketi ve exact kaynak-konum receipt hash’i yazılır.
- Ön izleme ile apply arasında hedef konum/eşleme değişirse digest uyuşmazlığı işlemi fail-closed durdurur.

## Fail-closed ve kapsam dışı

- Aynı batch içinde yeni oluşturulacak konuma bağlanan etkinlikler desteklenmez; konum politika çözümlemesi öncesinde mevcut olmadığı için ayrı bir ardıl dilimde kalır.
- Governed rollback/silme makbuzu, evrensel repository enforcement, obligation execution ve haricî monoton rollback otoritesi bu checkpoint’te tamamlanmaz.

PPK-002 `PARTIAL` kalır. Yeni Build verilmez. 31-D yalnız typecheck, hedefli test, tam regresyon, platform-policy kapısı ve D: Library makbuzu PASS olduğunda tamamlanır.
