# 33-T tehdit modeli — hane operasyonları merkezi

## Korunan varlıklar

- Aile kapsamlı alışveriş, stok, öğün, görev, gider, teslimat, misafir ve evcil hayvan bakım kayıtları
- Atanan kişi, gider payı, alerjen filtresi ve zaman/son-kullanım metadata’sı
- Family/account/owner/resource sınırı ile PEP receipt/fence/projection kanıtı
- İçerik taşımayan audit/outbox ve immutable mutation kimliği

## Tehditler ve kontroller

### Çapraz aile veya sahip kaydı

Repository exact center, family, owner ve receipt subject bağını zorunlu kılar. Yabancı owner/account/family, forged receipt veya resource mismatch fail-closed reddedilir. Renderer family/account veya PEP authority almaz.

### Replay, stale revision veya yarım commit

Client operation kimliği request fingerprint ile bağlıdır; aynı kimlikle farklı istek reddedilir. Exact create replay’i policy preauth’ta mevcut kaynağı yalnız aynı owner/family/privacy bağında çözebilir; application mutation ledger’ı fingerprint ve revizyonu doğrulamadan yazım yapmaz. Mutation, center, item, audit ve outbox tek transaction içinde yazılır; downstream hata tam rollback üretir.

### Alerjen filtresini sağlık tavsiyesi sanma

Öğün planı yalnız seçilen tarifin yerel alerjen kodları ile kullanıcının kaçındığı kodların exact kesişimini reddeder. Tıbbi doğrulama, beslenme değerlendirmesi veya güvenli tüketim garantisi üretmez; UI bu sınırı açıkça yazar.

### Gider paylaşımı veya ödeme yetkisi sahteciliği

Paylar etkin aynı-aile kişilerine bağlı, farklı ve toplam 10.000 basis point olmalıdır. Tutar ve para birimi yalnız yerel kayıttır; ödeme hesabı, kart/PAN, token, otomatik tahsilat veya para transferi yoktur. IPC extra secret/payment alanlarını reddeder.

### Teslimat veya misafir erişim sırrı sızıntısı

Tam takip numarası kabul edilmez; yalnız dört alfasayısal karakter ve sağlayıcı etiketi tutulur. Misafir kaydı etiket, alan, başlangıç ve bitiş taşır; anahtar, PIN veya erişim kodu alanı yoktur. Uzaktan kapı/anahtar kontrolü yapılmaz.

### Büyük veya yapısal olarak kötü niyetli payload

Kind/status/area enum’ları, kimlikler, metin, tarih, sayı, array, pay ve IPC toplam boyutları sınırlıdır. Prototype/accessor/symbol, extra key, path, secret, PAN, NaN/sonsuz değer, yinelenen kişi/alerjen ve eksik pay toplamı fail-closed reddedilir. Center listesi 2.000 item üzerinde sessiz kesilmez; sorgu reddedilir.

### Eksik veya zamansal olarak çelişkili iş akışı

Gıda stoğu son kullanma tarihi; öğün planı planlanan zaman; ev işi/rutin kişi ataması; rutin/abonelik tekrar bilgisi; fatura/abonelik son ödeme tarihi; evcil hayvan bakımı zaman gerektirir. Misafir erişimi ve diğer zaman aralıklı kayıtlarda bitiş başlangıçtan önce olamaz. IPC eksik create girdisini uygulamaya ulaşmadan reddeder; application update akışı mevcut ve yeni alanları birlikte değerlendirerek zorunlu alanın temizlenmesini veya zaman sırasının tersine çevrilmesini fail-closed engeller.

### Statik gate’i runtime yetkisi sanma

PPK-021/022 yalnız build/runtime surface ratchet’idir. Her repository erişiminde merkezi PEP/UoW receipt’i zorunludur; allowlist veya capability manifest tek başına hane verisi yetkisi vermez.

## Açık riskler

- Gerçek aile kullanıcılarıyla uçtan uca UAT yapılmamıştır.
- Beslenme/alerji, finans, erişilebilirlik, gizlilik, hukuk ve bağımsız güvenlik incelemesi `NOT_RUN` durumundadır.
- Dış sipariş, ödeme, taşıyıcı, uzaktan erişim ve bakım teslimi için üretim authority yoktur.
- Saklama süresi, kaynak silme/yedek yayılımı ve fiziksel secure erase kabulü tamamlanmamıştır.
- 33-N ve aktif 33-P atomik yönetişim zincirleri kapanmadan 33-T gereksinimleri PASS sayılmaz.

Bu açıklar nedeniyle yerel teknik testler geçse bile certification veya production acceptance iddiası yapılmaz.
