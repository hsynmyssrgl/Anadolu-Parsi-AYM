# DEC-206 — PPK-025 fail-closed yazılım tedarik zinciri kapıları

## Durum

`ACTIVE / PARTIAL / LOCAL_CANDIDATE_VALIDATION_PASS / EXTERNAL_SIGNING_PENDING` — 2026-08-12. Yerel fail-closed kapılar ve aday doğrulaması kaydedilmiştir; trusted production provenance anahtarı ile gerçek production Authenticode girdileri beklenmektedir. Bu belge PPK-025 için `COMPLETE` veya production `PASS` iddiası değildir.

## Bağlam

PPK-025; SBOM, imzalı paket, dependency provenance, lisans ve zafiyet kapılarının birlikte kapanmasını ister. Mevcut kök bağımlılık doğrulaması resmî npm registry, HTTPS, SHA-512 integrity ve workspace graph kontrolleri sağlar. İçerik adresli npm handoff aktif lockfile ve tarball bütünlüğünü bağlar. İzole Windows packager ise ayrı manifest/lockfile ile Electron Builder ve NSIS toolchain'ini taşır.

Bu parçalar tek başına PPK-025 değildir. Kök supply doğrulayıcısının izole packager lock graph'ını kapsaması, deterministik bir SBOM üretilmesi, üçüncü taraf lisans/notice kararlarının verilmesi, güncel vulnerability ve registry signature kanıtlarının lock hashlerine bağlanması, dış build assetlerinin pinlenmesi, kriptografik build provenance ve gerçek Windows Authenticode doğrulaması ayrıca zorunludur. Var olan delivery attestation JSON'u ile `.sha256` dosyası bütünlük kontrolüdür; özel anahtarlı dijital imza ya da üretim code-signing kanıtı değildir.

## Karar

1. Tek kanonik release kimliği `4.8.2026-29 / Bronze / anadolu-parsi-aym-bronze-4.8.2026-29` olur. Her kanıt bu release kimliği, `sourceCommitId` ve `sourceTreeId` ile exact bağlıdır.
2. `package-lock.json` ve `tools/windows-packager/package-lock.json` iki ayrı zorunlu dependency graph'tır. On sekiz workspace, izole packager manifesti ve `tools/electron-builder-squirrel-windows-stub` yerel bileşeni exact envantere girer. Bir lock'ın geçmesi diğer lock için yetki vermez.
3. SBOM kanonik, deterministik CycloneDX JSON 1.6 olur. Her external package, internal workspace ve yerel tool bileşeni unique `bom-ref`, exact sürüm, kaynak/integrity/hash, license ve dependency edge ile kapsanır; npm graph dışındaki Electron/7zip/NSIS/NSIS-resources/winCodeSign binary assetleri ayrı exact hash manifestine bağlanır. Eksik, fazla, duplicate, bozuk veya lock ile uyuşmayan component `DENY` olur.
4. SBOM; `rootPackageLockSha256`, `windowsPackagerLockSha256`, `sbomSha256`, source kimliği ve nihai installer/main executable hashleriyle aynı evidence zarfına bağlanır. SBOM yalnız lock graph özeti değildir; paketlenen dış binary assetler de ayrıca exact asset manifestiyle doğrulanır.
5. Ürün `LICENSE_TR.txt`/RTF metni üçüncü taraf lisans kararı değildir. Her component için exact lisans ifadesi, onay kararı ve notice yükümlülüğü `licenseDecisionManifestSha256` ile bağlanır; `thirdPartyNoticesSha256` zorunludur. Unknown, missing, unapproved veya notice eksikliği `DENY` olur.
6. Vulnerability kapısı üç bağımsız scope çalıştırır: `root-production`, `root-build-toolchain` ve `windows-packager`. Her rapor kendi lock SHA-256'sını, registry'yi, `scannedAt`/`checkedAt` zamanlarını ve finding/severity dökümünü taşır. En fazla 86.400.000 ms yaş ve en fazla 300.000 ms future skew kabul edilir. Eksik scope, unavailable/malformed feed, stale/future rapor, lock mismatch veya tek finding `DENY` olur.
7. Registry package signature kapısı iki bağımsız lock graphı için (`root` ve `windows-packager`) `verified=true` ve trusted `keyId` ister. Root graph kendi production ve build-toolchain bağımlılıklarını birlikte kapsar. Invalid veya missing signature sayısı sıfırdır. Trust root yokluğu başarı değildir ve build/release yetkisini kapatır.
8. Dependency/build provenance, DSSE zarfında Ed25519 ile doğrulanır. Trusted `keyId`; source commit/tree, iki lock, SBOM, third-party notices, license decision, vulnerability, external asset ve nihai artifact subject hashlerini exact bağlar. Yalnız checksum, unsigned JSON veya tarihsel attestation provenance PASS değildir.
9. `electron`, `7zip`, `nsis`, `nsis-resources` ve `winCodeSign` dış assetleri exact sürüm/kaynak/yol/SHA-256 pinleriyle `externalAssetManifestSha256` altında bulunur. İndirme cache'inde dosya bulunması veya electron-builder'ın başarıyla çıkması provenance değildir; mirror, custom path ve binary override ortam değişkenleri production release yolunda reddedilir.
10. Windows release'te hem nihai installer hem kurulumdan sonra çalıştırılacak ana executable ayrı doğrulanır. Her ikisi `Get-AuthenticodeSignature.Status == Valid`, exact publisher, certificate SHA-256/thumbprint, code-signing EKU, güvenilir chain ve RFC3161 timestamp taşır. Installer valid iken installed executable invalid ise release `DENY` olur.
11. Production sertifikası/private key repo, artifact, SBOM, log veya renderer'a yazılmaz. Trust policy yalnız public certificate metadata/pinlerini taşır. Self-signed/test sertifikası mutation testinde kullanılabilir fakat production yetkisi vermez.
12. Release pipeline'da source/dependency kapıları paketlemeden önce, Authenticode ve artifact-bound provenance kapıları nihai bytes yazıldıktan sonra çalışır. Development build artifacti üretilebilir ancak eksik production imzası açıkça `NOT_RELEASE_ELIGIBLE` olur; release yayımlanamaz.
13. Status UI yalnız content-free posture verir. Component adı/sürümü, CVE/advisory, kaynak yolu, hash, certificate ayrıntısı, private key veya token renderer'a geçmez. Kanal exact zero-argument ve no-cache'tir. UI durumu release authority değildir.
14. Broad/wildcard waiver yoktur. PPK-025 production kapanışında waiver herhangi bir finding veya imza eksikliğini geçiremez. İleride istisna tasarlanırsa exact component, gerekçe, süre sonu ve onaylayan bağları olan ayrı bir karar gerekir.
15. Tarihsel audit, eski SBOM, eski signed artifact, cache receipt veya `.sha256` dosyası güncel release yetkisi değildir. Her release için bütün bağlar yeniden doğrulanır.

## Fail-closed karar matrisi

| Gözlem | Build kararı | Production release kararı |
|---|---|---|
| SBOM eksik/bozuk/stale veya lock/artifact uyuşmaz | DENY | DENY |
| License unknown/missing/unapproved veya notice eksik | DENY | DENY |
| Vulnerability feed unavailable, scope eksik, stale/future veya finding var | DENY | DENY |
| Registry signature missing/invalid ya da trust root yok | DENY | DENY |
| Provenance imzasız/geçersiz veya subject hash uyuşmaz | DENY | DENY |
| External asset pin eksik/hash mismatch | DENY | DENY |
| Production cert/private key yok | Development yalnız `NOT_RELEASE_ELIGIBLE` | DENY |
| Installer veya installed main executable Authenticode `Valid` değil | — | DENY |
| Self-signed/test sertifikası | Test fixture ile deny davranışı sınanabilir | DENY |
| Bütün fresh, coherent, exact ve production-trusted kanıtlar var | Aday build açılabilir | Final doğrulama sonrası ALLOW |

## Şema ve veri kararı

PPK-025 build/release artifact ve doğrulama paketidir. Yeni repository persistence veya database migration eklenmez; latest migration `77` kalır. Gerçek kullanıcı verisi taşınmaz, historical backfill/cutover yapılmaz, Desktop vault ve SQLite sahipliği değiştirilmez. Release status snapshot'ı veritabanına kalıcı yetki olarak yazılmaz.

## Dış girdiler ve açık durum

Gold/production için güvenilir code-signing sertifikası, trusted DSSE/Ed25519 provenance public key kimliği ve bunların repo dışı private-key erişimleri dış girdidir. `config/32-u-ppk-025-signing-trust-policy.json` içindeki production trust pinleri bu nedenle boştur ve release eligibility fail-closed `false` kalır. Güncel `4.8.2026-29` installer ile gerçek kurulu ana executable'ın Windows `Valid` Authenticode/timestamp ve trusted provenance kanıtı olmadan PPK-025 imzalı paket sınırı tamamlanmış sayılamaz.

PPK-025'in ortak tedarik zinciri primitive'leri `EXT-080` plugin lisans/SBOM envanterine temel olabilir; ancak plugin-specific kapsamı otomatik olarak tamamlamaz. `OPEN-020` Gold üretim/operasyon paketi, açık release onayı ve diğer Gold belgeleri de bu kararla kapanmaz.

## Beklenen kanıt

- `config/32-u-ppk-025-software-supply-chain-scope.json`
- `config/32-u-ppk-025-software-supply-chain-inventory.json`
- `config/32-u-ppk-025-software-supply-chain-policy.json`
- `config/32-u-ppk-025-signing-trust-policy.json`
- `artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json`
- `artifacts/manifests/32-U-ppk-025-third-party-notices.json`
- `artifacts/manifests/32-U-ppk-025-third-party-notices.txt`
- `config/32-u-ppk-025-external-build-assets.json`
- `artifacts/validation/32-U-ppk-025-software-supply-chain-contract.json`
- `artifacts/validation/32-U-ppk-025-software-supply-chain-runtime.json`
- `artifacts/validation/32-U-ppk-025-release-decision.json`
- `artifacts/validation/32-U-ppk-025-windows-signature.json`
- Güncel production-trusted installer ve installed-main-executable Authenticode kanıtı.

Yerel aday doğrulaması `94/94 contract`, `16/16 runtime`, `50/50 hedefli` ve `809/809 tam Vitest` olarak kaydedilmiştir; release kararı dış girdiler nedeniyle `BLOCKED` kalır. Çalıştırılmamış hiçbir production kontrolü `PASS` sayılmaz.
