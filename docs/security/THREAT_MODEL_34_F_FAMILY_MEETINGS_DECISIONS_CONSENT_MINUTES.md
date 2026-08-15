# 34-F Tehdit Modeli — Aile toplantıları ve rızaya bağlı tutanaklar

Durum: PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE
Requirement kabulü: false

## Korunan varlıklar

- Toplantı planı, katılımcı rolleri, gündem, oylama, karar ve görev bütünlüğü
- Kayıt talebi ile katılımcı açık rıza kanıtının eşliği
- İnsan onaylı toplantı tutanağının plaintext ve şifreli artefaktı
- PEP receipt/fence/projection, mutasyon, olay, audit ve outbox bütünlüğü
- Renderer'ın owner, dosya, hash, receipt, provider, ağ veya cloud yetkisi kazanmaması

## Tehditler ve kontroller

1. Çapraz sahip veya aile erişimi: account, person, family ve owner eşliği policy resolver, repository sorgusu, receipt triggerı ve tutanak kasasında zorunludur.
2. Policy bypass: payload-free `resolvePolicyResource`, merkezi Life PEP ve writable receipt olmadan current veya ledger yazımı fail-closed reddedilir.
3. Replay/revision atlama: aynı `clientOperationId` farklı fingerprint ile çatışır; current meeting, participant, agenda, task ve minutes satırı exact önceki revision ile ilerler.
4. Karar veya oy geçmişinin değiştirilmesi: anket tanımı, oy, karar ve işbirliği referansları UPDATE/DELETE triggerlarıyla append-only tutulur.
5. Onaysız AI tutanağı: kayıt talebi, transcript retention ve her katılımcının açık rızası doğrulanmadan AI hazırlığı başlamaz.
6. Sahte AI başarısı: production provider yapılandırılmadığı için sonuç `provider_unavailable`; `networkUsed=false` ve `cloudUsed=false` zorunludur.
7. Onaysız final tutanak: sealed local state yalnız `humanApproved=true`, geçerli katılımcı erişim kümesi ve doğrulanmış artefakt readback'iyle yazılır.
8. Plaintext sızıntısı: SQLite yalnız sealed reference, SHA-256, boyut ve provider kanıtı taşır; plaintext ayrı şifreli vault'tadır ve geçici buffer'lar temizlenir.
9. Dosya sistemi kaçışı ve overwrite: ayrı gerçek kök, symlink/realpath/nlink kontrolü, 0600 temporary, fsync, hard-link no-overwrite publish ve byte/hash readback uygulanır.
10. Renderer yetki genişlemesi: on dört exact kanal; recursive plain-object, extra key, prototype/accessor/symbol, path/credential/PAN, derinlik ve boyut reddi; durable writes non-cancellable'dır.
11. Transaction parçalanması: repository, audit veya outbox hatası mutation/current/event zincirini birlikte rollback eder; artefakt publish hatası metadata'yı başarıya çeviremez.
12. Kalıcı kota DoS'u: toplantı ve alt kayıt kotaları ile vault 4096 dosya/512 MiB sınırı vardır; mutation ledger için güvenli yaşam boyu compaction henüz yoktur.

## Açık riskler

- Production AI minutes provider ve gerçek provider kalite/mahremiyet kanıtı yoktur.
- Harici takvim, gerçek hatırlatıcı teslimi, uzaktan işbirliği ve belge yükleme yoktur.
- Gerçek çok katılımcılı kayıt rızası, rol, erişim ve revocation UAT yapılmadı.
- Tutanak retention expiry, orphan sweep, backup propagasyonu ve fiziksel güvenli silme kanıtı yoktur.
- 4096 mutation satırı yaşam boyu kota kilidi oluşturabilir; güvenli idempotency retention sözleşmesi tasarlanmamıştır.
- Gizlilik, hukuk, güvenlik, erişilebilirlik ve retention incelemeleri `NOT_RUN` durumundadır.

Bu açıklar kapanmadan requirement PASS, AI doğruluğu, teslimat, dış takvim entegrasyonu, uzaktan işbirliği veya sertifikasyon iddiası üretilemez.
