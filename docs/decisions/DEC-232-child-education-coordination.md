# DEC-232 — Çocuk eğitim koordinasyonu

## Karar

33-U, EXT-017, EXT-018, EXT-019, EXT-020 ve EXT-022 için mevcut Yaşam Merkezi içinde tek, yerel çocuk eğitim koordinasyonu yüzeyi kurar. Okul/sınıf/ders programı/ödev/sınav; okul etkinliği/ulaşım/teslim yetkisi; kurs/spor/sertifika/kitap ve harçlık bütçesi/eğitim hedefi aynı çocuk-sahipli aggregate üzerinde tutulur.

Her kalıcı yazım merkezi PEP tarafından üretilmiş taze, yazılabilir ve projection kanıtlı makbuza; `familyId + actorAccountId + actorPersonId + childPersonId`; `purpose=general`; `dataClasses=['child']`; optimistic revision ve idempotent client operation kimliğine bağlanır. Çocuk sahibi olmayan aktör için rol tek başına yetki değildir; açık nesne izni gerekir. `adolescent_private` yalnız 13–17 yaşındaki kayıt sahibinin mutasyonuna açıktır. Silme fiziksel silme iddiası üretmez; hassas alanları boşaltılmış, dayanıklı `Silindi` mezar taşı bırakır.

Migration 99 iki tablo ekler: `child_education_mutations` ve `child_education_items`. Kanonik checksum `9eb3952ac53f823ae6d12aae09d41748a6a445cd9d4dce11df9d3a47b58a8e25` değerindedir. PPK-021 güncel ratchet’i 568 dosya / 889 yüzey / `3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd`; PPK-022 ratchet’i 568 dosya / 428 yüzey / `1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1` değerindedir. Statik manifest runtime yetkisi değildir.

## Dürüst kapsam sınırları

- Yerel kayıtlar okul portalına bağlanmaz, öğretmene mesaj göndermez ve okul servisini canlı izlemez.
- Teslim yetkisi, 33-P Kimlik Merkezi tarafından ayrı yönetilen opak referanstır; 33-U kimlik bilgisi üretmez veya doğrulamaz.
- Harçlık bütçesi ödeme yürütmez. Sertifika yalnız `locally_recorded_unverified` durumundadır.
- Sağlık verisi kopyalanmaz; AI işleme ve dış paylaşım kapalıdır.
- Yeni menü/rota eklenmez; mevcut Yaşam Merkezi genişletilir.

Eksik koordinasyon kaydı oluşturulamaz: sınıf kurum ve sınıf etiketi, ödev ders ve son tarih, ders programı/sınav/okul etkinliği/ulaşım/teslim yetkisi/kurs/spor başlangıç zamanı gerektirir. Okul etkinliği ayrıca kurum; teslim yetkisi ise ayrı 33-P opak referansı ile başlangıç-bitiş geçerlilik penceresi gerektirir. Güncelleme zorunlu zamanları kaldıramaz. Görünürlük değişimi hem mevcut hem hedef gizlilik düzeyinde yeniden yetkilendirilir; seçili vasi izni tek başına aile geneline açıklama yetkisi değildir. Gerçek SQLite/PEP matrisi on dört türün tamamını, renderer ise zaman/vade/bütçe/ilerleme özetlerini kapsar.

## Yönetişim durumu

Yerel teknik matris 5 dosya/22 testtir. Bu kanıt gerçek aile, çocuk/vasi gizlilik incelemesi, ergen güvenliği, okul iş akışı, gerçek credential veya hukuk/gizlilik kabulü değildir. `33-U=PLANNED`, `LOCAL_IMPLEMENTATION_STARTED`, `countsAsRequirementPass=false`; registry, roadmap, plan, ledger ve kalıcı kapanış makbuzu bu başlangıç tarafından değiştirilmez. Tüm dış ve manuel kanıtlar `NOT_RUN` kalır.
