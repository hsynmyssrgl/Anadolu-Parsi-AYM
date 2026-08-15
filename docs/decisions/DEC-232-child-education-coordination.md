# DEC-232 — Çocuk eğitim koordinasyonu

## Karar

33-U, EXT-017, EXT-018, EXT-019, EXT-020 ve EXT-022 için mevcut Yaşam Merkezi içinde tek, yerel çocuk eğitim koordinasyonu yüzeyi kurar. Okul/sınıf/ders programı/ödev/sınav; okul etkinliği/ulaşım/teslim yetkisi; kurs/spor/sertifika/kitap ve harçlık bütçesi/eğitim hedefi aynı çocuk-sahipli aggregate üzerinde tutulur.

Her kalıcı yazım merkezi PEP tarafından üretilmiş taze, yazılabilir ve projection kanıtlı makbuza; `familyId + actorAccountId + actorPersonId + childPersonId`; `purpose=general`; `dataClasses=['child']`; optimistic revision ve idempotent client operation kimliğine bağlanır. Çocuk sahibi olmayan aktör için rol tek başına yetki değildir; açık nesne izni gerekir. `adolescent_private` yalnız 13–17 yaşındaki kayıt sahibinin mutasyonuna açıktır. Silme fiziksel silme iddiası üretmez; hassas alanları boşaltılmış, dayanıklı `Silindi` mezar taşı bırakır.

Migration 99 iki tablo ekler: `child_education_mutations` ve `child_education_items`. Kanonik checksum `38ecd03c71e734d1700f2ee44ece10e47935277e003e7e4ce21da7b6034db98e` değeridir. PPK-021 güncel ratchet’i 462 dosya / 715 yüzey / `2e1962cc032e83ef84128f7aa4e266d2f70ca12178c48c5109d6e1849df3073b`; PPK-022 ratchet’i 462 dosya / 345 yüzey / `1b8625264023eb79d3f36a3c25ca19480569bea6aa1f4589841b1b4d14d5ec3e` değerindedir. Statik manifest runtime yetkisi değildir.

## Dürüst kapsam sınırları

- Yerel kayıtlar okul portalına bağlanmaz, öğretmene mesaj göndermez ve okul servisini canlı izlemez.
- Teslim yetkisi, 33-P Kimlik Merkezi tarafından ayrı yönetilen opak referanstır; 33-U kimlik bilgisi üretmez veya doğrulamaz.
- Harçlık bütçesi ödeme yürütmez. Sertifika yalnız `locally_recorded_unverified` durumundadır.
- Sağlık verisi kopyalanmaz; AI işleme ve dış paylaşım kapalıdır.
- Yeni menü/rota eklenmez; mevcut Yaşam Merkezi genişletilir.

## Yönetişim durumu

Yerel teknik matris 5 dosya/22 testtir. Bu kanıt gerçek aile, çocuk/vasi gizlilik incelemesi, ergen güvenliği, okul iş akışı, gerçek credential veya hukuk/gizlilik kabulü değildir. `33-U=PLANNED`, `LOCAL_IMPLEMENTATION_STARTED`, `countsAsRequirementPass=false`; registry, roadmap, plan, ledger ve kalıcı kapanış makbuzu bu başlangıç tarafından değiştirilmez. Tüm dış ve manuel kanıtlar `NOT_RUN` kalır.
