# DEC-158 — 30-Z harici USB Library makbuzu

- Durum: Kabul edildi
- Tarih: 2026-08-10
- Sürüm: Bronze 04.08.2026.29
- Adım: 30-Z

## Karar

30-Z için kalıcı Library hedefi, `D:` sürücüsündeki `EXTERNAL_USB` ortamıdır. Yetkili hedef:

`D:\AYM_LIBRARY\Panthera pardus tulliana\Anadolu Parsı Aile Yaşam Merkezi\Bronze 04.08.2026.29\checkpoints\30-Z_PPK-002_Location_Policy_Enforcement`

Yetkili ve düzenlenebilir kaynak ağacı `C:\PPT\AYM\06_KOD\app` olarak kalır. Harici makbuz, yalnızca `C:\PPT\AYM\09_ARSIV\KAYNAK_AGACI\checkpoints\30-Z_PPK-002_Location_Policy_Enforcement` altındaki dondurulmuş resmî 30-Z paketine uygulanır.

## Gerekçe

Ana dosyalar daha önce Google Drive konumundan taşınmıştır. Bu nedenle `G:` üzerindeki eski Google Drive yolu aktif kaynak veya yeni 30-Z hedefi olarak aranmayacaktır. Önceki adımlara ait Google Drive makbuzları tarihsel ve değişmez kanıt olarak korunur; yeniden yazılmaz.

## Doğrulama ve sınırlar

- Dondurulmuş paketin 20 dosyası D’ye kopyalanır ve her dosya boyut + SHA-256 ile geri okunur.
- Makbuz, makbuz geri-okuması, kalıcılık kanıtı ve son envanter de D’ye yazılıp tekrar okunur.
- Resmî 30-Z ancak bu zincirin tamamı PASS olduğunda COMPLETED sayılır.
- PPK-002 `PARTIAL` kalır; zaman çizelgesi ve evrensel repository kapsamı tamamlanmış sayılmaz.
- Güncel C kaynak ağacının harici koruma durumu bu dondurulmuş checkpoint makbuzundan ayrıdır ve ayrıca makbuzlanana kadar PENDING kalır.
- Yeni Build verilmez.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
