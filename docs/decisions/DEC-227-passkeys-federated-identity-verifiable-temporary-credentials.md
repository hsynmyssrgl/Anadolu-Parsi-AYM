# DEC-227 — Passkey, federated kimlik ve doğrulanabilir geçici yetki belgeleri

- Tarih: 2026-08-14
- Durum: IN_PROGRESS
- İş adımı: 33-P
- Gereksinimler: B2-02, B6-06, B6-07, EXT-070, EXT-071, EXT-072, EXT-073, EXT-074
- Uygulama gerçeği: PARTIAL_LOCAL_IMPLEMENTATION
- Requirement PASS: false

## Exact kabul sözleşmesi

| Gereksinim | Registry kabul metni |
|---|---|
| B2-02 | Kayıt, assertion, silme, birden çok anahtar, kayıp anahtar kurtarma ve audit var. |
| B6-06 | Yapılandırılmamış sağlayıcı görünmez; canlı hesapla test edilmeden PASS yok. |
| B6-07 | Windows tek ana veri kaynağı; çatışma ve cihaz iptali sözleşmesi. |
| EXT-070 | Tam karar-kod-ekran-test-belge-kanıt zinciri. |
| EXT-071 | Tam karar-kod-ekran-test-belge-kanıt zinciri. |
| EXT-072 | Tam karar-kod-ekran-test-belge-kanıt zinciri. |
| EXT-073 | Tam karar-kod-ekran-test-belge-kanıt zinciri. |
| EXT-074 | Tam karar-kod-ekran-test-belge-kanıt zinciri. |

## Güncel uygulama kararı

Sekiz gereksinim aynı `IdentityAccessCredentialCenterView`, merkezi PEP/UoW, exact family/account/person/device bağı, optimistic revision, idempotency fingerprint ve immutable mutation ledger sınırında ele alınır. Migration 93 `identity_access_credentials`; passkey challenge/credential, yapılandırılmış federated provider/link, geçici credential ve companion snapshot metadata tablolarını fail-closed trigger ve quota sınırlarıyla kurar. Stabil yerel kaynak snapshotındaki migration 93 SHA-256 değeri `51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a` olarak sabitlenmiştir.

Karar, tehdit modeli, scope, inventory, domain, migration, application, repository contract, repository, policy, IPC, UI ve testten oluşan 13 bağlantılı yerel uygulama zinciri mevcuttur. `accepted-scope-registry.json` ise atomik kapanış otoritesidir; starter aşamasında kısmi chain alanları elle yükseltilmez. Bu yüzden registry’deki `NOT_IMPLEMENTED`/`PARTIAL` ve açık `evidence=false` durumu stale kayıt değil, acceptance ile dış/manuel kanıtlar tamamlanana kadar kasıtlı fail-closed kapanış durumudur. Yerel zincirin varlığı `COMPLETE` veya requirement PASS üretmez.

Domain, application, repository contract, SQLite repository, migration, IPC policy/lifecycle, preload/global bridge ve mevcut Güvenlik Merkezi UI yüzeyi uygulanmıştır. Yerel otomatik test ve verifier zinciri gerçek kaynak dosyalarına bağlıdır. Bu yerel kanıt; canlı sağlayıcı, gerçek authenticator, gerçek çapraz cihaz veya insan/review kanıtı yerine geçmez ve requirement PASS üretmez.

## Passkey gerçeği

Kayıt ve assertion challenge’ları kısa süreli, tek kullanımlı, RP/origin/account/device ve security epoch bağlıdır. Renderer WebAuthn çağrısından önce challenge ve retry kimliğini korur; süre dolunca eski töreni atıp yeni kimlik/challenge üretir. Registration yalnız `none` attestation kabul eder; cihaz provenansı veya remote attestation iddiası yoktur. Uygulama biyometrik örnek istemez, yakalamaz veya saklamaz.

Kayıp passkey kurtarma main-process güçlü yeniden doğrulamasına bağlıdır. Windows Hello veya parola/ikinci faktör fallback sırrı renderer pending kaydında saklanmaz. Başarılı kurtarma eski credential yetkisini ve yerel oturum/security epoch bağlarını kapatır; uzak cihaz silme veya MDM işlemi değildir. Gerçek authenticator cihazında kayıt, assertion, çoklu anahtar ve kurtarma kanıtı `NOT_RUN` durumundadır.

## Federated kimlik gerçeği

Apple, Google ve Microsoft yalnız tam ve güvenilir yapılandırma ile production composition içindeki güvenli OIDC ağ adaptörü birlikte hazır olduğunda görünür. Yalnız provider metadata’sının bulunması görünürlük yetkisi vermez. Authorization Code + PKCE S256 + state + nonce töreni, safeStorage/DPAPI korumalı durable flow secret/token vault ve issuer/audience/nonce/imza doğrulayan OIDC adaptörü uygulanmıştır. Token baytları renderer, log, receipt veya SQLite identity tablolarına verilmez.

Güvenli OIDC network/JWKS adaptörü production composition içinde hem code exchange client hem trusted JWKS resolver olarak bağlanmıştır. Provider görünürlüğü yalnız TLS 1.3, public adres, primary/secondary SPKI pin, merkezi egress policy ve bounded response sözleşmesi bulunan `networkReadyProviderRegistrations()` çıktısından gelir; güvenli adaptör olmadan görünürlük `false` kalır. Apple için korumalı client authentication uygulanmadığından Apple provider `unavailable` kalır; public-PKCE Apple desteği gibi sunulamaz. Bu wiring canlı token exchange yapıldığı, sağlayıcı kullanılabilirliğinin doğrulandığı veya canlı hesabın test edildiği anlamına gelmez. `liveAccountTested=true` yalnız gerçek exchange ve imza/issuer/audience/nonce doğrulamasından sonra üretilebilir; `productionReady` yapılandırma metadata’sı canlı hesap kanıtı değildir.

Main-process-only, state-bound ve tek kullanımlık deep-link registry; packaged protocol kaydı, Windows `second-instance`, macOS `open-url`, durable flow binding restore ve main-only `take()` tüketimiyle production main’e bağlanmıştır. Renderer callback metni yetkili girdi değildir ve `COMPLETE` üretmez. Buna karşın gerçek paketlenmiş uygulama/protokol ve canlı provider callback UAT kanıtı `NOT_RUN` kalır.

## Companion protokolü gerçeği

X25519-HKDF-SHA256 + AES-256-GCM envelope, source/security-epoch/device/version/expiry bağları ve salt okunur write-denial sözleşmesi uygulanmıştır. Windows tek yetkili yazardır; companion remote write veya çatışma merge yetkisi kazanmaz.

Production source projection merkezi policy-authorized SQLite repository/UoW içindeki `loadCompanionSourceProjection` üzerinden üretilir; ayrı bir in-memory veya renderer kaynağı yoktur. Recipient X25519 anahtarı exact trusted-device bağıyla yapılandırılmamışsa `Companion X25519 recipient key is unavailable.` hatasıyla fail-closed kalır. Bu nedenle gerçek çapraz cihaz teslimi, rollback/stale-version davranışı ve cihaz iptali gerçek cihazlarla kanıtlanmış değildir. Ağ teslimi veya senkron sürekliliği garanti edilmez.

## Geçici doğrulanabilir credential gerçeği

Okuldan teslim alma, geçici bakım veren, evcil hayvan bakımı, acil kişi sağlık özeti, etkinlik daveti ve geçici ev erişimi türleri uygulanmıştır. Tür başına exact purpose ve disclosure allowlist, zorunlu alanlar, audience hash, not-before/expiry, Ed25519 imza, QR boyut sınırı ve yerel iptal durumu doğrulanır.

Çevrimdışı doğrulama self-contained public key bağıyla imza, süre, exact audience ve eldeki yerel iptal bilgisini ölçer. Dış QR issuer trust yapılandırılmamıştır; yabancı issuer resmi kimlik veya güvenilir kurum olarak sertifikalandırılmaz. Uzak iptal güncelliği, alıcı kabulü, kişinin hukuki kimliği veya yetkinin mevzuata uygunluğu garanti edilmez. Credential verifier UAT `NOT_RUN` durumundadır.

SQLite metadata compaction exact tombstone, reference ve grace pencereleriyle uygulanmıştır: revoked passkey current satırı en az 2 gün, expired temporary credential current satırı en az 7 gün, referanssız mutation en az 7 gün korunur; içeriksiz final digest tombstone’ları 365 gün tutulur. Fail-closed hesap sınırları 4096 mutation, toplam 512 challenge ve 32 aktif challenge, 16 aktif passkey ve current+tombstone toplam 256, 256 aktif/süresi dolmamış temporary credential ve current+tombstone toplam 2048, 256 aktif companion snapshot’tır.

Temporary credential metadata silinmeden önce exact envelope referansı file-first sırayla mantıksal olarak silinir. Envelope deposu en çok 2048 dosyadır; dosya metadata’sı ownerRef, credential digest ve imzalı `createdAt` değerine bağlıdır. Yalnız aynı sahibin DB’de referansı kalmamış ve en az 7 günlük crash orphan dosyası süpürülebilir. Bu yerel lifecycle kontrolü fiziksel güvenli silme, SSD/NTFS üzerinde byte yok etme veya managed backup yayılım garantisi değildir. System-retention yolu owner/time bound’dur ve kalıcı policy receipt ile projection outbox kanıtını korur; merkezi PEP completion veya tam tarihsel/hukuki audit iddiası üretmez. Privacy/legal/identity review `NOT_RUN`, retention riski `OPEN` kalır.

## İdempotency ve sınırlı challenge retention gerçeği

Renderer bir mutasyon kimliği üretmez. Main process cihazın yerel imza anahtarıyla 24 saatlik, en çok 160 karakterlik `iat1` operasyon tokenı üretir; token exact account, device, security epoch ve operation kind bağlarına sahiptir ve yalnız 30 saniyelik gelecek saat sapmasına izin verir. DataStore her begin/complete/mutation çağrısından önce imzayı ve bağları doğrular; süre sonunda `[IDEMPOTENCY_EXPIRED]` ile yeni intent ister. Bu token uygulaması tek başına replay tombstone’larını silme yetkisi vermez ve lifetime retention riskini kapatmaz.

Yalnız consumed veya süresi dolmuş passkey challenge satırları system-only repository context ile 30 günlük startup cutoff ya da hesap başına 512 toplam satır sınırında prune edilir; normal insert bakımı 7 günlük terminal grace uygular. Aynı hesapta en çok 32 aktif challenge bulunabilir ve aktif challenge silinemez. Terminal credential metadata compaction exact tombstone/reference kontrollerine bağlıdır; aktif kayıt, grace içindeki kayıt, tombstone’suz kayıt veya hâlâ referanslı mutation silinemez. Local file-first mantıksal envelope silme uygulanmıştır; fiziksel secure erase, backup propagation ve tarihsel audit-retention review açık olduğundan bu requirement kapanışı değildir.

## Dış kanıt intake gerçeği

33-P dış kanıt paketi için fail-closed intake uygulanmıştır. Paket; sekiz exact kanıt sınıfını, Ed25519 signer public-key fingerprintini, exact Git commit/tree bağını ve her dosyanın canonical göreli yolu, byte boyutu ve SHA-256 değerini doğrular. Signer yalnız kaynakla birlikte yönetişim incelemesinden geçmiş SPKI fingerprint registry’sinde aktifse yetkilidir; komut satırından verilen rastgele veya self-signed anahtar güven otoritesi oluşturmaz. Registry varsayılan olarak `NOT_CONFIGURED` ve sıfır signer içerir. İçerik ayrıca provider, gerçek authenticator, çapraz cihaz, credential verifier, insan UAT ve privacy/legal/identity review alanlarında secret/personal-data taşımayan exact semantik sözleşmeye uymalıdır. İmza, signer otoritesi, kaynak, süre, dosya ya da semantik sapması paketin tamamını reddeder.

İntake self-testinde geçerli paket, byte tamperi, yabancı signer, kriptografik olarak geçerli olsa da trusted registry dışında kalan self-signed paket, yabancı source commit ve süre aşımı sınırları doğrulanır. Bununla birlikte `PASS` yalnız `READY_FOR_GOVERNED_REVIEW` üretir; requirement PASS vermez, registry mutasyonu yapmaz ve persistent receipt yazmaz. actual external evidence `NOT_RUN` durumundadır ve kullanıcıdan bağımsız gerçek cihaz/hesap/reviewer kanıtı olmadan değiştirilemez.

## Otomatik gate ve açık engeller

`verify:33-p:boundary`, `verify:33-p:contract`, `verify:33-p:targeted` ve `verify:33-p:runtime` gerçek production markerlarını ve stabil yerel snapshot için exact 19 dosya / en az 116 test ratchetini fail-closed ölçer. Migration 93 kaynak hash’i de exact sabitlenir. Her test, dosya, hash veya marker sapması ilgili artifact’ı `FAIL` yapar. Gate’in yerel olarak PASS olması aşağıdaki engelleri kapatmaz:

- production pinned network/JWKS wiring: `IMPLEMENTED_LOCAL`; network-ready Google/Microsoft yapılandırması ve canlı hesap testi: `NOT_RUN`; Apple protected client authentication: `unavailable`;
- main-only deep-link production wiring: `IMPLEMENTED_LOCAL`; packaged protocol ve canlı provider callback UAT: `NOT_RUN`; renderer manual callback: `COMPLETE değil`;
- gerçek platform authenticator cihazı: `NOT_RUN`;
- production repository source projection: `IMPLEMENTED_LOCAL`; recipient key configuration ve gerçek çapraz cihaz iptal/rollback: `NOT_RUN`;
- dış QR issuer trust: `NOT_CONFIGURED`; credential verifier, insan, gizlilik, hukuk ve kimlik UAT/review: `NOT_RUN`;
- local file-first mantıksal envelope silme, owner-bound 7 günlük orphan sweep ve metadata compaction: `IMPLEMENTED_LOCAL`; fiziksel secure erase, backup propagation ve privacy/legal/identity retention review: `NOT_RUN`; lifetime retention/destruction politikası: `OPEN`;
- persistent receipt, source protection ve Git/GitHub eşitliği: `NOT_RUN`.

## Dürüst iddia sınırı

- Remote attestation, uzak teslim, provider availability, senkron teslimi veya revocation delivery garantisi yoktur.
- Uygulama biyometrik veri yakalamaz veya saklamaz.
- Yerel kriptografik imza resmi kimlik, hukuk, gizlilik veya sağlayıcı sertifikasyonu değildir.
- Windows companion verisinin tek yazarıdır; ağ üzerinden teslim edilmiş sayılmaz.
- Bütün gereksinimler registry’de açık, governance state `IN_PROGRESS` ve `countsAsRequirementPass=false` kalır.
- Prepare/finalize/completion scripti bu aşamada yoktur; bu belge `COMPLETE` veya persistent receipt iddiası değildir.
