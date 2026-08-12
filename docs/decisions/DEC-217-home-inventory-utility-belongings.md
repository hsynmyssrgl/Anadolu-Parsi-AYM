# DEC-217 — Ev envanteri, sayaç, tüketim, eşya, garanti ve servis defteri

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: EXT-030, EXT-032
- Uygulama paketi: 33-F
- Kalıcılık hedefi: Migration 84 (`life_home_inventory_ledger`)

## Karar

EXT-030 ile EXT-032 aynı yönetilen `home` yaşam profili altında tek bir append-only
ev envanteri defteriyle uygulanır. Oda/alan, sayaç, sayaç okuması, eşya, garanti,
servis ve belge olayları kapalı bir discriminated union oluşturur. Her alt kayıt,
kök `life_managed_ledger` profilinin family, owner ve privacy kapsamını aynen miras
alır; düzeltme update/delete ile değil, yeni ve gerekirse önceki kaydı açıkça
supersede eden bir olayla yapılır.

Mevcut `life:getManagedWorkspace` ve `life:recordManagedItem` IPC adları korunur.
Yeni komut ve görünüm varyantları bu iki exact sözleşmeye eklenir; ayrı bir genel
dosya, ağ veya ödeme kanalı açılmaz. Politika çözümü alt kayıtları kök profilin
`life_record/update` makbuzuna bağlar.

## Finansal ve ölçümsel doğruluk

Sayaç okumaları floating point yerine `readingMilliunits`, parasal değerler
`amountMinor` olarak güvenli integer taşır. Tarihler canonical UTC ISO biçimindedir.
Normal sayaç akışı monoton ilerler; sıfırlama veya sayaç değişimi yalnız açık bir
reset/replacement olayıyla kabul edilir. Seri numarası ve yer etiketleri sınırlı
uzunlukta tutulur; ham seri, sayaç kimliği, okuma, tutar, arşiv kimliği veya belge
bilgisi audit/outbox/log içeriğine yazılmaz.

## Politika ve gizlilik

Her yeni defter satırı kök ev profilinin exact family, owner ve privacy değerleriyle
doğrulanır. Durable receipt tek kullanımlıdır ve legacy `life_records`, yönetilen
yaşam defteri ve ev envanteri defteri arasında kimlik/makbuz tekrar kullanımına izin
vermez. Belge yalnız opaque `archiveItemId` ile ve aynı aile/sensitivity sınırı içinde
bağlanabilir; renderer arşiv yolu, gerçek dosya adı, hash veya içerik görmez. Finans
bağlantısı varsa yalnız aynı family/owner/privacy kapsamındaki mevcut gider kaydına
referans verir ve yeni ödeme üretmez.

## Gerçeklik sınırı

Veri kaynağı yalnız manuel girdidir. Akıllı sayaç veya sağlayıcı sorgusu, garanti
sicili, OCR, belge içeriği okuma, servis rezervasyonu, canlı fiyat, ağ senkronizasyonu
ve ödeme icrası yapılmaz. Workspace gerçeği `smartMeterLookup`, `providerContact`,
`warrantyLookup`, `ocr`, `paymentExecution` ve `documentContentExposure` alanlarını
`not_performed` olarak ilan eder.

Bu karar yalnız EXT-030 ve EXT-032 kapsamını hedefler. B3-01 ilişki kanıt geçmişi,
EXT-033 OCR, EXT-044 çapraz alan otomasyonu ve diğer Bronze gereksinimleri açık kalır;
Silver readiness, Bronze Final veya yeni Build numarası iddia edilmez.
