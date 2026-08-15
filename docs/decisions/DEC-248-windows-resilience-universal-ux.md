# DEC-248 — Windows dayanıklılık ve evrensel UX konsolidasyonu

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-K yetkili evrensel arama, tek aile görünümü, komut paleti, son kullanılanlar/favoriler, kişisel kart sırası, sessiz saat/haftalık özet, persona modları ve offline/last-sync göstergelerini tek yerel politika modelinde toplar. Arama yalnız `authorized=true` adayları döndürür.

PPK-027 kapsamında politika zayıflatma açık kullanıcı karar kimliği, farklı yeni sürüm, SHA-256 risk analizi ve rollback planı olmadan kabul edilmez; kabul kaydı bile otomatik aktivasyon yetkisi vermez.

Synthetic crash/recovery kanıtı gerçek Windows installer yaşam döngüsü veya 168 saat soak değildir. QR, kamera, voice, mini panel ve Apple widget yalnız kapalı adapter sözleşmesidir. Migration 115 ve hedefli testler yerel başlangıcı kanıtlar; `countsAsRequirementPass=false` kalır.
