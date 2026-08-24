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

Bu karar `DEC-270/PR-235` exact-commit etki ve test zincirini kaldırmaz; kapsamını bütün kayıt sınıfları ve tüm kullanıcı etkileşimi/görsel bütünlük yüzeyleri için açıkça güçlendirir.
