# DEC-218 — Çevrimdışı aile acil durum planı ve kişi durumu

- Tarih: 13.08.2026
- Durum: ACTIVE
- Gereksinimler: B5-07, EXT-009, EXT-010, EXT-013
- Uygulama paketi: 33-G
- Kalıcılık hedefi: Migration 85 (`family_emergency_ledger`)

## Karar

B5-07, EXT-009, EXT-010 ve EXT-013 tek bir çevrimdışı, append-only aile acil
durum defterinde birlikte uygulanır. Defter; afet/tahliye planı, birincil ve
alternatif buluşma noktaları, şehir dışı irtibat, kontrol listesi maddeleri ve
durum değişiklikleri ile aile üyesinin `safe` / `needs_help` bildirimlerini kapalı
bir discriminated union olarak taşır.

Mevcut `life:getManagedWorkspace` ve `life:recordManagedItem` IPC kanalları
korunur. Ayrı ağ, mesajlaşma, harita, canlı konum veya acil servis kanalı açılmaz.
Plan kökü `life_record/create`, planın normal alt olayları köke bağlı
`life_record/update` makbuzu ile yazılır. Üye durumu ayrı bir `create` kaynağıdır;
kaynak sahibi durum bildirilen üyedir ve makbuz öznesi bildirimi yapan gerçek
hesap/kişiyle eşleşir. Böylece aile üyesi kendi durumunu bildirebilir, yetkili aile
yöneticisinin başkası adına bildirimi ise `reportedByPersonId` ile açıkça izlenir.

## Yetki, gizlilik ve değişmezlik

Planlar yalnız `family` gizlilik düzeyindedir. Her çocuk olay planın family ve
koordinatör kapsamını miras alır; üye durumu aynı ailedeki aktif bir kişiyi hedefler.
Cross-family/root/member bağlantıları, durable receipt veya kimlik tekrar kullanımı
hem uygulama hem SQLite trigger katmanında reddedilir. Satırlar update/delete ile
değiştirilemez; kontrol listesi ve kişi durumunda güncel görünüm en son geçerli
append-only olaydan türetilir.

İrtibat numarası yalnız sıkı E.164 biçiminde kabul edilir ve acil durumda çevrimdışı
kullanılabilmesi için yalnız politika tarafından yetkilendirilmiş aile çalışma
alanında gösterilir; audit, outbox veya dışa aktarıma taşınmaz. Bilinmeyen alan,
parola/token/secret/credential, PAN/CVV/PIN, dosya yolu
ve base64 içerikleri politika dispatch öncesi reddedilir. Audit/outbox; adres,
telefon, talimat, kişi durumu veya not gibi hassas içerik taşımaz.

## Gerçeklik sınırı

Veri kaynağı yalnız manuel girdidir ve çalışma alanı yerel veritabanından çevrimdışı
okunabilir. Harita sorgusu, canlı konum, SMS/e-posta/mesaj gönderimi, kişi veya acil
servis araması, teslim garantisi ve acil servis garantisi yoktur. UI bu sınırları
`not_performed` ve `not_claimed` değerleriyle görünür biçimde ilan eder.

Bu karar 72 saat çantası envanteri (EXT-011), resmi acil yayın entegrasyonu, canlı
konum paylaşımı ve diğer açık Bronze gereksinimlerini kapatmaz. Silver readiness,
Bronze Final veya yeni Build numarası iddia edilmez.
