# 33-L Uzun Vadeli Portföy — DEC-223 tehdit modeli

## Korunan varlıklar

Portföy sahipliği, ürün kimliği ve sürüm geçmişi; aylık planlar; alım/satım ve kurumsal işlem defteri; kıymet adet/maliyet/gelir/masraf/vergi verileri; manuel fiyatlar ve projeksiyon varsayımları finansal kişisel veridir.

## Güven sınırları

Renderer yalnız iki dar IPC kanalı kullanır: workspace okuma ve ayrıştırılmış union mutasyonu. Main process mevcut Finans merkezî PEP'i çözer; otorite ve kaynak aynı transaction içinde yeniden doğrulanır. Repository yalnız canlı `PolicyAuthorizedRepositoryExecutionContext` kabul eder. Mutation satırı tek kullanımlık durable finans policy receipt'e bağlanır; aynı UoW içindeki alt satırlar mutation ID üzerinden bağlanır. Audit ve outbox aynı transaction içindedir.

## Başlıca tehditler ve kontroller

| Tehdit | Kontrol |
|---|---|
| Başka aile/kişinin portföyünü okuma veya yazma | Merkezî PEP, account/person/family eşliği, legacy finance authorization ve her sorguda family filter |
| Renderer'dan fazla/uygunsuz alan, gizli banka bilgisi veya sonsuz sayı | Exact IPC alan allowlist'i, boyut sınırı, yasak bankacılık sırrı taraması, sonlu sayı/tarih/para birimi kontrolleri |
| Plan geçmişini veya ürünü yerinde değiştirme | Plan ve katalog revision append-only; UPDATE/DELETE SQLite guard; stable ID koddan ayrı |
| İşlem silerek kâr/zararı oynama | Ledger append-only; düzeltme tekil `reversal_of_event_id` ve zorunlu gerekçe; ters kayıt da değiştirilemez |
| Kısmi gerçekleşmeleri tek kayıtta gizleme | Her fill ayrı olay ve opsiyonel sıra/referans; UI bunu açıkça belirtir |
| Çift tıklama veya IPC replay ile aynı işlemi iki kez yazma | Aile kapsamlı `clientOperationId` + istek parmak izi; aynı içerik güvenli replay, farklı içerik conflict; renderer başarıya kadar aynı kimliği saklar ve eşzamanlı gönderimi kilitler |
| Mühürsüz/eksik toplamlı planı etkinleştirme | Plan ve dağılımlar aynı UoW içinde yazılır; yalnız tam 10.000 baz puanlık immutable seal bulunan sürümler okunur |
| Gelecek tarihli fiyat/olay/sürümle bugünkü görünümü zehirleme | Yazmada `occurredAt`, okumada `generatedAt` as-of kesiti; katalog ve plan tek doğrusal ileri zincirdir |
| Aşırı satış, geri tarihli çıkış veya ters kayıtla negatif adet | Uygulama zaman çizelgesinin bütün pivotlarını tarar; SQLite guard aynı invariantı doğrudan kalıcı sınırda uygular |
| Tek taraflı virmanla kıymet üretme veya bütçeyi aşma | `transfer_out` yalnız adetsiz, aynı para birimli, farklı iki kıymet arasında tek atomik bütçe kaydıdır; uygulama ve repository bütün aylık carryover pivotlarını fail-closed tarar. Haricî `transfer_in` belge ister |
| Para birimlerini nominal toplayıp yanlış TRY toplamı gösterme | Yabancı para işleminde açık FX zorunludur; çevrilmemiş yabancı para pozisyonu varsa birleşik değer/P&L/grafik üretilmez, kıymet kendi para biriminde kalır |
| Ters tarih, yanlış yön veya sahte net nakitle analitiği oynama | IPC, application ve SQLite; kronoloji, olay türü-yön ve brüt/masraf/vergi/net aritmetiğini birlikte doğrular |
| Receipt yeniden kullanımı | Mutation receipt UNIQUE; önceki finans tabloları ve yeni mutation arasında çift yönlü reuse trigger |
| Aileler arası FK veya kaynak karışması | Mutation/portfolio/instrument/plan/allocation/event/price scope trigger'ları |
| Eksik fiyatla sahte kesin sonuç | Eksik fiyat `missing` olarak taşınır; tüm pozisyonlar fiyatlanmadan portföy değeri/net sonuç üretilmez |
| Senaryoyu garanti gibi sunma | UI ve workspace truth sözleşmesi broker execution/live guarantee/advice/return/tax-legal guarantee alanlarını açıkça reddeder |

## Kalan riskler

Kullanıcı beyanı veya manuel fiyat yanlış olabilir. Vergi ve kurumsal işlem uygulamaları ülke, ürün ve tarihe göre değişebilir. Haricî piyasa/broker bağlantısı bu kararın kapsamında değildir; eklenirse kaynak kimliği, lisans, tazelik, rate limit, sağlayıcı kesintisi ve mutabakat için yeni karar ve tehdit modeli gerekir.

Çok uzun kişisel defterlerde geçmiş pivot taramalarının maliyeti büyüyebilir. Mevcut sorgular portföy/kıymet/zaman indekslerini kullanır; veri hacmi kişisel kullanım sınırını aşarsa özet/projeksiyon tablosu eklenmeden önce ayrı performans kararı ve kötüye kullanım bütçesi gerekir. Bu performans riski doğruluk kontrollerini gevşetme gerekçesi değildir.
