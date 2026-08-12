# PPK-025 yazılım tedarik zinciri tehdit modeli

Durum: `IN_PROGRESS / LOCAL_CANDIDATE_VALIDATION_PASS / EXTERNAL_SIGNING_PENDING`

Bu tehdit modeli uygulanmış yerel aday kapılarını ve kalan production risklerini kaydeder; PPK-025 için `COMPLETE` veya production release yetkisi vermez.

## Korunan varlıklar

- İki canonical npm lockfile ve on sekiz workspace dependency graph'ı.
- İzole Windows packager manifest/lock graph'ı ve yerel Squirrel compatibility stub kaynağı.
- CycloneDX SBOM, license decision manifesti, THIRD_PARTY_NOTICES ve vulnerability kanıtları.
- npm registry package signature güven kökü ile dependency/build provenance anahtarları.
- Electron, NSIS, NSIS-resources ve winCodeSign dış assetlerinin exact kaynak/hash pinleri.
- Source commit/tree, build toolchain kimliği ve nihai installer/main executable hash bağları.
- Production code-signing sertifikasının public kimliği, repo dışı private key ve trusted timestamp zinciri.
- Release eligibility kararı, kanıt artifactleri ve content-free UI duruşu.
- Desktop vault, SQLite sahipliği ve gerçek kullanıcı verisi sınırı.

## Güven sınırları

1. Kaynak tree/commit → root `package-lock.json` → 18 workspace.
2. Kaynak tree → `tools/windows-packager/package-lock.json` → Electron Builder/NSIS toolchain.
3. Resmî npm registry ve signature metadata → lock integrity/package signature verifier.
4. Advisory feed veya authenticated offline snapshot → üç-scope vulnerability gate.
5. İki lock + yerel tool + dış build assetleri → canonical SBOM/license/provenance üreticileri.
6. Windows build host → electron-builder → unsigned/final package bytes.
7. Repo dışı signing secret provider → Windows code-signing operation → timestamp authority.
8. Final installer → silent install → kurulu ana executable → bağımsız Authenticode verifier.
9. Signed evidence → Core Service/Desktop content-free release posture → zero-argument/no-cache renderer UI.

## Giriş yüzeyleri ve kötüye kullanım vakaları

### İkinci lockfile'ı atlama

Saldırgan kök lockfile kapısını geçirirken `tools/windows-packager/package-lock.json` içindeki build-time dependency veya transitive paketi değiştirir. İki lock ayrı SHA-256 ve component graph olarak zorunludur. Tek lock PASS sonucu öteki graph için authority değildir.

### Lock ile SBOM arasına bileşen saklama

SBOM generator optional/platform paketi, local stub'ı veya nested transitive bileşeni atlayabilir; duplicate `bom-ref` ile farklı bileşenleri birleştirebilir. Exact lock coverage, unique bom-ref, dependency-edge set eşitliği ve unexpected/missing/duplicate retleri zorunludur.

### Paketlenen binary'yi npm graph dışında değiştirme

Electron, NSIS, NSIS-resources veya winCodeSign binary'si lock'taki npm wrapper'dan ayrı indirilip cache'te değiştirilebilir. Dış asset manifesti exact kaynak/yol/sürüm/SHA-256 pinlerini taşır. Cache presence veya electron-builder exit code 0 tek başına kanıt değildir.

### Registry yönlendirme veya integrity downgrade

Tarball kaynağı başka origin'e yönlendirilebilir, HTTP kullanılabilir veya SHA-512 alanı kaldırılabilir. Resmî `https://registry.npmjs.org/`, same-origin redirect ve exact SHA-512 bütünlüğü korunur; bilinmeyen protocol/origin/integrity `DENY` olur.

### Geçerli hashli fakat publisher doğrulanmamış dependency

Lock integrity, alınan byte'ın beklenen hashle eşleştiğini gösterir; paketi kimin yayımladığını kanıtlamaz. Registry signature her gerekli package için `verified=true` ve trusted `keyId` ister. Missing metadata, unavailable trust root veya invalid signature başarı değildir.

### Lisans metadata'sını hukuki karar gibi kullanma

Lockfile `license` alanı tek başına onay ve notice yükümlülüğü değildir. Exact expression, allowlist, obligation kararı ve THIRD_PARTY_NOTICES coverage ayrı doğrulanır. Unknown/missing/unapproved/notice-missing durumlar fail-closed reddedilir.

### Stale veya eksik vulnerability kanıtını yeniden kullanma

Eski `DEPENDENCY_AUDIT*.json`, farklı lock'a ait rapor veya yalnız root production audit'i sıfır bulgu gösterebilir. Üç scope ayrı lock hashleri, source registry ve bounded timestamps ile doğrulanır. 86.400.000 ms üzeri yaş, 300.000 ms üzeri future skew, missing scope/feed, malformed JSON veya finding `DENY` olur.

### Broad waiver ile bulguları gizleme

Wildcard component/severity veya süresiz waiver bütün graph'ı açabilir. Production PPK-025 kapanışında waiver bulguyu geçiremez. İlerideki bir istisna ayrı karar olmadan tanınmaz; exact component/reason/expiresAt/approver alanlarından herhangi biri eksikse reddedilir.

### Checksum'u dijital imza gibi sunma

Saldırgan delivery attestation JSON'u ve `.sha256` dosyasını birlikte değiştirip yeniden hashleyebilir. PPK-025 provenance DSSE/Ed25519 trusted key doğrulaması ister. Checksum-only, imzasız JSON, tarihsel attestation veya UI göstergesi güncel provenance değildir.

### Build provenance subjectlerini değiştirme

Geçerli imzalı fakat başka source/lock/SBOM/artifacte ait provenance replay edilebilir. `sourceCommitId`, `sourceTreeId`, iki lock SHA-256, SBOM, notices, license decision, vulnerability, external asset ve iki release artifact hash'i aynı zarfın exact subject setidir. Missing/unexpected/mismatch subject `DENY` olur.

### Sertifika yokken sessiz unsigned paketleme

Electron Builder code-signing credential yokken başarılı fakat imzasız paket üretebilir. Production release profili `force signing` davranışına eşdeğer fail-closed kapı taşır. Credential yokluğu development artifactini yalnız `NOT_RELEASE_ELIGIBLE` yapabilir; production yayımlamayı açamaz.

### Self-signed/test sertifikasını production olarak göstermek

Mutation fixture sertifikası `Valid` benzeri yerel sonuç üretebilir. Production verifier exact publisher, certificate SHA-256/thumbprint, code-signing EKU, trusted chain, non-self-signed durum ve trusted timestamp ister. Test key/certificate üretim trust listesine giremez.

### Installer ile kurulu executable ayrışması

Installer geçerli imzalıyken içindeki veya kurulum sonrası ana executable farklı/unsigned olabilir. İki hedef nihai bytes üzerinde ayrı SHA-256 ve Authenticode doğrulamasından geçer. Hedeflerden biri başarısızsa release `DENY` olur.

### Timestamp eksikliği veya sertifika süresi oyunu

Sertifika build anında geçerli olsa bile timestamp yoksa gelecekte doğrulanabilirlik kaybolabilir; sahte timestamp chain de eklenebilir. RFC3161 timestamp, trusted timestamp chain ve sertifikanın signing time'da geçerliliği zorunludur.

### Signing secret sızıntısı

PFX, private key, parola veya secret reference loga, SBOM'a, artifacte ya da renderer'a çıkabilir. Repo yalnız public publisher/certificate pinlerini tutar. Private material repo/artifact/log/renderer'da yasaktır ve secret provider dışından çözülemez.

### Mutable CI dependency ve build host drift'i

Mutable GitHub Action tag'i veya `windows-latest` image değişerek aynı source'tan farklı build üretebilir. Final provenance exact workflow/action commit kimliği, Node/npm/electron-builder sürümü ve build host/toolchain kimliğini kaydetmelidir. Belirsiz veya pinlenmemiş builder production provenance'i tamamlayamaz.

### Content-free UI'dan yetki türetme

Renderer bir “güvenli” kartını release allow makbuzu gibi kullanabilir veya component/CVE/hash/certificate ayrıntılarını sızdırabilir. Status exact zero-argument/no-cache'tir ve yalnız aggregate posture verir; `productionReleaseEligible=false` iken UI başka bir duruş gösteremez. UI release authority değildir.

### Tarihsel kanıt replay'i

Eski audit, eski SBOM, eski signed package veya cache receipt güncel release ile eşleşebilir görünse de yeni source/lock/artifact bağlarını taşımaz. Her release kanıtı fresh ve exact release kimliğiyle yeniden doğrulanır; tarihsel kayıt current authority değildir.

## Zorunlu kontroller

- İki lockfile ve 18 workspace için exact graph, resmî registry ve SHA-512 doğrulaması.
- İzole packager graph, local stub ve build-toolchain drift kapısı.
- Deterministik CycloneDX JSON 1.6, unique bom-ref ve exact component/dependency edge eşitliği.
- Exact license decision manifesti ve THIRD_PARTY_NOTICES coverage.
- Üç ayrı vulnerability scope, lock hash binding, 24 saat freshness, 5 dakika future-skew ve sıfır bulgu.
- Üç scope için registry package signature verified/keyId ve sıfır missing/invalid.
- Electron/NSIS/NSIS-resources/winCodeSign exact external asset manifesti ve SHA-256 pinleri.
- DSSE/Ed25519 trusted-key provenance ve bütün zorunlu subject hashleri.
- Final installer ile kurulu ana executable için bağımsız Authenticode `Valid` doğrulaması.
- Exact publisher/certificate pin, trusted chain, code-signing EKU ve RFC3161 timestamp.
- Private materialin repo/artifact/log/renderer dışında tutulması.
- Exact zero-argument/no-cache/content-free status; UI'nin release authority olmaması.
- Parse, read, clock, trust-root, feed veya verifier hatalarının fail-closed `DENY` olması.

## Kalan riskler ve açık blockerlar

- Güvenilir production code-signing sertifikası ve repo dışı private-key erişimi henüz sağlanmamıştır.
- Production DSSE/Ed25519 provenance trusted public key kimliği ve repo dışı private-key erişimi henüz sağlanmamıştır.
- Güncel `4.8.2026-29` installer ve kurulu ana executable Authenticode/timestamp kanıtı henüz yoktur.
- Registry signature evidence iki lock graph için yerel aday doğrulamasından geçmiştir; bu sonuç production provenance anahtarının yerini tutmaz.
- Electron/NSIS/NSIS-resources/winCodeSign kaynak URL ve SHA-256 pin manifesti yerel aday doğrulamasından geçmiştir; production-trusted provenance zarfı dış anahtar girdisini bekler.
- Yerel aday contract/runtime, hedefli, tam regresyon ve production workspace build doğrulamaları kaydedilmiştir; gerçek signed Windows release doğrulaması çalıştırılmamıştır.
- Aynı Windows hostu, signing secret provider'ı veya trusted build service'i ele geçiren yüksek ayrıcalıklı saldırgana karşı bu uygulama katmanı tek başına donanım/organizasyon güven zincirinin yerini alamaz.

PPK-025 yeni migration, repository persistence, veri taşıma, historical backfill, cutover veya SQLite/Desktop vault sahiplik değişimi yapmaz; latest migration `77` kalır. Bu tehdit modeli hiçbir çalıştırılmamış kontrolü `PASS` saymaz.
