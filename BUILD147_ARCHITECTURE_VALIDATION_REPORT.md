# Build 147 Mimari Doğrulama Raporu

## Kapsam

- Büyük soy ağacı, zaman tüneli ve arşiv için ayrı read-model repository portu
- Kararlı anahtar tabanlı sayfalama ve görünüm türü doğrulanan imleçler
- 20–200 kayıt sayfa sınırı ve `limit + 1` has-more tespiti
- Arama/filtre uzunluk sınırları
- Olay ve arşiv kayıtlarında nesne izin filtresi
- Renderer’da sınırlı kart/satır çizimi ve kullanıcı kontrollü sonraki sayfa
- Tam arşiv listesinin başlangıç yükünden çıkarılması
- Migration 25 SQLite performans indeksleri

## Mimari sonuç

Yazma modeli ve mevcut izin kararları değiştirilmeden büyük veri okuma yolu ayrı
bir servis ve repository ile sınırlandırılmıştır. Renderer serbest SQL, offset veya
sınırsız sayfa boyutu gönderemez. İmleç yalnız konum bilgisidir; yetkilendirme
kanıtı değildir. Repository’den dönen olay ve arşiv satırları nesne bazlı okuma
izninden geçmeden cevap nesnesine eklenmez.

## Gerçekten çalıştırılan hedefli kontroller

- Servis runtime: **PASS — 15/15**
- SQLite runtime ve query-plan: **PASS — 14/14**
- Renderer/preload/global/main sözdizimi: **PASS — 4/4**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS — kontrollü dış tip kabuğu**
- Büyük veri performans sözleşmesi: **PASS — 42/42**

SQLite senaryosu 1.500 kişi, 1.499 ilişki, 2.000 olay ve 1.500 arşiv kaydıyla
bellek içi `node:sqlite` üzerinde çalıştırılmıştır. Anahtar sayfalarında yinelenme
olmaması, filtreler, sayısal reminder günleri, metadata join’leri ve üç temel
query planında yeni indeks kullanımı doğrulanmıştır.

İlk SQL test çalıştırması test tablosunun 19 sütununa karşı 20 placeholder
kullanıldığı için uygulama sorgularına geçmeden durmuştur. Test düzeneği
düzeltildikten sonra aynı hedefli kontrol 14/14 PASS vermiştir.

## Kanıtlanmayan alanlar

Üretim `better-sqlite3`, gerçek disk I/O, tam renderer TypeScript workspace,
Electron production build, render frame süresi, Windows paketli runtime, smoke ve
installer yaşam döngüsü bu raporun kanıt kapsamına girmez.

## Bağımlılık nedeniyle bloke kalan mevcut kontroller

`verify:genealogy`, `verify:timeline` ve `verify:archive` komutları gerçekten
denendi; temiz bağımlılık kurulumu yapılmadığı için TypeScript `@types/node`
tanımını bulamadı ve üçü de uygulama senaryolarına başlamadan BLOCKED kaldı.
PASS olarak raporlanmamıştır.
