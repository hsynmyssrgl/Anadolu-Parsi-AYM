# DEC-181 — PPK-002 aile içe aktarma governed rollback makbuz çiti

Status: ACTIVE

## Karar

31-S tamamlanmış kaynak ve makbuz zincirinden sonra PPK-002’nin daha önce DEC-167 altında seçilip DEC-168 ana-yapı önceliği nedeniyle ertelenen rollback/silme dilimi, 31-T olarak yeniden yetkilendirilmiştir.

## Bağlayıcı sınır

- Yalnızca exact import batch tarafından `created` olarak izlenen governed etkinlik ve konumlar kapsamdadır.
- Her governed satır için üretim politika motorundan fresh ve exact `delete` + `family.write` makbuzu alınır.
- Import batch üyeliği, ilk create makbuzu, aile, sahip, delete makbuzu, canlı SQLite fence’i ve journal projection doğrudan veritabanınca doğrulanır.
- Delete yetkisi immutable ve tek kullanımlı tombstone ile tüketilir.
- Tüm created satırlar silinmeden ve governed tombstone’lar tüketilmeden batch `rolled_back` durumuna geçemez.
- Eksik, sahte, kopya, başka kaynağa ait veya yeniden kullanılan makbuz bütün transaction’ı fail-closed geri alır.
- Pre-66 null-receipt konum ve pre-67 null-receipt etkinlik uyumluluğu korunur.

## Açık sınırlar

Bu karar PPK-002’nin evrensel repository enforcement ve obligation execution kapsamlarını tamamlamaz. Haricî monoton rollback otoritesi kurulmuş sayılmaz. PPK-002 bu dar dilim sonrasında da `PARTIAL` kalır; yeni Build verilmez.
