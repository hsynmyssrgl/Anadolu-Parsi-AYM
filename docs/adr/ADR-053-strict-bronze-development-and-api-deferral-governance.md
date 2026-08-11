# ADR-053 — Katı Bronze geliştirme ve ağır API erteleme yönetişimi

## Durum

Kabul edildi — Build 180. Politika kimliği: `PPT-LIFECYCLE-STRICT-V1`.

## Bağlam

Bazı eski planlarda ürün özellikleri Silver veya Gold aşamasına bırakılmış,
Silver/Gold ise zaman zaman geliştirme kanalı gibi yorumlanmıştır. Ürün sahibinin
ilk ve bağlayıcı kararı bunun tersidir: ürün geliştirmesi Bronze’da tamamlanır;
Silver doğrulama ve altyapı iyileştirme, Gold ise üretim kanalıdır.

## Karar

1. Silver veya Gold için planlanan bütün ürün geliştirmeleri Bronze kapsamına
   alınır.
2. Yalnız ağır haricî API entegrasyonlarının gerçek üretim adaptörü askıya
   alınabilir.
3. API ertelemesi; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli
   hata ve güvenlik/gizlilik sınırları Bronze kaynakta yoksa geçerli değildir.
4. Silver yeni ürün özelliği kabul etmez; altyapı iyileştirme, hata düzeltme ve
   bütün testleri yürütür.
5. Gold yeni ürün özelliği kabul etmez; başarılı Silver sonrası üretim paketleme,
   imza, operasyon ve kritik düzeltmelerle sınırlıdır.
6. Her karar aktif bilgi ve belgelerin tamamına, Ana Karar Kaydı’na, ADR’ye,
   makine politikasına ve kaynak doğrulama sözleşmesine aynı build içinde yayılır.
7. ADR-052’deki sürüm rengi ve varsayılan aile yakınlık kataloğu kararları bu
   katı politika altında kalıcı ürün sözleşmeleridir.

## Sonuçlar

- Roadmap maddesi Silver/Gold geliştirmesi olarak sınıflandırılamaz.
- API erteleme “altyapı yok” anlamına gelemez.
- Çelişkili aktif belge veya yapılandırma Build doğrulamasını başarısız yapar.
- Tarihsel belgeler kanıt niteliğiyle korunur; güncel davranışta bu ADR ve
  `docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md` üstündür.
