# DEC-219 — Çevrimdışı 72 saat çantası ve afet tatbikatı defteri

- Tarih: 13.08.2026
- Durum: ACTIVE
- Gereksinimler: EXT-011, EXT-015
- Uygulama paketi: 33-H
- Kalıcılık hedefi: Migration 86 (`family_emergency_preparedness_ledger`)

## Karar

EXT-011 ve EXT-015 mevcut `family_emergency_ledger` içindeki bir acil durum planına
bağlı tek additive, append-only hazırlık defterinde birlikte uygulanır. Kapalı union;
`preparedness_kit`, `preparedness_kit_item`, `preparedness_kit_check` ve
`emergency_drill` olaylarından oluşur. Çanta maddesinin güncel durumu en son kontrol
olayından türetilir; geçmiş update/delete ile değiştirilmez.

Mevcut `life:getManagedWorkspace` ve `life:recordManagedItem` IPC kanalları korunur.
Tüm kayıtlar mevcut plan kökü üzerinde exact `life_record/update`, `family.write`
makbuzuna bağlanır ve planın family/owner/privacy kapsamını miras alır. Yeni route,
preload kanalı, capability, ağ, barkod, sensör veya bildirim primitive'i açılmaz.

## Doğruluk ve gerçeklik sınırı

Miktarlar floating point yerine bounded safe-integer milliunit, tatbikat süreleri
bounded safe-integer saniyedir. Son kullanma tarihi gerçek ISO takvim günü; kontrol
ve tatbikat zamanları canonical UTC'dir. Bilinmeyen alan, parola/token/secret,
PAN/CVV/PIN, dosya yolu ve base64 dispatch öncesi reddedilir. Audit/outbox madde adı,
miktar, tarih, konum veya not taşımaz.

Veri yalnız manueldir ve çevrimdışı yerel okunur. Barkod sorgusu, resmi son kullanma
doğrulaması, bildirim teslimi ve sensör entegrasyonu `not_performed`; hazırlık
garantisi `not_claimed` olarak görünürdür. Tatbikat kaydı alarm, mesaj veya acil servis
çağrısı değildir. EXT-014 ve diğer açık Bronze kapsamı kapanmış sayılmaz.
