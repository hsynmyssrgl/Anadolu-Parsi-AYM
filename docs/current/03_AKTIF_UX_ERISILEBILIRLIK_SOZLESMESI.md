# Aktif Kullanıcı Deneyimi ve Erişilebilirlik Sözleşmesi

- Varsayılan gövde metni 17 px; kontrol metni 15 px, dipnot 13 px ve mutlak minimum 11 px'tir. Windows metin ölçeği %100–225 ve DPI %100–400 hedeflenir.
- 1280×720–4K, küçük pencere, çoklu monitör ve reflow zorunludur.
- Narrator, Magnifier, ekran klavyesi, yüksek kontrast, forced-colors, tam klavye ve en az 44 px hedefler desteklenir.
- Kolay Okuma, Basit, Genç, İleri Yaş, Düşük Görme ve Bakım Veren görünümleri yetkiyi değiştirmeden sunulur.
- Her ekranda loading/empty/offline/error/retry ve taslak/geri al davranışları bulunur.
- Açık tema sıcak-nötr temeli kullanır. Uygulama açılışı, kimlik/güvenlik ekranları, ana kabuk, yardım yüzeyleri ve Windows kurulum sihirbazı görünür sürüm kanalına göre `config/ui-visual-reference-manifest.json` içindeki exact Bronze, Silver veya Gold yüzey ve gezinme paletini kullanır. Sürüm adı ile palet/kurulum bitmap eşleşmezse paketleme fail-closed durur; renderer başlamadan önceki güvenli varsayılan yalnız mevcut Bronze sürümüdür. Onaylı 512×512 şeffaf sıcak-bronz ParsYuva pars işareti aynı manifestte SHA-256 ile sabittir.
- `DEC-261` gereği kullanıcıya görünen marka `ParsYuva`, ürün adı eksiksiz `ParsYuva Aile Yaşam Merkezi`dir. `AYM` kısaltması güncel kullanıcı yüzeylerinde kullanılamaz; yalnız değiştirilemeyen tarihsel kayıtlar ve yükseltme uyumluluğu gereken teknik kimliklerde güncel marka olmadığı açıkça belirtilerek kalabilir.
- Kaynak kodu ve kontrat testleri gerçek ekran, Narrator, büyütme, taşma ve kullanıcı UAT kanıtı değildir; bunlar Silver öncesi ayrıca PASS olmalıdır.
- Tek aile gelen kutusu, evrensel arama, kişisel ana ekran, favoriler, sessiz saatler ve son senkronizasyon görünürlüğü kabul edilmiştir.
- `DEC-253` ile ilk açılış anlatımı görünür üç adıma bağlanmıştır. Kullanıcı anlatımı durdurabilir, yeniden başlatabilir, yavaşlatabilir veya sessize alabilir; metin her durumda görünür kalır.
- `DEC-256` ile kurulum öncesi karşılama ve hazır sayfaları statiktir. Kurulum boyunca yalnız yerel NSIS dosya kurulum sayfasındaki tek ilerleme çubuğu hareket eder; görünür yüzde aynı yerel ilerleme denetiminden okunur. Dekoratif zamanlayıcı ve simüle kurulum yüzdesi yasaktır.
- Uygulama içi Sesli Yardım Merkezi üst çubuktaki Yardım düğmesiyle veya F1 ile açılır; ayrı rota oluşturmaz. Başlangıç, bulunduğum ekran, gizlilik, erişilebilirlik ve sorun giderme başlıkları Türkçe yerel konuşma senteziyle anlatılır. Ses yoksa yazılı açıklama fail-closed kalır.
- Bu özellik Bronze kaynak geliştirmesidir. Silver; gerçek Windows kurulum ekranı, Türkçe ses kalitesi, Narrator, klavye, büyütme, yüksek kontrast, hareket azaltma ve kullanıcı kabul kanıtlarını üretir; bunlar çalıştırılmadan erişilebilirlik kabulü PASS değildir.
