# 33-F tehdit modeli — Ev envanteri, sayaç, tüketim, eşya, garanti ve servis

## Kapsam ve varlıklar

33-F, EXT-030 ve EXT-032 için mevcut yönetilen `home` yaşam profilinin altında
append-only ev envanteri olayları tutar. Korunan varlıklar; oda/alan etiketleri,
sayaç türü ve maskelenmiş kimliği, integer okuma geçmişi, eşya/marka/model/seri,
garanti ve servis olayları ile opaque arşiv ve yerel finans bağlantılarıdır.

Bu alanların tamamı kişisel veya hassas hane verisidir. Renderer'a politika makbuzu,
arşiv yolu, gerçek dosya adı, hash, belge içeriği ya da dış sağlayıcı kimlik bilgisi
gönderilmez.

## Tehditler ve kontroller

### Cross-family / owner / privacy confused deputy

Her alt kayıt yalnız `item_type=profile`, `category=home` köküne bağlanabilir. Family,
owner ve privacy değerleri komuttan alınmaz; kökten miras edilir ve hem uygulama hem
SQLite trigger katmanında birebir doğrulanır. Oda/sayaç/eşya parent bağlantıları aynı
kök dışında reddedilir. Görünürlük çocuk satırından bağımsız açılmaz; kök profilin
deny-first görünürlüğü kullanılır.

### Makbuz replay ve kimlik çakışması

Her append exact `life_record/update`, kök resource ID, `family.write`, family, owner,
sensitivity, purpose, version, nonce ve correlation değerlerine bağlı durable policy
receipt ister. Receipt hash ve satır kimliği legacy `life_records`,
`life_managed_ledger` ve yeni ev envanteri defteri arasında tekrar kullanılamaz.
Update/delete fail-closed'dur; düzeltme yeni ve açıkça superseding olayla yapılır.

### Ölçüm ve finans bozulması

Sayaç okumaları `readingMilliunits`, para `amountMinor` güvenli integer alanlarıyla
tutulur; NaN, Infinity, floating point, negatif ve güvenli integer dışı değerler
reddedilir. Tarihler canonical UTC ISO round-trip ile doğrulanır. Normal sayaç akışı
monotondur; düşüş ancak açık reset/replacement olayıyla kabul edilir. Finance linki
yalnız aynı family/owner/privacy/currency kapsamındaki mevcut expense satırına gider;
yeni ödeme veya muhasebe kaydı üretmez.

### Gizli veri, dosya ve içerik sızması

Recursive exact-key denetimi bilinmeyen alanları ve password/token/secret/credential,
PAN/CVV/PIN, file path ve base64 girdisini yazma öncesi reddeder. Seri numarası ayrı,
sınırlı bir text alanıdır ve PAN algılayıcısı finansal kart girdisini kabul etmez.
Audit/outbox yalnız item ID, root ID, item type ve privacy gibi içeriksiz metadata
taşır; seri, sayaç kimliği, okuma, tutar, provider, arşiv veya finans ID taşımaz.

Belge yalnız opaque `archiveItemId` ile bağlanır. Archive öğesi aynı ailede, yok
edilmemiş ve kök privacy/sensitivity sınırıyla uyumlu olmalıdır. Workspace belge
içeriğini, path/name/hash değerlerini projekte etmez.

### Dış sistem ve yanlış gerçeklik iddiası

33-F yeni file/network/crypto primitive açmaz. Akıllı sayaç, enerji/su sağlayıcısı,
garanti üreticisi, servis sağlayıcısı veya OCR sistemi çağrılmaz. Canlı tüketim,
garanti doğrulama, servis rezervasyonu, belge okuma ya da ödeme sonucu iddia edilmez.
Workspace şu truth alanlarını açıkça `not_performed` taşır:

- `smartMeterLookup`
- `providerContact`
- `warrantyLookup`
- `ocr`
- `paymentExecution`
- `documentContentExposure`

Veri kaynağı `manual`, network egress sayısı sıfırdır.

## Kalan riskler ve açık kapsam

Kullanıcının manuel girdi doğruluğu dış kaynaktan teyit edilmez. Yer etiketleri ve
seri numaraları cihaz erişimi olan yetkili aile üyelerine hane hakkında çıkarım
sağlayabilir; bu nedenle kök privacy görünürlüğü ve maskeli seri UI zorunludur.

B3-01 ilişki kanıt geçmişi, EXT-033 OCR, EXT-044 çapraz alan otomasyonu ve diğer
Bronze gereksinimleri 33-F ile kapanmaz. Silver readiness, Bronze Final, acil servis
garantisi veya yeni Build numarası iddia edilmez.
