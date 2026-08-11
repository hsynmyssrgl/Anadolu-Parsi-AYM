# ADR-052 — Sürüm kanalı menü rengi ve aile yakınlık kataloğu

## Durum

Kabul edildi — Build 179.

## Karar

Uygulama menülerinin metin, ikon, hover ve seçili durum renkleri aktif sürüm kanalından türetilir. Bronze bakır/bronz, Silver gümüş, Gold altın erişilebilir renk tokenlarını kullanır. Kanal adı yazılı olarak görünmeye devam eder; renk tek başına anlam taşımaz.

Aile üyesi ekleme ekranındaki serbest yakınlık alanı, domain katmanındaki sürümlü ve aranabilir yakınlık kataloğuyla değiştirilir. Katalog çekirdek aile, üst soy, alt soy, kardeş, geniş aile, evlilik yoluyla aile, vasi/bakım ve özel ilişki sınıflarını kapsar.

Yakınlık, bir referans kişiye göre seçilir. Kişi kaydı ile ileri ve ters yönlü soy ağacı bağlantıları aynı application unit-of-work içinde oluşturulur. Ebeveyn/çocuk ilişkileri tamamlayıcı; eş ve kardeş ilişkileri simetrik; geniş aile ve evlilik yoluyla ilişkiler genel `other` grafik bağıyla korunur. Görünen Türkçe yakınlık etiketi kişi kaydında saklanır.

Eski istemcilerden gelen serbest `relationshipType` alanı geriye uyumluluk için kabul edilmeye devam eder.

## Katı yaşam döngüsü politikası — Build 180

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.
