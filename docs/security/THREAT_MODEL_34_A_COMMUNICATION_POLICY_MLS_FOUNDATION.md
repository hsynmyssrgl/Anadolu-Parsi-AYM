# 34-A — İletişim politika çekirdeği ve MLS güvenlik temeli tehdit modeli

## Korunan varlıklar

- Aile, hesap, kişi sahibi ve mevcut güvenilir cihaz kimliği.
- Oda, üyelik, cihaz credential metadata'sı ve monoton MLS epoch zinciri.
- Merkezi PEP receipt, cluster fence, policy projection, immutable mutation ve epoch ledgerları.
- Sağlayıcı imza anahtarının public güven penceresi ve canonical kanıt zarfı.
- Yeni üyenin geçmişe varsayılan erişememesi ve kayıp cihaz sonrası açık rekey state machine'i.

## Tehditler ve kontroller

1. **Sahte sağlayıcı kanıtı:** Exact canonical JSON Ed25519 ile doğrulanır. Bilinmeyen, duplicate, zamanı bozuk veya pencere dışında anahtar; yanlış cipher suite, resource, epoch, membership digest ya da provider kimliği fail-closed reddedilir.
2. **Renderer anahtar veya mesaj otoritesi:** IPC exact-key ve safe-result doğrulaması uygular. Private key, key package, sealed reference, hash, receipt, token, mesaj, relay ve ağ alanları renderer'a kapalıdır.
3. **Yabancı sahip veya cihaz:** Tüm current ve ledger satırları exact family/account/owner ile; cihaz credential'ı ayrıca aktif `trusted_devices` satırı ve güncel security epoch ile bağlanır.
4. **Replay ve yarış:** `clientOperationId`, request fingerprint, optimistic revision, immutable mutation ledger ve current-row last-mutation bağı zorunludur. Downstream audit/outbox hatası tüm transaction'ı geri alır.
5. **Yeni üyeye geçmiş sızıntısı:** Varsayılan `new_members_no_history` ve joined-at epoch kaydı zorunludur. `explicit_snapshot_grant` yalnız politika kararıdır; bu pakette mesaj içeriği aktarmaz.
6. **İptal edilmiş cihazla epoch ilerletme:** Aktif üyelikte revoked credential bulunursa add/remove gibi epoch mutasyonları reddedilir. Yalnız açık kayıp-cihaz rekey komutu etkilenen üyeliği kaldırıp yeni sağlayıcı kanıtı kaydedebilir. Otomatik rekey iddiası yoktur.
7. **Metadata ve relay gerçeğinin abartılması:** Audit/outbox içeriksizdir ve UI mesaj sayısını sıfır gösterir. Fakat gerçek relay, trafik analizi, grup kimliği maskeleme veya ağ teslimi uygulanmadığı için SEC-COM-005/006 kapanmaz.
8. **Kriptografik güvenliğin abartılması:** Kanıt imzası doğrulaması bir MLS provider implementation veya RFC 9420 conformance değildir. İleri gizlilik ve saldırı sonrası güvenlik yalnız gerçek multi-device provider/UAT ile kanıtlanabilir.

## Açık kanıtlar

Production RFC 9420 sağlayıcısı, conformance suite, gerçek çok cihazlı forward secrecy/post-compromise security, kayıp cihaz recovery, mesaj/ek/tepki/düzenleme imzası, relay içerik körlüğü, ağ teslimi, trafik analizi, retention/privacy/legal/security incelemeleri `NOT_RUN` durumundadır. Özel anahtar ve sealed MLS state için üretim kasası bu pakette compose edilmemiştir. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `34-A` yalnız kısmi yerel metadata ve policy temelidir; `countsAsRequirementPass=false` kalır.
