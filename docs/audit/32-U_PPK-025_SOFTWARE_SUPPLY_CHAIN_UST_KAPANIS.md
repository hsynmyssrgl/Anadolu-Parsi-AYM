# 32-U PPK-025 yazılım tedarik zinciri üst kapanış denetimi

Durum: `IN_PROGRESS / NOT_CLOSED / LOCAL_CANDIDATE_VALIDATION_PASS / EXTERNAL_SIGNING_PENDING`

Bu belge 32-U yerel aday doğrulaması ve açık production gerçeklik kaydıdır. Yerel kapılar doğrulanmıştır; ancak PPK-025 kapanışı, production release eligibility veya imzalı paket kanıtı değildir.

## Tanımlanan kapsam

- Kök `package-lock.json`, on sekiz workspace ve ayrı `tools/windows-packager/package-lock.json` graph'ı.
- İzole packager manifesti ile yerel Squirrel compatibility stub.
- Deterministik CycloneDX JSON 1.6 SBOM ve exact lock/release artifact bağları.
- Üçüncü taraf license decision manifesti ve THIRD_PARTY_NOTICES.
- `root-production`, `root-build-toolchain` ve `windows-packager` vulnerability scope'ları.
- Aynı üç scope için registry package signature doğrulaması.
- Electron, NSIS, NSIS-resources ve winCodeSign dış asset pinleri.
- DSSE/Ed25519 dependency/build provenance ve zorunlu subject hashleri.
- Nihai Windows installer ile kurulu ana executable'ın bağımsız Authenticode doğrulaması.
- Exact zero-argument/no-cache/content-free release posture sınırı.

## Uygulanan ve yerel doğrulanan kapılar

- İki lockfile, 18 workspace ve 374 canonical registry tarball'ı resmî npm registry/HTTPS/SHA-512 ve exact graph kontrollerinden geçmiştir.
- Deterministik CycloneDX 1.6 SBOM 414 component ve 414 dependency node'u exact kapsar.
- Üçüncü taraf notice/lisans envanteri 357 bileşeni kapsar; unknown, missing, unapproved ve notice eksikliği fail-closed reddedilir.
- Üç vulnerability scope ve iki registry-signature graph'ı güncel lock hashleriyle PASS vermiştir.
- Beş dış paketleme asseti exact kaynak/yol/SHA-256 pinleriyle doğrulanmıştır.
- DSSE/Ed25519 provenance subject ve tamper kapıları uygulanmıştır; production trusted key dış girdisi bulunmadığı için aday zarfı release yetkisi vermez.
- Windows pipeline imzasız paket üretmeden durur; installer önce doğrulanır, sessizce gerçek geçici hedefe kurulur ve kurulu ana executable ayrıca doğrulanır.
- Authenticode verifier exact publisher/certificate pinleri, code-signing EKU, signer/timestamp chain, signing-time geçerliliği, RFC3161 imprint ve trusted timestamp ister.

Bu yerel aday kapılarının hiçbiri tek başına PPK-025 production kapanışı değildir. Eski audit güncel lock/freshness authority değildir; `.sha256` dijital imza değildir; untrusted aday provenance zarfı veya imzasız artifact production yetkisi vermez.

## Açık blockerlar

1. Beklenen publisher'a ait güvenilir production code-signing sertifikası ve repo dışı private-key erişimi dış girdisi sağlanmamıştır.
2. Production DSSE/Ed25519 provenance için trusted public key kimliği ve repo dışı private-key erişimi sağlanmamıştır.
3. Güncel `4.8.2026-29` installer ve gerçek kurulu ana executable için production-trusted `Valid` Authenticode, publisher/certificate pin, trusted timestamp ve provenance kanıtı yoktur.

## Kaydedilen yerel aday doğrulaması

- 32-U aday contract: `94/94 PASS`.
- 32-U aday runtime: `16/16 PASS`.
- PPK-025 hedefli Vitest: `3/3 dosya, 50/50 test PASS`.
- Tam Vitest: `87/87 dosya, 809/809 test PASS`.
- Root TypeScript: `PASS`; 18 production workspace build: `18/18 PASS`.
- Lockfile: `1505`, dependency supply: `1536`, workspace graph: `518`, build-toolchain security: `82` assertion `PASS`.
- AST kapısı: `18 zone / 365 dosya / 521 exact yüzey / 0 bulgu PASS`.
- Bronze güncel denetim: `PASS_WITH_OPEN_SCOPE`.
- Aday release kararı: `BLOCKED`; `requirementCompletionClaimed=false`.

## Güncel fail-closed release kararı

- `productionReleaseEligible=false`.
- SBOM/license/vulnerability/registry signature/provenance/external asset kanıtlarından herhangi biri missing, invalid, stale, future veya release/lock mismatch ise `DENY`.
- Production sertifikası/private key yoksa `DENY`.
- Installer veya installed main executable Authenticode durumu `Valid` değilse `DENY`.
- Self-signed/test sertifikası, tarihsel audit, tarihsel signed artifact, UI status veya checksum-only attestation production authority değildir.
- Vulnerability waiver PPK-025 production kapanışını açamaz.

## Şema ve veri gerçekliği

- Yeni repository persistence veya database migration yoktur; latest migration `77` kalır.
- Gerçek kullanıcı verisi taşınmamış, historical backfill veya cutover yapılmamıştır.
- Desktop vault ve SQLite sahipliği korunur.
- Release/SBOM/provenance kanıtları build artifactidir; business-data tablosu veya runtime yetki kaydı değildir.
- PPK-012 offline lease/cache ve policy-sensitive IPC no-cache sınırları zayıflatılmaz.

## Ardıl ve paralel açık kapsam

- `EXT-080` plugin-specific lisans/SBOM/kaynak envanteri bu ortak kapıdan otomatik kapanmaz.
- `OPEN-020` Gold imzalı üretim ve operasyon paketi; gerçek sertifika, açık release onayı ve diğer Gold belgeleri tamamlanmadan açık kalır.
- PPK-026 ve sonraki gereksinimler bu taslakla başlatılmaz veya tamamlanmış sayılmaz.

## Final kapanış için kalan production doğrulaması

Yerel aday doğrulaması kaydedilmiştir. Final kapanış yalnız aşağıdaki dış girdiler ve gerçek production çalıştırması sağlandıktan sonra yapılabilir:

- Trusted production DSSE/Ed25519 provenance public key kimliği ve repo dışı private-key erişimi.
- Beklenen publisher'a ait production Authenticode sertifikası, public pinleri ve repo dışı private-key erişimi.
- Gerçek production-trusted sertifikayla güncel installer ve installed main executable doğrulaması.
- İmzalı nihai artifact hashleriyle production provenance zarfı ve `RELEASE_ELIGIBLE` kararının yeniden üretilmesi.

Yerel aday sonuçlarının `PASS` olması production `PASS` değildir. Kapsam ancak production-trusted provenance ve Authenticode girdileriyle gerçek evidence zinciri `RELEASE_ELIGIBLE` olduğunda `COMPLETE` durumuna geçirilebilir.
