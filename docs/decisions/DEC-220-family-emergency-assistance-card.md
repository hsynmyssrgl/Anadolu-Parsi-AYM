# DEC-220 — Çevrimdışı özel acil sağlık/iletişim kartı ve yardım profili

- Tarih: 13.08.2026
- Durum: ACTIVE
- Gereksinimler: EXT-012, EXT-014
- Uygulama paketi: 33-I
- Kalıcılık hedefi: Migration 87 (`family_emergency_assistance_ledger`)

## Karar

EXT-012 ve EXT-014 tek additive, append-only acil yardım defterinde birlikte uygulanır.
Kapalı union `emergency_profile`, `health_fact`, `emergency_contact` ve
`assistance_instruction` satırlarından oluşur. Profil mevcut ve aktif bir
`family_emergency_ledger.emergency_plan` kaydına aynı aile içinde bağlanır; ancak plan
bağlantısı yalnız bütünlük ilişkisidir ve sağlık kartına aile görünürlüğü vermez.

Profil bağımsız bir `life_record` politika köküdür. Profil oluşturma makbuzu exact
`create/profileId`, çocuk yazımları exact `update/profileId` kullanır. Kişi konusu için
owner kişiyle aynıdır; başka kişi adına işlem yalnız merkezi PEP kararıyla mümkündür.
Evcil hayvan konusu opaque `subjectPetId` ile aynı ailedeki aktif sorumlu kişiye
bağlanır. Çocuk satırlar kökün family/owner/privacy kapsamını aynen miras alır.
Gizlilik komut girdisi değildir ve bütün profil/çocuk satırlarında exact `private`
olarak sabittir.

Mevcut `life:getManagedWorkspace` ve `life:recordManagedItem` IPC kanalları korunur.
Yeni route, preload kanalı, capability, ağ veya dış servis primitive'i açılmaz.

## Doğruluk ve gerçeklik sınırı

Kart sağlık sistemlerinden otomatik veri çekmez ve klinik doğrulama yapmaz. Sağlık
özeti, E.164 iletişim bilgisi ve hareket/görme/işitme/iletişim/ileri yaş/evcil hayvan
yardım talimatları kullanıcı tarafından manuel girilir. Audit/outbox sağlık, telefon,
konum veya yardım notu taşımaz. Defter update/delete kabul etmez; düzeltmeler aynı
kök, tür ve konu kapsamında tekil superseding olayla yapılır.

Veri `manual` ve `local_only`; `medicalVerification`, `healthRegistryLookup`,
`messageDelivery`, `emergencyServiceContact` ve `exportSharing` `not_performed`,
`networkEgressAdded` `false` kalır. Bu adım yazdırılabilir/PDF kartı, PIN/izinli
paylaşımı, sağlık merkezi bütünleştirmesini, acil servis çağrısını veya müdahale
garantisini kapsamaz; B5-01, B5-03, B5-06 ve EXT-016 kapanmış sayılmaz.
