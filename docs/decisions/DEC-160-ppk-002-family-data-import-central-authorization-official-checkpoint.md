# DEC-160 — PPK-002 aile veri aktarımı merkezi yetkilendirme resmî checkpoint seçimi

## Durum

ACTIVE — 31-B resmî çalışma seçimi.

## Seçim

31-A timeline-event Policy Enforcement checkpoint’i D: harici USB Library makbuzu ve geri-okumasıyla `COMPLETED/PASS` olmuştur. DEC-137 sırası korunarak, DEC-157 altında uygulanmış aile veri aktarımı merkezi yetkilendirme dilimi 31-B resmî checkpoint’i olarak seçilmiştir.

## Dar kapsam

- Preview ve batch listeleme `read`, apply `create`, rollback `delete` eylemiyle `family_data_import:{familyId}` kaynağında merkezi değerlendirilir.
- Aktif hesap, uygulama actor/membership bağlamı ve aktif nesne izinleri aynı karara bağlanır.
- Explicit deny, rol izninden önce gelir.
- Yetkisiz preview dosya sistemine erişmeden reddedilir.
- Apply/list/rollback transaction içinde yeniden yetkilendirilir.
- Üretim composition account ve object-permission repository’lerini sağlar.

## Kapsam dışı

- Konum ve timeline event import’u için kalıcı multi-receipt batch.
- Governed import rollback receipt ve database direct-write fence.
- Evrensel API/IPC/UI/repository enforcement, obligation execution ve haricî monoton otorite.

PPK-002 `PARTIAL` kalır. Yeni Build verilmez. 31-B yalnız hedefli test, tam regresyon, platform-policy kapısı ve D: Library makbuzu PASS olduğunda tamamlanır.
