# Tüm Kurallar Aşılamaz Yürütme Sözleşmesi

- Sürüm: **Bronze 26.08.2026.51**
- Karar: **DEC-129**
- Kanonik kural sayısı: **241**
- Aktif kural: **216**
- Kural SHA-256: `cbd4476d480d81064291347293ba8140d8269bca2cac82d2358a87891f8c14c4`

## Değişmez çalışma ilkesi

Her ACTIVE kural `config/rule-enforcement-registry.json` içinde tam bir enforcement kaydına sahiptir. `failClosed=true`, `waiverAllowed=false`, `skipAllowed=false` zorunludur. Makineyle doğrudan kanıtlanamayan bir kural PASS sayılmaz; kanıt gerektiren aşama BLOCKED kalır.

Her durum değiştiren işlem öncesinde `scripts/verify-operation-rule-check.mjs` açık işlem türü ve açıklamasıyla çalıştırılır. Kural, hash, onay veya enforcement kontrolü PASS değilse kod, dosya, test, build, paketleme, kurulum, silme, yayımlama ya da dış yazma işlemi başlatılamaz.

PR-236 gereği Bronze, Silver ve Gold programları legacy kökün dışındaki `C:\Program Files\PPT\ParsYuva-<Kanal>` kardeş dizinlerine kurulur; AppData `ParsYuva/<Kanal>` kalır. Kanal EXE, kısayol, appId, productName, kaldırma kapsamı, Git worktree ve branch yalıtımı korunur. Interactive kaldırma signed-in kullanıcı bağlamından sonra all-users bağlamını geri yükler; legacy kökte kanal dizini varsa recursive silme durur ve legacy veri otomatik taşınamaz veya silinemez.

PR-237 gereği sürüm tahsisi zorunlu expected release ID ile açık tek mutasyondur. Preview salt okunurdur; kimlik uyuşmazlığı lock, temp, yazım veya installer temizliği öncesi durur. Signed/local/dir paket girişleri allocator çalıştırmaz ve yalnız önceden tahsisli ledger/manifest/repository/APP_META exact kimliğini tüketir.

PR-239 gereği Windows installer teslimi yalnız schema2 exact-commit package provenance, zorunlu installer-experience V2 ve UAT110 V3'ün paket sırasından yeniden türettiği birbirini dışlayan modla kabul edilir: Bronze 50 için kanonik hedefin yokluğunu kanıtlayan fresh-install + same-version maintenance; normal Bronze 52+ için immutable previous package arşiviyle eşleşen canlı sibling N'den exact N→N+1 + same-version maintenance. Tracked TypeScript kaynağına bağlı exact modül/rota otoritesi, tüm uygun kontrollerin dinamik outcome kapsamı, gerçek native CANCEL/ACCEPT, exclusive reparse-korumalı kanıt kökü, guard kaybında sıfır path temizliği, parent-run bağlı UAT111 V3 ve bütün girdileri canlı geri okuyan final V3 zorunludur. Legacy nested runtime trusted predecessor değildir; mevcut kullanıcı verisi içeriği makbuza yazılmaz. NotSigned ve koruma kapalı Kaspersky testi üretim veya zararsızlık iddiası değildir.

PR-241 yalnız Bronze 51 için geçerlidir. Current top-level ve exact tek entry statusu birbirine eşit ve exact `IN_PROGRESS` olmalıdır; immutable parent bundle transaction yayımlanmadan hemen önce kanonik path/size/SHA/rejected-parent identity bağıyla canlı geri okunur. Bronze 50 package/external history immutable `REJECTED_INVALID_PACKAGE` olarak korunur; provenance bundle yalnız `REJECTED_PARENT_HISTORY_ANCHOR_ONLY` lineage girdisidir ve canlı installed predecessor otoritesi değildir. Bronze 51 temiz program kökü, EXE ve uninstall yokluğunu kanıtlayarak recovery fresh-install ve ayrı same-version maintenance çalıştırır. Exact test, kaynak bütünlüğü, preflight/postflight, installer-experience, UAT110, UAT111 ve final geri-okuma kapıları atlanamaz.

PR-235 gereği her mutasyonun exact changed-file etki analizi kural, karar, belge, manifest, ratchet, test ve UAT bağlarını günceller veya açık gerekçeyle etkilenmediğini gösterir. Kalıcı postflight ve paketleme aynı temiz committe hedefli test, tam regresyon ve kaynak bütünlüğü PASS olmadan; installer teslimi aynı pakete/commite bağlı paket sonrası gerçek kurulu ana EXE UAT PASS olmadan ilerleyemez.

PR-235 baseline'ı mutasyondan önce temiz Bronze worktree'sinde kanonik üreticiyle, dış sabit kökte exclusive-create append-only SHA-256 zincirine kaydedilir; repo yalnız hash-bağlı pointer taşır ve sonradan CLI ile başka bir ata commit seçilemez. Tek seferlik ilk etkinleştirme yalnız sabit `440d5c7a9fbbd840faef58d1e1ef2048f8a989b4` tabanlı zincir sıra 1 `BOOTSTRAP_ADOPTION` tam diff kaydıdır, waiver değildir. Bu sabit tabanda üretici henüz bulunmadığı için yalnız bootstrap producer path/boyut/SHA kimliği pointer `sourceCommit` kayıt commitinden, external receipt-pointer exact eşitliği ve `base → pointer → HEAD` ancestry kanıtıyla okunur; diff tabanı değişmez. Normal `PRE_MUTATION` producer kendi baseline commitinden doğrulanır. Hedefli test yalnız repo içi `.test.ts` dosyalarını sabit worker/reporter argümanlarıyla gerçekten çalıştıran kanonik üreticiden gelir; producer SHA, exit/failed-suite, assessment/manifest ve önceki makbuz hashleri readback edilir. Postflight tracked indeks üretmez, yalnız commit içine alınmış indeksi exact Git HEAD envanteriyle salt okunur doğrular.

Mutation assessment `sourceCommit` alanı canlı Bronze release provenance HEAD, `baselineCommit` alanı doğrulanmış harici baseline pointer HEAD ile 40–64 hex ve exact eşleşmek zorundadır. Eksik, biçimsiz veya drift etmiş kimlik create-assessment, create-analysis, final readiness, postflight, builder ve canlı/tarihsel package provenance katmanlarının tamamında fail-closed reddedilir.

PR-240 gereği en küçük mutasyon, etkilenen ana ve kanal kaynakları ile bütün kural/karar/aktif-ticari belge/iş listesi/kapsam/envanter/ratchet/manifest/indeks/ana DOCX-PDF/kanıt sözleşmelerini aynı zincirde `UPDATED` veya kanıtlı `NOT_AFFECTED` olarak kapatır. Hedefli test, filtresiz tam regresyon, typecheck, değişen komut dosyası sözdizimi ve kaynak bütünlüğü zorunludur. UI etkisinde bütün modül, rota, ana/alt menü, görünür uygun kontrol, durum, erişilebilirlik ve görsel bütünlük UAT'ı yapılır. Gerçek FAIL boş `wip(rejected)` checkpoint commit ile kaydedilir; bütün kapanış bitmeden ara installer üretilemez ve paket yalnız ana/kanal kaynak eşitliği doğrulanmış temiz exact committen çıkar.

## PR-171 adım kilidi

Büyük işler `config/work-segmentation-plan.json` ile küçük adımlara ayrılır. Aynı anda yalnız bir adım `IN_PROGRESS` olabilir. Bir adım `PASS` doğrulaması ve kalıcı Library checkpoint kanıtı olmadan `COMPLETED` olamaz; önceki adım tamamlanmadan sonraki adım başlatılamaz.

## Komut zinciri

Build/test/package/publish komutları governed preflight ve aktif work-step kilidini doğrular. Universal Rule Enforcement Gate hem preflight hem postflight içinde zorunludur.

## Güvence sınırı

Bu sistem, proje sürecinde kuralın sessizce atlanmasını veya kanıtsız PASS verilmesini engeller. Gerçek dünya ve dış sağlayıcı koşullarını makineyle ispatlayamadığı yerde durumu `BLOCKED/NOT_RUN` tutar; bu durum Silver/Gold geçişinde PASS yerine kullanılamaz.
