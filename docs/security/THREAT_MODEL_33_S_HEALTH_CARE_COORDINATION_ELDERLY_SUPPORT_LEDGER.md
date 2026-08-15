# 33-S tehdit modeli — sağlık koordinasyonu ve yaşlı desteği günlüğü

## Korunan varlıklar

- Kişi bağlı sağlık/bakım kayıtları ve acil özet görünümü
- Bakım veren minimum-gerekli kapsamları ve iptal geçmişi
- Family/account/owner/resource sınırı ile PEP receipt/fence/projection kanıtı
- İçerik taşımayan audit/outbox ve immutable mutation kimliği

## Tehditler ve kontroller

### Çapraz sahip veya aile kaydı

Repository exact center, family, owner ve receipt subject bağını zorunlu kılar. Yabancı owner/account/family, forged receipt veya resource mismatch fail-closed reddedilir. Renderer family/account/owner authority almaz.

### Rol adından geniş sağlık erişimi

Direct role authorization yasaktır. Veri sahibi dışındaki görünürlük ve kayıt yetkisi etkin, süreli, exact account/person bağlı grant’in `allowedScopes` ve `actions` kesişiminden gelir. Açık deny grant iptalinde yazılır; genel sağlık erişimi oluşmaz.

### Replay, stale revision veya yarım commit

Client operation kimliği request fingerprint ile bağlıdır; aynı kimlikle farklı istek reddedilir. Current row exact expected revision ve last mutation ilişkisini taşır. Mutation, current, entry/grant, object permission, audit ve outbox tek transaction içinde yazılır; downstream hata tam rollback üretir.

### Acil özet üzerinden metadata sızıntısı

Acil özet yalnız renderer-safe entry view’larından oluşturulur. Family, account, actor person, mutation kimliği, state/request fingerprint ve PEP receipt UI/IPC sonucuna taşınmaz. Caregiver görünümü yalnız granted scope’ları içerir.

### Sağlık iddiası veya sahte dış yardım

Kayıtlar kullanıcı gözlemi ve yerel koordinasyon verisidir. Tıbbi doğrulama, sağlık registry sorgusu, sensör tespiti, acil servis araması, uzaktan yardım veya yardım teslimi yapılmış gibi gösterilmez. UI bu sınırı açıkça yazar.

### Ölçüm ve büyük payload istismarı

Entry kind/status/scope/action enum’ları exact’tır; kimlikler, başlık, not, birim, tarih, sayısal değerler, array/nesting ve IPC toplam boyutu sınırlıdır. NaN/sonsuz/negatif ölçüm, prototype/accessor/symbol/secret/path/PAN ve extra key fail-closed reddedilir.

### Statik gate’i runtime yetkisi sanma

PPK-021/022 yalnız build/runtime surface ratchet’idir. Her repository erişiminde merkezi PEP/UoW receipt’i zorunludur; allowlist veya capability manifest tek başına sağlık verisi yetkisi vermez.

## Açık riskler

- Gerçek bakım veren ve yaşlı kullanıcı UAT yapılmamıştır.
- Medikal uzman, erişilebilirlik, gizlilik, hukuk ve bağımsız güvenlik incelemesi `NOT_RUN` durumundadır.
- Sensör adapteri, acil iletişim teslimi ve uzaktan yardım üretim authority’si yoktur.
- Saklama süresi, kaynak silme/yedek yayılımı ve fiziksel secure erase kabulü tamamlanmamıştır.
- 33-O, 33-N ve aktif 33-P atomik yönetişim zincirleri kapanmadan 33-S gereksinim PASS sayılmaz.

Bu açıklar nedeniyle yerel teknik testler geçse bile certification veya production acceptance iddiası yapılmaz.
