# PPK-024 Policy Service availability tehdit modeli

Durum: `VALIDATED / COMPLETE`

## Korunan varlıklar

- Hassas aile verisi okuma ve mutation callback'leri.
- Core Service'in HMAC ile imzalanmış policy paketi, sürüm/hash bağı ve karar otoritesi kimliği.
- PEP allow/deny receipt zinciri, cluster write fence ve repository işlem kapsamı.
- IPC sonuç cache'i, PPK-012 hassas offline cache'i ve bootstrap erişim yüzeyi.
- Korumalı Core Service connection authority, authentication token ve Desktop vault sınırı.

## Güven sınırları

1. Renderer → sandbox preload → typed Electron IPC.
2. Desktop main → ortak universal API availability kapısı → Platform PEP.
3. Desktop main → authenticated local named pipe/socket → Windows Core Service.
4. Core Service runtime → kernel HMAC policy-package doğrulayıcısı.
5. PEP → signed decision/receipt → cluster fence → repository policy scope.
6. Content-free status kanalı → renderer; policy materyali ve kullanıcı verisi bu sınırı geçmez.

## Giriş yüzeyleri ve kötüye kullanım vakaları

### Service unavailable veya timeout

Saldırgan Core Service'i durdurabilir, yerel bağlantıyı kesebilir ya da health çağrısını PPK-003 süresi dışına taşıyabilir. Gözlem üretilemezse `SERVICE_UNAVAILABLE`; bounded çağrı zaman aşarsa `POLICY_DECISION_UNAVAILABLE` oluşur. Her iki durumda da hassas callback açılmaz.

### Geçersiz imza ve sahte doğrulama bayrağı

Yalnız payload biçimi veya SHA-256 tutarlılığı HMAC doğrulaması değildir. Core Service her health çağrısında `kernel.verifyPolicyPackage` çalıştırır. `policyPackageVerified !== true` durumu `POLICY_PACKAGE_SIGNATURE_INVALID` ile deny edilir ve paket cache'i güvenilir kabul edilmez.

### Stale veya gelecek zamanlı gözlem

Eski bir health cevabı replay edilebilir veya saat değeri ileri taşınabilir. Desktop değerlendirme saati `checkedAt` olarak güvenilir tarafta eklenir. `30.000 ms` yaş sınır içinde, `30.001 ms` stale; `5.000 ms` gelecek sapması sınır içinde, `5.001 ms` future olarak deny edilir.

### Policy sürümü ve paket bağını değiştirme

Saldırgan geçerli biçimli farklı policy sürümü, paket sürümü ya da payload hash'i sunabilir. Canlı gözlem, protected startup authority ve süreç başlangıcında sabitlenen paket sürümü/hash değerlerinin üçüyle exact karşılaştırılır. Her sapma ayrı sabit nedenle deny edilir; sessiz rotasyon yoktur.

### Read-only durumundan yazma

Fresh ve imzası doğrulanmış ancak non-writable Core Service yalnız `read-only` olabilir. Normal mutation Core Service'in `clusterWritable=false` etkili isteğiyle imzalı `CLUSTER_NOT_WRITABLE` ret receipt'i üretir; callback açılmaz. Receipt dışı bootstrap mutation availability use case tarafından doğrudan reddedilir.

### Lifecycle çelişkisi

`ready + safeMode`, `degraded + writable`, `degraded + !safeMode`, starting/stopping/stopped veya başka çelişkiler `UNSAFE_SERVICE_STATE`/`SERVICE_NOT_READY` ile deny edilir. Yalnız coherent durumlar read-only/read-write olabilir.

### Status kanalı görünümünden yetki türetme

Renderer mode/reason göstergesini allow kanıtı olarak yeniden kullanabilir. Status view açıkça `mappingGrantsRuntimeAuthority:false` ve `historicalReceiptGrantsCurrentAuthority:false` taşır. Exact status kanalı operation callback dışında tek istisnadır; lookalike/prefix kanallar istisna değildir.

### Cache üzerinden stale veri sızdırma

Policy duruşu read-only veya deny olduğunda IPC read cache'i temizlenir ve hassas offline cache kilitlenir. Status yanıtı hiçbir zaman cache edilmez. Offline lease invalid/stale online policy üzerinde override değildir.

### Outer gate atlama

Bir iç çağrı universal Desktop kapısını atlayıp PEP'i doğrudan kurmayı deneyebilir. `windows-core-service` provider canlı observer olmadan compose edilemez; PEP authority çözümünden önce availability durumunu yeniden değerlendirir.

## Zorunlu kontroller

- Exact shape, strict ISO timestamp, sınırlı alan uzunluğu ve lowercase SHA-256 doğrulaması.
- Authenticated canlı Core Service health çağrısı ve her çağrıda gerçek kernel HMAC self-verification.
- Startup policy version/package version/package SHA-256 pini.
- 30 saniye freshness, 5 saniye future-skew ve PPK-003 bounded dependency süresi.
- Deny/read-only/read-write durum makinesi; çelişkili durumlar fail-closed.
- Universal normal/bootstrap kapısı ile PEP doğrudan savunması.
- Exact zero-argument, no-cache, content-free status IPC.
- Restricted-mode IPC cache temizleme ve offline sensitive cache kilidi.
- PPK-021 exact AST ratchet ve PPK-022 signed capability manifest kontrollerinin korunması.

## Kalan riskler

- Aynı makinedeki yüksek ayrıcalıklı saldırgan süreç belleğini, Core Service binary'sini veya korumalı connection authority'yi ele geçirirse bu uygulama katmanı tek başına işletim sistemi güven zincirinin yerini alamaz.
- Saat bütünlüğü işletim sistemine dayanır; sınırlar replay etkisini azaltır fakat güvenilir zaman servisi sağlamaz.
- Süreç içi startup pini kontrollü hot policy rotation sağlamaz; güvenli rotasyon için yeni authenticated handshake/restart gerekir.
- Read-only hassas okumalar yine geçerli PEP kararı, obligation ve receipt kontrollerine bağlıdır; veri minimizasyonunun yerine geçmez.
- Bu kapanış SBOM, binary/code signing, dependency provenance, lisans veya vulnerability taramasını tamamlamaz; bunlar PPK-025 kapsamıdır.

PPK-024 yeni migration, veri taşıma, backfill, cutover veya SQLite/Desktop vault sahiplik değişimi yapmaz.

Final kanıt: contract `71/71`, runtime `28/28`, hedefli test `4/71`, odak regresyon `6/90`, güvenlik regresyonu `23/351`, tam Vitest `84/759`, production workspace build `18/18`, TypeScript diagnostics `0`, migration `77`.
