# DEC-223 — Finans / Uzun Vadeli Portföy merkezi

Durum: Aktif uygulama (33-L)

Tarih: 2026-08-13

## Karar

LTP-001–LTP-008 tek paket içinde uygulanır. Finans menüsü altında ayrı bir **Uzun Vadeli Portföy** bölümü; sürümlü ürün kataloğu, sürümlü aylık katkı/dağılım planı, değişmez işlem defteri, kurumsal işlem takibi, kıymet bazlı sonuçlar, grafikler ve 13 Ağustos 2032 hedefli varsayım senaryoları sunar.

Başlangıç planının düzenlenebilir varsayılanı aylık 20.000 TRY ve dağılımı tam 10.000 baz puandır. 20.000 TRY sabit kıstas, alt/üst sınır veya kalıcı taahhüt değildir; kullanıcı aylık katkıyı geçerlilik ayı olan yeni plan sürümünde pozitif başka bir tutara değiştirebilir ve geçmiş sürümler korunur. Kullanıcının verdiği ASELS, TUPRS, THYAO, KCHOL, BIMAS, AKBNK, EREGL, BETAE, NETCD, TI2, AFT, TTE, KZL, GUF ve PPN dağılımı tek atomik bootstrap işleminde kurulur. Halka arz rezervi uygun ürün seçilene kadar PPN üzerinde ayrı `ipo_reserve` dilimidir.

## Değişmezlik ve süreklilik

- Enstrümanın stable ID değeri kod, ISIN, borsa ve para biriminden ayrıdır. Kod değişimi geçmişi yeniden yazmaz; yeni katalog sürümü ekler.
- Aylık katkı ve oran değişikliği önceki planı güncellemez; geçerlilik ayı olan yeni plan sürümü ekler. Her sürümün dağılımı tam %100'dür.
- Kullanılmayan aylık bakiye aynı enstrümana devreder. Başka enstrümana bütçe taşıma yalnız aynı para birimindeki farklı kaynak/hedefi bağlayan, pozitif tutarlı ve adetsiz tek atomik `transfer_out` kaydıyla mümkündür; bu olay kıymet adedi üretmez, eksiltmez veya saklama virmanı iddia etmez ve kaynak bütçeyi hiçbir aylık pivotta eksiye düşüremez. `transfer_in` yalnız haricî saklama/kıymet girişidir ve kaynak belge/dekont referansı zorunludur.
- Alım/satım ve kurumsal işlemler append-only'dir. Kısmi gerçekleşmeler ayrı satırdır. Hata düzeltme yalnız asıl olaya bağlı tek ters kayıtla yapılır.

## Tarih ve maliyet sözleşmesi

Alım/satım olayları sipariş, gerçekleşme ve takas/valör tarihlerini; yön, adet, fiyat, brüt/net, komisyon, vergi, kur, aracı kurum/hesap, emir/gerçekleşme referansı, lot/maliyet katmanı ve kaynak etiketini taşır. Temettü için hak/kayıt/ödeme; diğer kurumsal işlemler için kendi olay tarihi, oranı ve kaynak referansı tutulur.

## Güvenlik mimarisi

Yeni bağımsız yetki kanalı açılmaz. Mevcut Finans merkezî PEP, işlem-içi otorite yeniden doğrulaması, `CentralAuthorizationService`, transaction executor, durable policy receipt, audit ve outbox aynı UoW içinde yeniden kullanılır. SQLite tabloları aile/kişi kapsamlıdır; bütün iş tablolarında UPDATE/DELETE guard bulunur.

Plan yalnız dağılım satırlarının toplamı tam 10.000 baz puan olduğunda mühürlenip okunabilir. Mutasyonlar aile kapsamında `clientOperationId` ve istek parmak iziyle idempotenttir; aynı istek güvenli tekrar okunur, farklı içerikli tekrar reddedilir. Katalog ve plan zinciri tek doğrusal geçmiş oluşturur; gelecek tarihli kayıtlar bugünün görünümüne sızmaz. Para birimi, kur, tarih/yön/net-tutar aritmetiği ile kıymet adedi ve bütçe zaman çizelgeleri uygulama ve kalıcı veri sınırında fail-closed korunur.

## Doğruluk sınırı

Sistem broker emri veya para hareketi icra etmez; canlı fiyat teslimi, yatırım tavsiyesi, getiri, vergi/hukuk doğruluğu ya da 2032 sonucu garanti etmez. Fiyat ve ürün verileri varsayılan olarak kullanıcı beyanıdır ve `externalVerification=not_performed` taşır. Kötümser/temel/iyimser nominal ve reel çıktılar yalnız düzenlenebilir varsayımlı senaryodur.

## Kapanış ölçütü

Domain, migration-89, repository, application, merkezî PEP/UoW, IPC/preload, Finans alt menüsü, hedefli güvenlik/negatif testler, tam test, typecheck ve build PASS olmadan; persistent receipt, yerel+D: kaynak koruması ve Git/GitHub HEAD eşitliği kanıtlanmadan 33-L tamamlandı sayılamaz.
