# DEC-275 — En küçük değişiklikte tüm kayıt ve test kapanışı

- Tarih: 24.08.2026
- Durum: ACTIVE
- Kural: PR-240
- Görünür sürüm: Bronze 22.08.2026.50

## Karar

En küçük kod, yapılandırma, belge, test veya kanıt üreticisi değişikliği dahi yalnız değişen dosyada bırakılamaz. Etkilenen ana kaynak, Bronze/Silver/Gold kanal kaynakları, kanonik kural ve kullanıcı karar sicilleri, aktif ve ticari belgeler, iş listesi, kapsam, envanter, ratchet, manifest, indeks, güncel ana DOCX/PDF ve kanıt sözleşmeleri aynı mutasyon zincirinde güncellenir. Kanonik etki değerlendirmesi her bağımlı sınıf için `UPDATED` veya somut gerekçeli `NOT_AFFECTED` sonucu üretmeden kapanış yapılamaz.

Byte-exact tarihsel ve değişmez bir kayıt, güncel kaynak değişti diye yeniden yazılacak `dependentRecord` sayılamaz; doğrudan değiştirilmesi bütün ilgili sözleşme ve değişmezlik kapılarını tetiklemeye devam eder. Güncel ratchet, belge ve resmî üretici makbuzları ise bağımlı kayıt olarak Git teslimine girer. Böylece aynı dosyayı hem değiştirme hem de byte-exact koruma zorunluluğu doğuran uygulanamaz kapanış döngülerine izin verilmez.

Her değişiklikte hedefli test, filtresiz tam regresyon, typecheck, değişen MJS/PowerShell sözdizimi ve kaynak bütünlüğü aynı exact commit için PASS olmalıdır. Kullanıcı arayüzüne dokunan değişiklikler dört modül, yirmi iki rota, ana/alt menüler, görünür uygun kontroller, açılan durumlar, erişilebilirlik ve görsel bütünlük kapsamının tamamında kurulu uygulama UAT'ına girer. Yalnız buton saymak yeterli değildir; sonuç, hata ve taşma/örtüşme oracle'ları doğrulanır.

Gerçek test hataları boş `wip(rejected)` checkpoint commit ile tarihçeye yazılır. Tüm kaynak ve kayıt kapanışı bitmeden ara installer üretilemez. Paket yalnız temiz exact committen ve ana kaynak ile ilgili kanal kaynak eşitliği doğrulandıktan sonra oluşturulabilir. Eksik, eski veya gerekçesiz kayıt fail-closed engeldir; waiver yoktur.

FAIL makbuzu; ham çıktı, stack, mutlak dış yol veya sır değeri taşımadan repo-relative test dosyasını ve güvenli test adını kaydeder. Suite yüklenemiyorsa bu durum ayrı bir `SUITE_IMPORT` kimliğiyle görünür olur. Böylece hata ayrıntısı için aynı uzun test turunun ikinci kez çalıştırılması gerekmez; sayaçlar test dosyası, Vitest suite ve assertion anlamları karıştırılmadan raporlanır.

Git tarafından izlenmeyen veya ignore edilen eski bir üretici çıktısı testin kanonik girdisi olamaz. Salt-okunur test, canlı üreticinin yapılandırılmış stdout çıktısını ya da benzersiz geçici hedefini kullanır ve sürüm beklentisini aktif build metasına bağlar. Kanal kanıtında salt-okunur doğrulayıcı yalnız exact Git kökü olduğu doğrulanan `app` veya Bronze/Silver/Gold çalışma kopyasında çalışabilir; çıktı yazan mod ana `app` köküyle sınırlı kalır. Derlenmiş test önkoşulu gerekiyorsa bu hazırlık açık, tekrarlanabilir ve aynı çalışma kopyasına bağlı olmalıdır; eski `.tmp` veya `dist` kalıntısı PASS üretemez.

Canlı güvenlik kapısı tarihsel paket kapsamındaki kopya özete bağlanamaz. PPK-015 gibi güncel ratchet kararları tek kanonik `currentBoundary` kaydından okunur ve canlı rapor; kaynak bölgesi/dosya/özet, kötü amaçlı öz-test, bulgu, yetkili adapter/purpose, yalnız-yerel taşıma ve doğrudan istisna alanlarının tamamında karşılaştırılır. Eski kapsam ve envanter değerleri yalnız paket-zamanı snapshot iç tutarlılığı için korunur; güncel PASS üretmez. Güncel belge kanonik ratchet ile eşzamanlı yenilenir ve değiştirilmiş sayı ya da özet negatif testte reddedilir.

Bağımlı kayıt fiziksel diff taşımıyorsa sahte/no-op değişiklik yapılamaz. Etki değerlendirmesi bu kaydı yalnız baseline diff envanterinde bulunmadığı, güncel SHA-256 değeri okunduğu, `DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED` gerekçesi ve kanıt yolu verildiği zaman `NOT_AFFECTED_WITH_BASELINE_IDENTITY` olarak kabul eder. Değişen kayıt exact `UPDATED` ve kendi yoluyla; değişmeyen kayıt ise assessment, impact-analysis ve güncel dosya readback SHA bağlarının üçü aynıysa kapanır. Eksik kayıt, değiştirilmiş hash veya assessment/analysis ayrışması fail-closed reddedilir.

Bu kararın uygulanmasında gerçek test hataları `5d56bcac`, `a7d50f72`, `925d25d1`, `e42f9b58`, `4894345b`, `88fb84f8`, `447eb103`, `90b0fb0f`, `5490c2b4`, `284545ff` ve `41c16c13` reddedilmiş checkpointleriyle korunmuştur; bunlar PASS veya sürüm kabulü değildir. `284545ff`, resmî ana build ledger üreticisinin çift satır sonu üretmesini `git diff --check` kapısında kaydeder; düzeltme yalnız çıktıya değil kanonik üreticiye uygulanır. `41c16c13`, Bronze exact hedefli regresyonda 596 test geçerken `governed-source-root` ana-kaynak testinin kanal çalışma dizinini ana kaynak sanmasını kaydeder; düzeltme explicit ana kaynak kabulü ile mevcut exact checkout kabulünü ayrı testlere bağlar.

Bu karar `DEC-270/PR-235` exact-commit etki ve test zincirini kaldırmaz; kapsamını bütün kayıt sınıfları ve tüm kullanıcı etkileşimi/görsel bütünlük yüzeyleri için açıkça güçlendirir.
