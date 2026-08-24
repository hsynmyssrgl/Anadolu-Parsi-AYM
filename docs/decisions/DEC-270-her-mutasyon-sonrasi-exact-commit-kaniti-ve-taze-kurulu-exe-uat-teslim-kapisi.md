# DEC-270 — Her mutasyon sonrası exact commit kanıtı ve taze kurulu EXE UAT teslim kapısı

- Tarih: 23.08.2026
- Durum: ACTIVE
- Bağlayıcı kural: PR-235

## Karar

En küçük kaynak, yapılandırma veya belge değişikliği bile önceki completion, paket ve installer teslim kanıtlarını yeni kaynak için geçerli kılmaz. Değişen dosyalar exact Git diff ile kaydedilir; kanonik kural, kullanıcı kararı, aktif belge, manifest, ratchet, test ve UAT etkileri tek tek `UPDATED`, açık gerekçeli `NOT_IMPACTED_WITH_REASON` veya yalnız UAT için `DEFERRED_TO_FRESH_INSTALLED_EXE_UAT` olarak sınıflanır.

Kalıcı completion ve Windows paketleme; temiz kanal worktree'sindeki aynı exact commit, kanonik kural hash'i ve governed-source fingerprint'ine bağlı hedefli test, tam regresyon ve kaynak bütünlüğü PASS kanıtları olmadan yapılamaz. Paketleme receipt'i bu bağların dosya yolu, boyut ve SHA-256 kimliklerini taşır.

Installer teslimi; paket üretildikten sonra gerçek kurulu `ParsYuva-<Kanal>.exe` üzerinde çalışan, aynı paket provenance SHA-256'sı ve kaynak commitine bağlı taze UAT PASS kaydı olmadan yapılamaz. Kaynak runtime, `win-unpacked`, yalnız dosya sürümü veya eski UAT makbuzu bu koşulu karşılamaz.

## Fail-closed sınır

Eksik, başka committen veya stale etki/test/bütünlük/UAT kanıtı `BLOCK_CURRENT_REQUIRED_STAGE` sonucudur. Waiver, sessiz atlama ve eski PASS devşirme yasaktır. Bu karar normal geliştirme testini veya derlemeyi, kendi kanıtı oluşmadan önce döngüsel olarak engellemez; kalıcı postflight, paket üretimi ve teslim iddiasını engeller.

## Kanonik kanıt sırası

Mutasyondan önce temiz Bronze kanal worktree'sinde `npm run record:mutation-baseline` çalıştırılır. Kaynak ve yönetişim değişiklikleri tamamlanıp indeksler ile `manifest.json`/`SHA256SUMS.txt` commit içine alındıktan sonra aynı temiz exact commit üzerinde:

Baseline kaydı repo içinde değiştirilebilir bir tam makbuz bırakmaz. Kanonik üretici; güncel `mutation` işlem-kural makbuzunun SHA-256 kimliğini, kendi dosya yolu/boyut/SHA-256 kimliğini ve exact Git tree/fingerprint readback'ini Bronze kanalına sabit `D:/AYM_LIBRARY/ParsYuva/ParsYuva Aile Yasam Merkezi/governance/PR-235/Bronze/mutation-baseline-chain` kökünde exclusive-create, kesintisiz ve tam readback edilen append-only SHA-256 zincirine yazar; repo içinde yalnız dış kaydın dosya, sıra, boyut ve SHA-256 pointer'ı tutulur. İlk DEC-270 etkinleştirmesinde yalnız zincirin ilk kaydı olarak `BOOTSTRAP_ADOPTION` kullanılabilir; taban commit sabit `440d5c7a9fbbd840faef58d1e1ef2048f8a989b4` ve tam diff zorunludur, genel waiver değildir.

1. `artifacts/validation/mutation-impact-assessment.json` yedi etki alanını sınıflandırır; `npm run create:mutation-impact-evidence` exact baseline diff'inden makbuzu üretir.
2. `npm run verify:mutation-targeted:evidence -- -- <repo-ici-test.test.ts-dosyalari>` yalnız repo içi `.test.ts` dosyalarını, sabit tek worker ve JSON reporter ile çalıştırır; config/root/project/filter/changed/related/passWithNoTests ve path traversal seçenekleri yasaktır.
3. `npm run verify:mutation-full-regression:evidence` filtresiz tam Vitest regresyonunu çalıştırır.
4. `npm run verify:mutation-source-integrity` kaynak manifest bütünlüğü makbuzunu üretir.
5. Tam preflight makbuzu ve üretilmiş indeksler commit içine alınır. `npm run governance:postflight`, bu makbuzun aynı governed-source fingerprint'ine ait olduğunu ve mevcut indeksleri `--no-report` ile doğrular; tracked dosya üretmeden beş exact-commit kanıtını denetler.

Baseline commit CLI ile değiştirilemez; impact üreticisi yalnız mutasyondan önce kaydedilmiş harici baseline kaydını, pointer SHA-256 readback'i, immutable Git tree/fingerprint ve gerçek changed-file/path-class assessment eşlemesiyle kabul eder. Sabit bootstrap tabanında producer dosyası henüz bulunmadığından `BOOTSTRAP_ADOPTION` producer path/boyut/SHA kimliği yalnız repo pointer'ının `sourceCommit` kayıt commitinden okunur; external receipt ile pointer producer alanları exact eşit, taban kayıt commitinin ve kayıt commiti güncel HEAD'in Git atası olmalıdır. Bu özel bağ diff tabanını değiştirmez ve normal `PRE_MUTATION` producer doğrulaması kendi baseline commitinde kalır. Test sırasında validation makbuzları ile Vitest toolchain öncesi/sonrası aynı kalır; tüm makbuzlar atomik yazılır ve canonical producer SHA, canonical args, exit code, failed-suite sayısı, önceki makbuz hashleri ile manifest/SHA256SUMS bağlarını taşır. Paketleme yalnız sabit `artifacts/validation` yollarını okur; CLI/env kanıt yolu override'ı yoktur. Postflight indeks üretmez ve committed indexi exact `git ls-tree HEAD` envanteriyle doğrular.
