# 34-D Açık Rızalı Kayıt ve Medya Saklama Tehdit Modeli

## Korunan varlıklar

- Kayıt isteği, aydınlatma sürümü ve katılımcı rıza kararları.
- Geri çekme, sonradan katılma, on-record/off-record ve saklama politikası metadata'sı.
- PEP receipt/fence, mutation/consent/segment/event ledger, audit ve outbox bütünlüğü.
- Gelecekte üretilecek ses, video, transkript ve çeviri medyası; mevcut sürüm bu byte'ları üretmez.

## Güven sınırları

- Renderer medya yakalama, provider, ağ, dosya yolu, anahtar, imza veya deletion authority değildir.
- DataStore yalnız merkezi Life PEP, payload-free repository resolver ve aynı SQLite transaction üzerinden yazım yapar.
- Katılımcı rızası yalnız authenticated kişinin kendi participant satırına yazılabilir.
- On-record isteği gerçek capture, kırmızı gösterge veya sesli duyuru kanıtı değildir.

## Tehditler ve kontroller

| Tehdit | Kontrol | Kalan risk |
|---|---|---|
| Varsayılan açık veya rızasız kayıt | Şema default-off, self-consent triggerı ve capture alanları zorunlu `0` | Gerçek capture provider'ı yok |
| Başka katılımcı adına rıza | Mutation actor ile participant person exact eşliği | Harici kimlik/hukuk UAT yapılmadı |
| Geç katılan kişiyi atlama | Pending consent ve `paused_for_joiner` geçişi | Gerçek medya durdurma kanıtı yok |
| Red veya geri çekmeye rağmen kaydı sürdürme | Request `off_record`, segment capture false | Üretim recorder entegrasyonu yok |
| Renderer'ın medya veya ağ yetkisi enjekte etmesi | Sekiz exact kanal, recursive input ve safe-result doğrulaması | Main-process recorder provider yok |
| Replay veya revision atlama | Unique operation, request fingerprint, optimistic revision, state fingerprint ve mutation/current trigger bağı | Yaşam boyu retention/prune politikası yok |
| Audit/outbox üzerinden konuşma sızıntısı | Yalnız mutation kind, resource id ve revision | Harici privacy/security review `NOT_RUN` |
| Retention metadata'sının fiziksel silme sayılması | Truth alanlarında expiry execution ve secure physical deletion false | Backup propagation ve secure erase yok |
| Çocuk rızasının yetişkin gibi kabulü | Minor/unknown age fail-closed; guardian policy false | Veli/uzman/hukuk politikası yok |
| Kırmızı gösterge ve sesli duyurunun sahte gösterilmesi | UI açıkça kayıt başlamadı der; active indicator üretilmez | Gerçek cihaz accessibility UAT yok |

## Fail-closed ve no-claim sınırları

Central policy, owner/participant eşliği veya geçerli optimistic revision yoksa yazım ilerlemez. Production recording provider, gerçek medya capture, E2EE recorder rolü, encrypted media vault, hash/imza, access history, secure physical deletion, retention executor veya guardian/legal policy yoksa bunlar uygulanmış sayılmaz. Ağ kullanılmaz.

## Açık kanıtlar

Gerçek audio/video, transcript/translation, kırmızı gösterge, sesli duyuru, late-joiner gerçek durdurma, E2EE recorder, media vault/hash/imza, erişim geçmişi, secure erase/backup propagation, retention execution, çocuk/veli/hukuk politikası ile privacy, legal, security ve accessibility incelemeleri `NOT_RUN` durumundadır.
