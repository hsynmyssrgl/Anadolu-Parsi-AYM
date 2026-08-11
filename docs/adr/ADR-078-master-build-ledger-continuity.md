# ADR-078 — Ana Build Defteri ve Sohbetten Bağımsız Süreklilik

## Durum

Kabul edildi — Build 205.

## Bağlam

Proje 20 Temmuz 2026’dan itibaren yüzlerce build üretmiştir. Yeni bir sohbette son durumun eski konuşmalardan ve dağınık build belgelerinden yeniden araştırılması zaman kaybı ve yanlış başlangıç riski oluşturmuştur.

## Karar

- Bütün build geçmişi ve kalan işler tek yetkili ana defterde tutulur.
- Makine kaynağı `config/master-build-ledger.json`, okunabilir görünüm `docs/17_MASTER_BUILD_LEDGER.md` dosyasıdır.
- Her sürüm yükseltmesi yeni buildi ana defterde `IN_PROGRESS` olarak açar.
- Her build sonunda yapılan iş, kanıtlar, kalan iş durumu ve kullanıcıya verilen durum bildirimi kaydedilir.
- Güncel build `COMPLETED` değilse veya durum bildirimi yoksa kaynak teslimi yapılamaz.
- Geçmiş tamamlanmış build kayıtları değiştirilemez.
- Yeni sohbet veya geliştirme oturumu `docs/17_MASTER_BUILD_LEDGER.md` dosyasından başlar.

## Sonuçlar

Projenin nerede kaldığı tek dosyadan anlaşılır; dağınık geçmiş araştırması normal devam akışından çıkarılır. Ana defterin güncelliği kaynak doğrulama kapısının parçası hâline gelir.
