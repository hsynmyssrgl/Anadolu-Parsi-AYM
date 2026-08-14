# 33-N Taslak ve Asenkron Durum UX Tehdit Modeli

- Durum: COMPLETED
- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION

## Kapsam ve varlıklar

Korunan varlıklar; kullanıcının henüz göndermediği form girdisi, yetkili current draft, immutable mutation geçmişi, hesap/aile/kişi ayrımı, policy receipt bağı, optimistic revizyon, idempotency kimliği, canlı doğrulama odağı ve ekran durumunun doğruluğudur.

## Tehditler ve kontroller

| Tehdit | Kontrol |
|---|---|
| Renderer doğrudan SQLite'a yazar veya PEP'i atlar | Yalnız typed preload/IPC çağrısı; merkezi `form_draft` PEP ve aynı SQLite UoW zorunludur. |
| Yabancı hesap, aile veya kişi taslağı okunur/yazılır | Exact subject/resource bağı, aktif hesap ve kişi triggerları ile repository kontrolleri fail-closed çalışır. |
| Stale istemci daha yeni taslağı ezer | `expectedRevision` ve migration 91 optimistic revision triggerı zorunludur. |
| Aynı işlem farklı içerikle tekrar oynatılır | `clientOperationId` canonical request fingerprint'e bağlıdır; mismatch reddedilir. |
| Geri alma geçmişi değiştirir veya keyfi revizyona döner | Mutation satırları immutable'dır; undo yalnız hemen önceki revizyonu yeni revizyon olarak geri yükler. |
| Sahte, eski veya başka kaynağa ait policy receipt kullanılır | Receipt hash/nonce/correlation/resource/action/capability/subject/time ve writable fence exact bağlanır. |
| PEP kararı ile commit arasında yetki değişir | Transaction-time revalidation ve writable fence aynı UoW içinde kontrol edilir. |
| Geç tamamlanan promise yeni route veya oturum UI'ını bozar | `AsyncWriteGuard` kapsam/epoch/sequence bileti; route, hesap ve oturum geçişinde invalidation. |
| Duplicate/out-of-order sonuç revizyonu geriye götürür | Mutation kimliği dedup ve monoton `MutationRevisionWatermark`. |
| Canlı doğrulama girdiyi siler veya odağı kaybettirir | Girdi korunur; hata özeti, alan bağlantısı, ilk geçersiz alana odak ve `aria-live` duyurusu zorunludur. |
| Loading/offline/error görünümü boş veya başarı görünümüyle karışır | Ayrık `empty/loading/offline/error/retry` modeli, metinsel durum ve belirgin retry eylemi kullanılır. |
| Payload kaynak tüketimi veya prototype pollution üretir | 64 KiB sınırı, düz JSON object, izinli anahtar/alan doğrulaması ve prototype anahtar reddi. |
| Offline kopya yeni yetki kaynağı olur | Offline yüzey yalnız durumu ve güvenli retry'ı sunar; merkezi taslak kaydının yerini alan yetkisiz persistence yoktur. |

## Zorunlu negatif testler

- Boş/kötü biçimli/aşırı büyük payload ve `__proto__`, `prototype`, `constructor` anahtarları reddedilir.
- Geçersiz `formKey`, stale revizyon, duplicate operation mismatch ve illegal undo reddedilir.
- Yabancı aile/hesap/kişi ile forged, expired veya wrong-resource receipt reddedilir.
- PEP-to-commit fence yarışı rollback üretir; mutation/current row/audit/outbox kısmi kalmaz.
- Route veya oturum değişiminden sonra eski async sonuç commit edilmez; duplicate ve out-of-order mutation revizyonu geri götürmez.
- Error summary alan bağlantısı, ilk geçersiz alan odağı, canlı duyuru ve retry erişilebilir adı yoksa UI testi başarısız olur.
- Her durum yalnız renge dayanmadan `empty`, `loading`, `offline`, `error`, `retry` semantiği taşır.

## Artık risk

Kaynak ve jsdom otomasyonu gerçek ağ kesintisi zamanlamalarının, Windows Narrator/Magnifier davranışının, gerçek cihazın veya insan UAT akışlarının tamamını kanıtlamaz. Bu manuel kanıtların her biri `NOT_RUN` ve `certificationClaimed=false` kalır; dolayısıyla sertifikasyon iddiası kurulmaz. Kaynak, güvenlik, test, build ve kalıcı receipt kapıları ayrı olarak PASS olduğunda otomatik uygulama kapanışı `COMPLETE` olabilir; bu durum manuel kanıtların çalıştırıldığı anlamına gelmez.
