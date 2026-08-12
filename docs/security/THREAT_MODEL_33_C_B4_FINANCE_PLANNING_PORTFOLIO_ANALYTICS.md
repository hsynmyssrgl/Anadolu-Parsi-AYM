# 33-C B4-10/B4-11/B4-12 finans planlama ve portföy tehdit modeli

## Korunan varlıklar

- Kategori, nakit akışı, bütçe, yinelenen işlem, hedef ve portföy geçmişi.
- Aile/kişi sahipliği, gizlilik ve para birimi ayrımı.
- Finance policy kararı, exact receipt kimliği, audit ve outbox içerik sınırı.
- Tam PAN, CVV/CVC, PIN ve banka parolasının sisteme hiç alınmaması.

## Tehditler ve kontroller

1. **Bilinmeyen alan veya bankacılık sırrı girişi:** dokuz item türü exact anahtar
   kümeleriyle doğrulanır; kanonik sır alanları ve serbest metindeki Luhn-geçerli
   PAN hem IPC hem application katmanında fail-closed reddedilir.
2. **Tutarsız tutar, tarih veya enum:** pozitif/sınırlı tutar, ISO tarih, üç harfli
   para birimi, dönem ayı, tekrar aralığı ve tarih sırası iki katmanda doğrulanır.
3. **Üst kayıt ve sahiplik sahteciliği:** alt kayıt yalnız uyumlu kategori, kural,
   hedef veya varlığa bağlanır; aile, sahip ve gizlilik parent'tan kalıtılır.
4. **Receipt'siz veya replay yazma:** taban kayıt `create`, alt kayıt üst aggregate
   üzerinde `update` exact finance receipt ister; tüm finans tabloları arası replay
   SQLite trigger'larıyla reddedilir.
5. **Geçmişin değiştirilmesi:** tek finans planlama defteri append-only'dir;
   update ve delete girişimleri SQLite'da reddedilir.
6. **Yanlış kur dönüşümü veya yanıltıcı toplam:** analiz yalnız aynı para birimi
   içinde yapılır; `crossCurrencyAggregationPerformed=false` sözleşmede sabittir.
7. **Dış fiyat, banka eşitlemesi veya ödeme iddiası:** domain, karar ve UI manuel
   kaynak, dış fiyat doğrulanmadı, banka eşitlemesi yapılmadı ve ödeme icrası
   yapılmadı gerçekliğini açıkça taşır; yeni network egress yoktur.
8. **Audit/outbox sızıntısı:** olay yalnız kimlik, tür, parent, sahip ve gizlilik
   metadata'sı taşır; tutar, açıklama, not, hedef ve piyasa değeri taşımaz.
9. **Yetkisiz okuma veya yazma:** merkezi finance read/write kararı, kişi sahipliği,
   gizlilik filtresi ve exact kalıcı receipt birlikte uygulanır.
10. **Sınırsız birleşik ödeme listesi:** yaklaşan ödeme okuma modeli tarihe göre
    sıralanır ve en fazla 250 kayıtla sınırlandırılır; hiçbir kaydı icra etmez.

## Kalan riskler

Manuel değerler güncel veya dış finans gerçeğiyle aynı olmayabilir. Girilen birim
değer yatırım tavsiyesi ya da doğrulanmış piyasa fiyatı değildir. Kur dönüşümü
yapılmadığı için farklı para birimlerindeki değerler tek toplamda karşılaştırılmaz.
33-C kapanış anında CSV/Excel/OFX içe aktarma ve open-banking adapter B4-13/B4-14
kapsamında açıktı. Bu tarihsel risk, 33-D'de DEC-215 ve Migration 82 altında
kontrollü CSV/TSV/XLSX/OFX/QFX içe aktarma, tekrar önleme, yerel sentetik sandbox ve
manuel fallback ile kapatıldı. Canlı banka bağlantısı, kimlik bilgisi/token toplama,
harici onay ve ağ erişimi hâlâ uygulanmaz.
