# DEC-216 — Kategoriye özgü yaşam, ev ve araç defteri

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B5-04, EXT-031, EXT-034
- Uygulama paketi: 33-E
- Kalıcılık: Migration 83 (`b5_life_home_vehicle_managed_ledger`)

## Karar

Sigorta, abonelik, eğitim, çalışma, resmî işlem, ev ve araç kayıtları tek bir
append-only `life_managed_ledger` altında yönetilir. Kök `profile` satırı kategoriye
özgü sabit alanları; `activity` satırı yenileme, kira, prim, muayene, bakım, servis,
yakıt, şarj ve diğer gider olaylarını; `document` satırı ise yalnız opaque arşiv
kimliğini taşır. Alt kayıtlar kök profilin aile, sahip ve gizlilik kapsamını aynen
miras alır ve sonradan değiştirilemez.

Yedi kategori discriminated union ile doğrulanır. Para değerleri floating point
yerine minor unit integer, yakıt/enerji miktarları milliunit integer, kilometre ise
negatif olmayan integer olarak tutulur. Tarihler canonical UTC ISO biçimindedir.
Profil ve faaliyet komutlarında bilinmeyen alanlar; parola, token, secret, credential,
PAN/CVV/PIN, dosya yolu ve base64 içerik fail-closed reddedilir.

İki yeni üretim composition noktası açıkça incelenerek PPK-021 exact allowlist
543'ten 545'e ve `USE_CASE_COMPOSITION` yüzeyi 275'ten 277'ye yükseltilir.
Yeni dosya veya ağ yeteneği açılmadığı için PPK-022 exact yüzeyi 242'de kalır.

## Politika ve kayıt kararı

Kök profil, exact `life_record/create` makbuzuyla kendi kimliğine bağlanır. Faaliyet
ve belge satırı, exact `life_record/update` makbuzuyla kök profile bağlanır. Makbuz
family, owner, privacy/sensitivity, purpose, version, hash, nonce ve correlation
değerleriyle birebir doğrulanır; legacy `life_records` ile yeni ledger arasında
kimlik ve makbuz tekrar kullanımı iki yönlü reddedilir.

Ev ve araç finance bağlantıları yalnız aynı family/owner/privacy kapsamındaki uygun
`real_estate`, `vehicle` veya expense satırlarına kurulabilir. Belge bağlantısı
yalnız aynı ailede, silinmemiş ve profil gizliliğiyle uyumlu arşiv öğesine yapılır.
Renderer'a arşiv yolu, dosya adı, hash, ham içerik veya politika makbuzu dönmez.

## Hatırlatma ve geçmiş

Kök ilk hatırlatmayı taşıyabilir. Sonraki her yenileme veya bakım ayrı activity
kimliği üretir; son `set`/`clear` mutasyonu güncel hatırlatmayı belirler. Böylece
otomasyon idempotency anahtarı kök tarihin güncellenmesine dayanmaz ve ardışık
yenilemeler birbirini kaybetmez. Update/delete API sunulmaz; düzeltme ve yenileme
yeni olayla yapılır.

## Gerçeklik sınırı

Gerçeklik alanları `externalRegistryLookup: not_performed`,
`providerContact: not_performed`, `paymentExecution: not_performed` ve
`documentContentExposure: not_performed` olarak taşınır.

Veri kaynağı yalnız manuel girdidir. Tapu, DASK, EGM, sigorta, okul, işveren veya
servis sağlayıcı siciline ağ üzerinden bağlanılmaz; dış doğrulama, sağlayıcıyla
iletişim, rezervasyon, teklif, poliçe üretimi veya ödeme icrası yapılmaz. Finance
bağlantısı varsa yalnız mevcut yerel kayda referans verilir ve yeni ödeme yaratılmaz.
Bu paket B5-04, EXT-031 ve EXT-034 dışında B5/EXT kapsamını, Silver readiness'i veya
Bronze Final'i tamamlamaz; yeni Build numarası verilmez.
