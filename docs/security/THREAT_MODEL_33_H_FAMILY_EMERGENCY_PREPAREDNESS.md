# 33-H tehdit modeli — Çevrimdışı aile acil durum hazırlığı

## Kapsam ve varlıklar

33-H; EXT-011 ve EXT-015 için 72 saat çantası, çanta maddesi, manuel kontrol ve afet
tatbikat geçmişini mevcut aile acil durum planına bağlar. Miktar, son kullanma tarihi,
not ve hazır olma durumu hane güvenliği açısından hassas olabilir.

## Tehditler ve kontroller

### Cross-family, yanlış parent ve confused deputy

Her satır aynı ailedeki görünür `emergency_plan` köküne bağlıdır; family, owner ve
privacy komuttan değil kökten miras alınır. Çanta maddesi yalnız aynı kökteki çantayı,
kontrol yalnız aynı kökteki maddeyi hedefler. Exact `life_record/update` receipt plan
kökünü, özneyi ve `family.write` kararını bağlar. Cross-family/owner/privacy, yanlış
parent, lifecycle drift, kimlik veya makbuz replay hem uygulama hem SQLite'ta reddedilir.

### Veri sızıntısı ve girdi istismarı

Renderer yalnız açık allowlist projeksiyonu görür; receipt, family kimliği ve ham DB
satırı yayılmaz. Recursive exact-key denetimi bilinmeyen ve gizli alanları, PAN benzeri
değerleri (PAN/CVV/PIN), dosya yolunu ve base64 içeriği reddeder. Audit/outbox yalnız içeriksiz olay
kimliği, plan kimliği ve item türünü taşır.

### Yanlış hazır olma ve zaman iddiası

Manuel miktarlar doğrulanmış stok sayılmaz. `ready`, resmi sertifika veya müdahale
garantisi değildir. ISO tarihleri gerçek takvim doğrulamasından geçer; miktar/süre
safe integer sınırındadır. En son kontrol deterministik `(createdAt,id)` sırasıyla
türetilir; defter append-only'dir ve update/delete yasaktır.

### Dış servis ve ağ

Barkod/üretici/son kullanma sağlayıcısı, bildirim servisi, sensör, alarm veya acil
servis çağrısı yoktur. `barcodeLookup`, `expiryVerification`, `notificationDelivery`
ve `sensorIntegration` değerleri `not_performed`; `readinessGuarantee` değeri
`not_claimed`, `networkEgressAdded` değeri `false` kalır.
