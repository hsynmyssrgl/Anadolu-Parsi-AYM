# 33-U Çocuk eğitim koordinasyonu tehdit modeli

## Korunan varlıklar

- Çocuğun okul, ders, etkinlik, ulaşım, gelişim ve bütçe kayıtları.
- Doğum tarihinden türetilen yaş bandı ve açıklanabilir görünürlük zonu.
- Merkezi PEP makbuzu, optimistic revision, state fingerprint ve immutable mutasyon zinciri.
- Ayrı 33-P geçici kimlik bilgisini gösteren opak teslim-yetkisi referansı.

## Tehditler ve kontroller

### Vasi rolüyle çocuk verisi sahipliği ele geçirme

Rol sunumu yetki değildir. Çocuk-sahipli kayda non-owner erişimi için exact veya wildcard nesne izni gerekir. Aile, hesap, aktör, çocuk, amaç ve `child` veri sınıfı migration tetiklerinde tekrar doğrulanır.

### Ergen özel alanını vasi izniyle aşma

`adolescent_private`, açık grant bulunsa bile yalnız 13–17 yaş kayıt sahibinin mutasyonuna izin verir. 13 yaş altı veya başka aktör fail-closed reddedilir. Gerçek çocuk/vasi gizlilik UAT’si `NOT_RUN` olduğundan ürün kabulü iddia edilmez.

Görünürlük güncellemesi yalnız eski gizlilik düzeyine göre değerlendirilmez. Uygulama hem mevcut hem hedef görünürlük için merkezi izin kararı ister; böylece seçili vasi izniyle alınan bir kayıt aile geneline genişletilemez. Sınıf etiketi, ödev vadesi, zamanlı eğitim/etkinlik/ulaşım kayıtlarının başlangıcı ve teslim yetkisinin başlangıç-bitiş penceresi application, IPC ve SQLite CHECK katmanlarında birlikte zorunludur. Güncelleme bu zorunlu zamanları silemez.

### Renderer’dan yetki veya gizli veri enjeksiyonu

IPC yalnız çocuk kimliği ve sınırlı domain alanlarını kabul eder. Account/family/policy receipt/hash/path/token/PIN/prototype/accessor/extra key yüzeyleri reddedilir. Safe result, AI/dış paylaşım/senkronizasyon overclaim’lerini reddeder.

### Okul, ulaşım, ödeme veya sertifika overclaim’i

Okul portalı, öğretmen mesajı, canlı servis takibi, ödeme yürütme ve sertifika doğrulama yoktur. Teslim yetkisi yalnız opak 33-P referansıdır; ham credential veya teslim kodu kabul edilmez.

### Silinmiş kayıtta içerik kalması

Silme fiziksel erase değildir. Migration 99 yalnız başlık `Silindi`, tüm opsiyonel içerik alanları NULL, exact `deletedAt=updatedAt`, next mutation/fingerprint ve dayanıklı ledger ile mezar taşına izin verir. Backup propagation ve secure erase kanıtlanmamıştır.

### Büyük veya saldırgan payload

Kimlik, enum, metin, tarih, para, baz puan, sonuç adedi ve IPC boyutları sınırlıdır. Extra key, symbol, accessor, prototype, NaN/sonsuz değer, secret/path ve biçim uyuşmazlığı fail-closed reddedilir. Merkez 1.000 öğe üstünde sessiz kesilmez; sorgu reddedilir.

## Açık riskler

- Gerçek aile/ergen/okul iş akışı UAT’si `NOT_RUN`.
- Çocuk güvenliği, hukuk, gizlilik ve veri saklama incelemeleri `NOT_RUN`.
- Gerçek 33-P teslim credential zinciri ve selected-guardian yönetim UAT’si `NOT_RUN`.
- Fiziksel silme, backup propagation, okul portalı ve dış paylaşım yoktur.

Bu nedenle yerel teknik testler geçse bile certification veya requirement PASS iddiası üretilemez.
