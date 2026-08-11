> **Tarihsel belge:** Bu kayıt aktif kanal politikası değildir. Güncel ve katı politika `PPT-LIFECYCLE-STRICT-V1` ile `docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md` içindedir; bütün ürün geliştirmeleri Bronze’da tamamlanır.

# MVP-40 Code Freeze Politikası

**Sürüm:** 21.07.2026.40  
**Aşama:** MVP-40 — Code Freeze

Bu sürümle Bronze özellik kapsamı dondurulmuştur. Bronze Final RC1 öncesinde yeni özellik, yeni modül veya kapsam genişletmesi yapılmaz.

İzin verilen değişiklikler:

- Veri kaybı, güvenlik açığı veya uygulamanın açılmasını engelleyen kritik hata düzeltmeleri
- Başarısız otomatik test veya derlemeyi düzelten değişiklikler
- Kullanıcı verisini değiştirmeyen belge ve paketleme düzeltmeleri

Her kritik hata düzeltmesi için neden, etkilenen alan, test sonucu ve geri dönüş yöntemi sürüm kaydına eklenir. Sürüm numarası, paket kilidi ve `APP_META` alanları birlikte güncellenmeden paket üretilemez.
