# ADR-033 — Arama Destekli Keyset Kişi ve Olay Katalogları

**Aktif sürüm:** 01.08.2026.219  

## Durum

Kabul edildi — Bronze RC2 Build 156 Active Development.

## Bağlam

Build 155 başlangıçta tam aile snapshot'ını kaldırdı; ancak aile ekranı ve birçok
seçim alanı kişi/olay seçeneklerini hâlâ renderer'daki tam koleksiyonlardan
üretiyordu. Büyük ailelerde modal açmak, filtre seçmek veya bağlı kişi göstermek
binlerce seçeneğin belleğe ve DOM'a taşınmasına yol açabilirdi.

## Karar

Kişi ve olay seçenekleri ayrı repository ve main-process servisleri üzerinden
arama destekli keyset sayfalarıyla sunulur. Kişiler ad + kimlik, olaylar tarih +
kimlik sırasıyla sayfalanır. Sayfa boyutu 10–100 ile sınırlıdır.

İmleçler kullanıcı hesabı ve etkin filtrelerin SHA-256 kapsamına bağlanır. Seçili
kimlikler, katalog sayfasında bulunmasalar bile en fazla 100 kimliklik bounded
lookup ile çözümlenir. Olay sonuçları her zaman nesne bazlı okuma izninden geçer.

Aile ekranı ve ortak kişi/olay seçim bileşenleri katalog API'sini kullanır; ekran
ziyareti veya modal açılışı tam graph/timeline snapshot'ını tetiklemez.

## Sonuçlar

- Seçim alanı payload'ı toplam kişi/olay sayısından ayrılır.
- Kullanıcı arama yapmadan yüzlerce/binlerce seçenek çizilmez.
- Filtre değiştirilmiş veya başka hesaba ait imleç yeniden kullanılamaz.
- Seçili değerlerin etiketi tam koleksiyon yüklenmeden korunur.
- Tam snapshot uyumluluğu mutasyon ve eski ekranlar için korunur; katalog kullanan
  ekranlar başlangıç bağımlılığı olarak kullanmaz.
