# 33-I tehdit modeli — Çevrimdışı özel acil yardım kartı

## Kapsam ve hassas varlıklar

33-I, EXT-012 ve EXT-014 için manuel acil sağlık/iletişim kartını ve kişi veya evcil
hayvan yardım talimatlarını uygular. Kan grubu, alerji, kronik durum, ilaç, tıbbi cihaz,
telefon ve yardım talimatları `highly_sensitive` kabul edilir. Bütün profil ve çocuk
satırlarında gizlilik sabit `private` değeridir.

## Yetkisiz aile görünürlüğü ve confused deputy

`emergency_profile`, aile acil durum planından bağımsız bir `life_record` politika
köküdür. Plan bağlantısı yalnız aynı aile ve aktif-plan bütünlüğünü kanıtlar; profil
görünürlüğü vermez. Listeleme profil sahibinin exact private görünürlük kararından
türetilir, çocuklar yalnız görünür profil kimlikleri üzerinden projekte edilir.

Profil oluşturma exact `create/profileId`, çocuk yazımı exact `update/profileId`
makbuzuna bağlıdır. Kişi profilinde owner konu kişiye, evcil hayvan profilinde owner
aktif sorumlu kişiye eşittir. Aile, owner, private gizlilik, kök ve subject ilişkileri
komut verisinden güvenilmez; uygulama, repository ve SQLite tarafından doğrulanır.

## Makbuz replay, kimlik çakışması ve değiştirilemez geçmiş

Migration 87 her yazımı tek, kullanılmamış ve exact durable PPK makbuzuyla bağlar.
LIFE, acil durum, hazırlık, arşiv, olay, finans, sağlık, konum, bankacılık, planlama ve
içe aktarma defterleriyle çift yönlü kimlik/makbuz replay korumaları vardır. Ledger
append-only'dir; update ve delete fail-closed reddedilir.

Düzeltme yalnız yeni bir olayla yapılır. Önceki çocuk aynı profil, item type, family,
owner, private kapsam ve daha eski zaman damgasında olmalıdır. Sağlık bilgisi
`factKind`, yardım talimatı `instructionKind` alt türünü korur. Böylece bir sağlık
gerçeği başka alt türe veya başka kişiye dönüştürülemez.

## Sağlık verisi ve çıktı sızıntısı

Renderer yalnız allowlist görünümü alır; policy receipt, nonce, correlation, familyId
ve ham veritabanı satırı projekte edilmez. Audit/outbox sağlık türü, telefon, not,
talimat veya konu ayrıntısını taşımaz. Girdiler recursive exact-key denetimiyle
bilinmeyen alan, token/credential, PAN/CVV/PIN, dosya yolu ve base64 içeriğine karşı
fail-closed doğrulanır. Telefon yalnız exact E.164 biçiminde kabul edilir.

## Dış servis, klinik doğrulama ve ağ

Sağlık sicili, klinik sağlayıcı, mesajlaşma, acil servis veya dışa paylaşım servisi
çağrılmaz. `medicalVerification`, `healthRegistryLookup`, `messageDelivery`,
`emergencyServiceContact` ve `exportSharing` değerleri `not_performed`;
`emergencyServiceGuarantee` değeri `not_claimed`, `networkEgressAdded` değeri
`false` kalır. Manuel içerik tıbbi tavsiye veya doğrulanmış sağlık kaydı değildir.
