# 31-B — PPK-002 aile veri aktarımı merkezî yetkilendirme denetimi

## Sonuç

31-B hedef dilimi yerel doğrulamada PASS olmuştur. Aile veri aktarımı preview ve batch listeleme için `read`, apply için `create`, rollback için `delete` eylemiyle `family_data_import:{familyId}` kaynağında merkezî politika değerlendirmesine bağlanmıştır.

## Doğrulanan sınırlar

- Aktif hesap, actor/membership bağlamı ve aktif nesne izinleri aynı kararda kullanılır.
- Explicit deny rol izninden önce uygulanır.
- Yetkisiz preview dosya sistemi erişiminden önce reddedilir.
- Apply, list ve rollback transaction içinde yeniden yetkilendirilir.
- Üretim composition account ve object-permission repository’lerini sağlar.
- Hedef Vitest 1/1 dosya ve 6/6 test PASS’tir.
- Tam Vitest 28/28 dosya ve 158/158 test PASS’tir.
- Platform Policy Gate PASS; legacy debt 25, yeni bypass 0, runtime 8/8 PASS’tir.

## Açık kapsam

Konum ve timeline event import için kalıcı çoklu-makbuz batch, governed import rollback receipt fence, evrensel repository enforcement, obligation execution ve haricî monoton rollback otoritesi bu dilimde tamamlanmamıştır. PPK-002 `PARTIAL` kalır. Yeni Build verilmez.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
