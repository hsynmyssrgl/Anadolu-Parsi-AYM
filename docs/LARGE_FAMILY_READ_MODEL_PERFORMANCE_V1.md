# Büyük Aile Okuma Modeli Performans Sözleşmesi v1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Build 147; soy ağacı, zaman tüneli ve arşiv ekranlarında veri kümesi büyüdükçe
renderer belleğinin, DOM düğümü sayısının ve SQLite sorgu maliyetinin sınırsız
artmasını engeller. Değişiklik yazma modellerini veya veri sahipliği kurallarını
değiştirmez; yalnız büyük veri okuma yolunu sınırlar ve ölçer.

## Zorunlu sınırlar

- Varsayılan sayfa boyutu 80, kabul edilen aralık 20–200 kayıttır.
- Her sorgu yalnız `limit + 1` kayıt ister; ek kayıt yalnız `hasMore` hesabında
  kullanılır.
- Sayfalama offset kullanmaz. Soy ağacında `(generation, display_name, id)`, zaman
  tünelinde `(start_at, id)`, arşivde `(created_at, id)` anahtarları kullanılır.
- İmleçler görünüm türü ve şema sürümüyle doğrulanır; başka ekranın imleci kabul
  edilmez.
- Arama metni 120, genel filtre metni 160, imleç 512 karakterle sınırlıdır.
- Yetki kontrolü atlanmaz. Repository sonucu, kullanıcıya dönmeden önce olay ve
  arşiv nesnesi okuma izinlerinden geçirilir.
- Renderer başlangıçta tam arşiv listesini veya tüm soy ağacı kartlarını istemez.
  Yalnız yüklenen sayfanın düğümleri çizilir.

## SQLite sıralama ve indeksleri

- Soy ağacı: aile, durum, nesil, büyük/küçük harf duyarsız ad ve kimlik.
- Zaman tüneli: aile, arşiv durumu, başlangıç zamanı ve kimlik; olay türü için ek
  indeks.
- Arşiv: aile, imha durumu, oluşturma zamanı ve kimlik; kategori, hassasiyet ve
  bağlı etkinlik için ek indeksler.
- İlişki sayıları için iki yönlü kişi indeksleri bulunur.
- Etiket ters araması `tag_id, archive_item_id` indeksiyle desteklenir.

## Ölçüm

Her sayfa cevabı dönen kayıt sayısı, repository tarafından taranan kayıt sayısı,
uygulama katmanı sorgu süresi ve uygulanan limit değerini taşır. Bu değerler
kullanıcı arayüzünde tanılama amacıyla gösterilir; geniş UAT ve Windows gerçek
makine performans eşiği Build 149 doğrulama kapısında ölçülür.

## Bilinen sınırlar

Build 147 hedefli SQL testi deneysel Node `node:sqlite` ve bellek içi veri tabanı
kullanır. Üretim `better-sqlite3`, gerçek disk I/O, Electron render frame süresi,
Windows installer ve çok büyük gerçek aile veri seti UAT sonucu değildir.
