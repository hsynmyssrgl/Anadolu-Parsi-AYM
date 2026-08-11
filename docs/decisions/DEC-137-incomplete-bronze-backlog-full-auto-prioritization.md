# DEC-137 — Eksik Bronze Kapsamının Tam Otomatik Önceliklendirilmesi

## Durum

Kullanıcının 06.08.2026 tarihli açık talimatıyla kabul edildi ve 30-M başlangıç otoritesidir.

## Karar

`config/accepted-scope-registry.json` içindeki tamamlanmamış Bronze gereksinimleri resmî yürütme havuzudur. Başlanmış fakat tamamlanmamış işler önce, ardından hiç uygulanmamış işler ele alınır. Aynı grupta P0, P1 ve P2 önceliği; bağımlılık açma etkisi; güvenlik, gizlilik ve veri bütünlüğü etkisi; son olarak sicil sırası kullanılır.

Harici donanım, ağ veya kullanıcı etkileşimi bekleyen bir gereksinim açık ve dürüst durumda korunur; runnable sırayı bloke etmez ve çalıştırılmayan kanıt PASS sayılmaz. B2-01 gerçek Windows Hello doğrulaması bu nedenle `PARTIAL` ve `NOT_RUN_NOT_PASS` kalır.

İlk uygulanabilir iş, aktif Bronze yol haritasında merkezi politika çekirdeği ve policy receipt sınırının diğer güvenlik işlerini açması nedeniyle PPK-002 olarak seçilmiştir. 30-M, merkezi Policy Enforcement Point ile transaction/repository policy receipt temelini fail-closed kurar. Yalnız kanıtlanan zincir alanları ilerletilir.

Her teslimin kalıcı receipt ve geri okuma zinciri PASS olmadan sonraki işe geçilmez. Aynı anda yalnız bir resmî iş yürütülür. Silver ve Gold yasakları değişmez.

## Sohbet kapasitesi kararı

Kullanıcının ayrıca tanımladığı yüzde 95 kredi eşiğinde durma kuralı iptal edilmiştir. Projenin kanonik PR-172 kuralı bu kararla değiştirilmez: yalnız platformun sağladığı gerçek kapasite metriği kanonik uyarı veya hard-stop üretebilir; metrik yoksa `UNAVAILABLE` yazılır ve sayı uydurulmaz.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
