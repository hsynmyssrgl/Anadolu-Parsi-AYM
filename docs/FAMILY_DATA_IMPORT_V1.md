# Anadolu Parsı Aile Verisi İçe Aktarma Şeması v1

**Aktif sürüm:** 02.08.2026.228

## Dosya sınırı

- Kodlama: katı UTF-8
- Biçim: JSON nesnesi
- Uzantı: `.json`
- Azami boyut: 25 MiB
- `schemaVersion`: yalnız `1`
- Kimlikler: dosya içinde benzersiz, 1–128 karakter

Kök nesne yalnız şu alanları kabul eder:

`schemaVersion`, `exportId`, `createdAt`, `family`, `people`, `relations`,
`locations`, `events`.

## Kök alanlar

| Alan | Tür | Kural |
|---|---|---|
| `schemaVersion` | sayı | Tam olarak `1` |
| `exportId` | metin | Paketi benzersiz tanımlayan 1–128 karakter |
| `createdAt` | ISO tarih-saat | Kaynağın oluşturulma zamanı |
| `family.name` | metin | Kaynak aile adı; hedef aileyi değiştirmez |
| `people` | dizi | En fazla 10.000 kayıt |
| `relations` | dizi | En fazla 20.000 kayıt |
| `locations` | dizi | En fazla 10.000 kayıt |
| `events` | dizi | En fazla 20.000 kayıt |

## Kişi

Zorunlu: `id`, `displayName`, `relationshipType`, `generation`.

İsteğe bağlı: `birthDate` (`YYYY-AA-GG`), `branch` (varsayılan `Ana Dal`),
`status` (`active`, `inactive`, `deceased`; varsayılan `active`).

Mevcut kişi eşleşmesi normalize edilmiş `displayName + birthDate` anahtarıyla
belirlenir. Eşleşen kayıt değiştirilmez; yalnız yeniden kullanılır.

## Aile bağı

Zorunlu: `id`, `fromPersonId`, `toPersonId`, `relationType`.

`relationType`: `parent`, `spouse`, `child`, `sibling`, `guardian`, `other`.
Her iki kişi kimliği de aynı dosyanın `people` dizisinde bulunmalıdır. Öz-bağ
reddedilir.

## Konum

Zorunlu: `id`, `label`.

İsteğe bağlı: `address`, `latitude`, `longitude`, `kind`.
`kind`: `venue`, `residence`, `memory`, `other`.
Enlem `-90..90`, boylam `-180..180` aralığındadır.

Mevcut konum eşleşmesi normalize edilmiş `label + address` anahtarıyla yapılır.

## Etkinlik

Zorunlu: `id`, `title`, `startAt`.

Desteklenen alanlar: `kind`, `description`, `locationId`, `locationLabel`,
`visibility`, `participantPersonIds`, `invitationText`, `notes`,
`aiProcessingAllowed`, `recurrence`, `reminderDays`.

- `visibility`: `personal`, `selected_members`, `family`
- `recurrence`: `none`, `yearly`
- `reminderDays`: 0–365 arasında en fazla 20 benzersiz tam sayı
- Katılımcılar 1–128 karakterlik benzersiz metin kimlikleri olmalı ve aynı dosyanın `people` dizisinde bulunmalıdır.
- `locationId` aynı dosyanın `locations` dizisinde bulunmalıdır.
- `aiProcessingAllowed` verilirse yalnız boolean (`true`/`false`) kabul edilir.
- İsteğe bağlı metin alanlarında yanlış türler sessizce atlanmaz; doğrulama hatası oluşturur.

Mevcut etkinlik eşleşmesi normalize edilmiş `title + startAt` anahtarıyla yapılır.

## Uygulama ve geri alma

Ön izleme hiçbir veriyi yazmaz. Uygulama için yönetici parolası ve etkinse ikinci
faktör gerekir. Kaynak dosya veya aile verisi ön izlemeden sonra değişirse işlem
reddedilir. Başarılı batch 24 saat içinde geri alınabilir; ancak sonradan bağlanan
kayıtlar varsa geri alma engellenir.

Örnek dosya: `docs/examples/anadolu-parsi-family-import-v1.example.json`.
