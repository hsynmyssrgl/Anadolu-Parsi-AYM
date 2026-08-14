# 33-P / DEC-227 passkey, federated kimlik ve geçici yetki belgesi tehdit modeli

- Durum: IN_PROGRESS
- Uygulama gerçeği: PARTIAL_LOCAL_IMPLEMENTATION
- Requirement PASS: false
- Dış/manuel kanıt: NOT_RUN

| Tehdit | Uygulanan fail-closed kontrol | Kalan kanıt / risk |
|---|---|---|
| Sahte veya tekrar kullanılan passkey challenge kabul edilir | Tek kullanımlık challenge, exact hesap/RP/origin/işlem bağı, 300 saniye TTL, replay fingerprint ve atomik tüketim. | Gerçek authenticator cihazı `NOT_RUN`. |
| Yanlış hesap ya da cihaz assertion ile yetki kazanır | Exact family/account/person/device, trusted-device, security epoch ve merkezi PEP/UoW kararı. | Gerçek çoklu cihaz UAT `NOT_RUN`. |
| Credential ID ile kayıt kimliği karışır | Renderer challenge credential ID’sini SHA-256 metadata ile exact eşleştirir; verifier raw credential/public key bağını doğrular. | Gerçek platform varyantları `NOT_RUN`. |
| Kayıp anahtar kurtarma mevcut güvenliği düşürür | Main-process Windows Hello veya parola/2FA fallback, eski credential iptali, security epoch/oturum kapatma ve immutable audit. Renderer fallback sırrını pending ref’te saklamaz. | Gerçek kayıp cihaz kurtarma UAT `NOT_RUN`; remote wipe/MDM yok. |
| Uygulama biyometrik veri veya cihaz provenansı topladığı izlenimi verir | Uygulama biyometrik örnek istemez/yakalamaz/saklamaz; registration yalnız `none` attestation kabul eder. | Remote attestation yapılmaz ve garanti edilmez. |
| OAuth redirect login-CSRF veya code interception üretir | Authorization Code + PKCE S256, state, nonce, exact redirect URI, issuer/audience ve tek kullanımlık flow bağı. Main-only deep-link registry unknown/duplicate/expired callback’i reddeder; packaged protocol, `second-instance`/`open-url`, durable binding restore ve main-only `take()` production’a bağlıdır. | Gerçek packaged protocol ve canlı provider callback UAT `NOT_RUN`; renderer manual callback yetkili değildir ve `COMPLETE` sayılmaz. |
| Yapılandırılmamış veya güvenli ağ adaptörüne bağlanmamış sağlayıcı görünür ya da çalışır | Trusted tam config resolver, provider allowlist ve varsayılan deny; production güvenli ağ bağlantısı yoksa visibility `false`. | Canlı provider account testi `NOT_RUN`; Apple protected client authentication `unavailable`. |
| Verified flow farklı provider configuration ile replay edilir | configurationId, authorizationEndpoint SHA-256 ve clientConfiguration SHA-256 link öncesi exact karşılaştırılır; sapma transaction’ı reddeder. | Başarısız yeni vault entry cleanup testi runtime gate’te zorunludur. |
| Token renderer, log, receipt veya plaintext diske sızar | safeStorage/DPAPI korumalı durable vault, opaque entryId, content-free IPC ve renderer token yasağı. | Production provider exchange yapılmadı. |
| Sağlayıcı erişilemediği halde federasyon PASS sayılır | Production code exchange/JWKS yalnız pinned secure network adaptöründen geçer; `providerAvailabilityVerified=false`, `liveProviderAccountTestPerformed=false`. | Network-ready yapılandırma ve canlı hesap/ağ kanıtı `NOT_RUN`. |
| Mobil istemci Windows kaynağını değiştirir | Companion yalnız merkezi policy-authorized SQLite `loadCompanionSourceProjection` kaynağından, X25519-HKDF-SHA256 + AES-256-GCM şifreli, sürümlü ve salt okunur üretilir; write isteği reddedilir. | Recipient key configuration ve gerçek cross-device UAT `NOT_RUN`. |
| Eski veya iptal edilmiş cihaz snapshot okur | Exact trusted-device, account, security epoch, source version, expiry ve recipient public-key bağı. | Gerçek çapraz cihaz iptal/lease kanıtı `NOT_RUN`. |
| Sync çatışması veya rollback güncel veriyi eski gösterir | Monoton sourceVersion, knownSourceVersion stale denial ve Windows single-writer sözleşmesi. | Gerçek rollback/stale-device UAT `NOT_RUN`; ağ teslim garantisi yok. |
| Geçici belge gereğinden fazla sağlık/kimlik verisi açıklar | Tür bazlı exact minimum disclosure allowlist, en çok sekiz alan, exact audience ve purpose. | Gizlilik review ve verifier UAT `NOT_RUN`. |
| Süresi dolmuş veya iptal edilmiş belge geçerli görünür | Zorunlu not-before/expiry, Ed25519 imza, yerel revocation kaydı ve offline karar durumları. | Uzak iptal bilgisinin güncelliği garanti edilmez. |
| QR başka bağlamda yeniden kullanılır | Nonce, credential ID, owner/audience/purpose hash, süre ve disclosure hash imzalı payload’a bağlıdır. | QR tek başına kimlik kanıtı değildir. |
| Self-contained QR içindeki public key güvenilir kurum kimliği gibi yorumlanır | İmza/keyId bağı kriptografik bütünlüğü ölçer; issuer identity certification her zaman false ve yabancı issuer trust fail-closed belirsizdir. | Dış QR issuer trust `NOT_CONFIGURED`; external verifier UAT `NOT_RUN`. |
| Geçici credential’ın şifreli envelope’u veya replay geçmişi gereğinden uzun tutulur | İçerik cihaz korumasıyla şifrelenir, opaque reference kullanılır. Exact content-free tombstone/reference kontrolleriyle revoked passkey current için 2 gün, expired temporary current ve referanssız mutation için 7 gün grace; tombstone için 365 gün retention uygulanır. Mutation toplamı 4096, temporary current+tombstone toplamı 2048 ve aktif/süresi dolmamış temporary satırı 256 ile sınırlıdır. Metadata silinmeden önce exact envelope file-first mantıksal silinir; ownerRef + credential digest + imzalı createdAt bağlı depo 2048 dosyayla sınırlıdır ve yalnız aynı sahibin 7 günlük referanssız crash orphan’ı süpürülür. | Fiziksel secure erase, managed backup propagation ve privacy/legal/identity audit-retention review kanıtlı değildir; risk `OPEN` kalır. |
| Yerel imza hukuki veya kimlik sertifikası gibi sunulur | UI/domain truth değerleri ve no-claim metinleri; `identityCertificationClaimed=false`, `legalCertificationClaimed=false`, `privacyCertificationClaimed=false`. | Hukuk/kimlik/gizlilik review `NOT_RUN`. |
| Otomatik test sonucu dış kanıt yerine kullanılır | Runtime report ayrı `governanceState=IN_PROGRESS` ve `countsAsRequirementPass=false` üretir. | Canlı/gerçek cihaz/insan kanıtları olmadan requirement açık kalır. |
| Yerel 13 bağlantılı uygulama zinciri registry kapanışı gibi yorumlanır | Scope/inventory yerel implementation zincirini ayrı kaydeder; accepted-scope registry atomik kapanış otoritesidir ve starter kısmi chain alanlarını yükseltmez. | Registry `NOT_IMPLEMENTED`/`PARTIAL`, `evidence=false` ve requirement PASS=false durumu acceptance ile dış/manuel kanıt tamamlanana kadar kasıtlıdır. |
| Renderer sınırsız veya başka bağlama taşınabilir idempotency kimliği üretir | Main-only Ed25519 imzalı `iat1` tokenı account/device/security-epoch/operation-kind bağı ve 86400 saniye lifetime ile üretilir; yanlış bağ fail-closed, süre sonu `IDEMPOTENCY_EXPIRED` olur. | Token lifetime tek başına mutation/credential geçmişini silme yetkisi vermez. |
| Challenge tablosu zamanla dolar ya da aktif tören yanlışlıkla silinir | Yalnız consumed/expired challenge satırları system-only context ile 30 günlük startup cutoff veya 512 toplam satır sınırında prune edilir; insert bakımı 7 günlük terminal grace uygular, aktif satır kotası 32’dir ve aktif challenge silinemez. | System-retention owner/time bound’dur ama merkezi PEP completion değildir; tam audit retention riski `OPEN` kalır. |
| Yedi günlük mutation compaction tam tarihsel audit gibi sunulur | UI/domain no-claim sınırı ve yönetişim `fullHistoricalAuditRetentionClaimed=false`; final digest tombstone yalnız teknik replay/integrity bağıdır. System-retention current/challenge/tombstone referanslarını korur ve kalıcı policy receipt ile projection outbox kayıtlarını silmez. | B2-02 tarihsel audit kapsamı ile privacy/legal/identity retention review `NOT_RUN`; merkezi PEP completion veya requirement PASS üretmez. |

## Fail-closed otomatik negatif matris

Yerel gate; wrong account/device/RP/origin, replay ve expired challenge, clone counter, stale security epoch, deleted credential, forged receipt, configuration drift, PKCE/state/nonce/issuer/audience/imza sapması, plaintext token, renderer token sızıntısı, remote write, stale snapshot, over-disclosure, wrong audience/purpose, expired/revoked QR, unknown issuer, tamper, oversized payload, foreign-owner envelope deletion, crash orphan ve kimlik/hukuk overclaim senaryolarını gerçek source/test markerlarıyla ölçer. Stabil yerel snapshot exact 19 test dosyası ve en az 116 test ile migration 93 SHA-256 `51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a` ratchetine bağlıdır; tek sapma ilgili artifact’ı `FAIL` yapar. Bu yerel ratchet requirement kapanış baseline’ı değildir.

## Production fail-closed bağları

- Güvenli OIDC network/JWKS adaptörü production composition’a bağlıdır; yalnız `networkReadyProviderRegistrations()` görünür olabilir. Wiring canlı provider/account availability kanıtı değildir.
- Apple protected client authentication uygulanmadığından Apple provider `unavailable` kalır.
- Main-only deep-link registry production main’e bağlıdır; packaged protocol ve canlı provider callback UAT `NOT_RUN`, renderer manual callback yolu yetkili değildir.
- Companion source projection merkezi policy-authorized SQLite repository/UoW üzerinden uygulanmıştır; exact recipient key yoksa `Companion X25519 recipient key is unavailable.` ile fail-closed kalır.
- Dış QR issuer trust `NOT_CONFIGURED`; external verifier UAT `NOT_RUN` ve temporary credential lifetime retention riski `OPEN`.
- Yapılandırılmış provider metadata’sı canlı hesap veya provider availability kanıtı değildir.
- X25519 envelope testleri gerçek çapraz cihaz teslimi kanıtı değildir.
- WebAuthn yazılım testleri gerçek platform authenticator kanıtı değildir.

## Artık risk ve iddia sınırı

Canlı sağlayıcı hesabı, gerçek authenticator, çapraz cihaz, credential verifier, insan UAT, privacy review, legal review ve identity review `NOT_RUN` durumundadır. Remote attestation, remote delivery, provider availability, sync delivery veya revocation delivery garanti edilmez. Uygulama biyometrik veri yakalamaz veya saklamaz. Yerel kriptografik doğrulama resmi kimlik, hukuk, sağlayıcı ya da gizlilik sertifikasyonu değildir. 33-P bu engeller ve persistent receipt zinciri kapanmadan `IN_PROGRESS` ve `countsAsRequirementPass=false` kalır.
