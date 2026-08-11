# DEC-161 — PPK-002 aile içe aktarma çoklu politika makbuzu batch checkpoint’i

## Durum

ACTIVE — 31-C resmî çalışma seçimi.

## Seçim

31-B aile veri aktarımı merkezi yetkilendirme checkpoint’i D: harici USB Library makbuzu ve geri-okumasıyla `COMPLETED/PASS` olmuştur. DEC-137 sırası korunarak, 31-B’de ayrı açık sınır olarak bırakılan aile içe aktarma çoklu politika makbuzu batch’i 31-C resmî checkpoint’i olarak seçilmiştir.

## Dar kapsam

- Yeni oluşturulan her içe aktarma konumu için location policy, her konumsuz etkinlik için timeline policy ön yetkilendirmesi alınır.
- Her governed satır benzersiz bir alt correlation kimliği ve kesin create intent’i taşır.
- Bütün makbuzlar aynı SQLite transaction içinde yeniden doğrulanır ve kaydedilir.
- Bütün makbuzlar kurulmadan aile içe aktarma batch’i, satırlar, audit kaydı ve item izleri yazılmaz.
- Konum ve etkinlik repository yazıları yalnız kendi policy-authorized repository context’iyle yapılır.
- Üretim composition ortak batch runner’ı location ve timeline policy runner’larına bağlar.
- Mevcut/reused satırlar yeni create makbuzu üretmez.

## Fail-closed ve kapsam dışı

- `locationId` taşıyan içe aktarma etkinlikleri, yeni içe aktarılmış konum için güvenli source-location read-receipt zinciri tamamlanmadığından reddedilmeye devam eder.
- Governed konumların rollback/silme makbuzu bu checkpoint’te tamamlanmaz.
- Evrensel repository enforcement, obligation execution ve haricî monoton rollback otoritesi kapsam dışıdır.

PPK-002 `PARTIAL` kalır. Yeni Build verilmez. 31-C yalnız typecheck, hedefli test, tam regresyon, platform-policy kapısı ve D: Library makbuzu PASS olduğunda tamamlanır.
