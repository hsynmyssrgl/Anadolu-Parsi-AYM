# DEC-167 — PPK-002 aile içe aktarma governed rollback makbuz çiti

## Durum

ACTIVE — 31-G resmî çalışma seçimi.

## Seçim

31-F, aynı import batch'inde oluşturulan konum ile ona bağlı etkinliğin exact create/read receipt zincirini D: makbuzuyla `COMPLETED/PASS` kapattı. DEC-137 sırası ve 31-F makbuzunda açık bırakılan sınır uyarınca sıradaki dar dilim, yalnız bu batch'in oluşturduğu governed etkinlik ve konumların güvenli geri alınmasıdır.

## Dar kapsam

- Rollback öncesinde batch, süre, aile ve dış referans kontrolleri korunur.
- Governed her etkinlik ve konum için exact `delete` + `family.write` politika niyeti ayrı ayrı yetkilendirilir.
- Bütün delete makbuzları, rollback mutasyonları, batch durum geçişi ve audit kaydı aynı SQLite transaction içinde yeniden doğrulanır ve kaydedilir.
- SQLite, her governed silme için batch üyeliğini, ilk create makbuzunu, aileyi, sahibi, exact delete makbuzunu, canlı fence'i ve journal projection'ını doğrudan doğrular.
- Silme yetkisi kalıcı bir tombstone kaydında bir kez tüketilir; eksik, kopya, yanlış kaynaklı veya yeniden kullanılmış makbuz fail-closed reddedilir.
- Commit öncesi tamamlanma çiti hedef etkinlik ve konum satırlarının gerçekten silindiğini doğrular; herhangi bir uyumsuzluk tüm rollback transaction'ını geri alır.
- Pre-66 null-receipt tarihsel konum rollback davranışı korunur.

## Kapsam dışı

Genel kullanıcı silme akışları, bütün repository yüzeylerinin evrensel enforcement'ı, obligation execution ve haricî monoton rollback otoritesi bu checkpoint ile tamamlanmaz. PPK-002 `PARTIAL` kalır ve yeni Build verilmez.

