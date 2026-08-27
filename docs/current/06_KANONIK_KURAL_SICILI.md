# Kanonik Kural Sicili

- Görünür sürüm: **Bronze 27.08.2026.53**
- Sicil kimliği: `PPT-CANONICAL-RULE-REGISTRY-V29`
- Toplam kural: **241**
- Aktif kural: **216**
- Açıkça superseded tarihsel kural: **25**
- Kural SHA-256: `473ad949db17e76d6c3230fb1ac11e2a022ba744b69d8225c5a5a7a694c9d82b`
- Makine okunur tek aktif kaynak: `config/canonical-rule-registry.json`

`PR-186` her bağlayıcı kararın aynı sürümde DEC ve makine defterine kaydını, `PR-187` bilinen belge/kod/kural driftinde kapanış yasağını getirir. `DEC-251` ve `config/documentation-synchronization-policy.json` bu iki kuralı karar anında DEC + etkilenen belge + iş listesi açık/kapalı/neden güncellemesi olarak fail-closed uygular.

`PR-209`–`PR-214`; ParsYuva Aile Yaşam Merkezi tam ürün adı ve teknik uyumluluk sınırını, dış kurumsallaşma no-claim kapısını, aktif metadata'yı, yeni kalıcı kütüphane dalını, platform/cihaz ayrımını ve konu bazlı kurumsal belge yapısını bağlar.

`PR-215`; ilk açılışta sistem dilinin Electron ana sürecinde belirlenmesini, yalnız Türkçe ve İngilizce desteğini, desteklenmeyen/çözülemeyen dilde İngilizcenin güvenli varsayılan olmasını ve kullanıcının sonraki açılışlar için ana süreçte saklanan `system|tr|en` tercihini Ayarlar üzerinden değiştirebilmesini bağlar.

`PR-216`; kurulum öncesi sayfalarda hareketli sahte ilerlemeyi yasaklar ve yalnız yerel NSIS dosya kurulum ilerlemesinden okunan tek yüzde görünümüne izin verir.

`PR-217`; güncel ürün ve belge başlıklarında yalnız `ParsYuva Aile Yaşam Merkezi` tam adının kullanılmasını bağlar. `AYM` kısaltması kullanıcı yüzeylerinde yasaktır; yalnız değiştirilemeyen tarihsel kayıtlar ve geriye dönük uyumluluk için zorunlu teknik kimliklerde korunabilir.

`PR-218`–`PR-241`; sürüm kanalı renk/saydamlık sistemini, güvenli parola görünürlüğünü, kurulum adlandırma ve yaşam döngüsü kanıtını, atomik sürüm numarasını, 30 günlük deneme/Gold etkinleştirmeyi, kaldırma-yedek-sıfırlama sınırını, tepsiye küçülmeyi, veri koruyan migration/rollback sözleşmesini, ek kararların ana sicillere/Git teslimine bağlanmasını, eski installer temizliğini, görünür sürüm kanalının tek kez gösterilmesini, her işlem öncesi zorunlu kural kontrolünü, geçişli sesli kurulum kabul zincirini, Bronze/Silver/Gold kanal yalıtımını, her mutasyon sonrası exact-commit teslim kanıtını, legacy kök dışındaki kardeş kanal program yollarını, açık tek seferli sürüm tahsisini, kanonik kurulu Windows yükseltme/maintenance/UAT zincirini, her küçük değişiklikte bütün bağımlı kayıt/test kapanışını ve yalnız Bronze 51 rejected-predecessor recovery bootstrap yolunu düzenler.

`PR-220` önce `PR-228`, ardından `PR-234` ile değiştirilmiş; `PR-234` exact nested-path hükmü ise `PR-236` ile superseded edilmiştir. Güncel teknik teslim kuralı kanal yalıtımlıdır: `C:\Program Files\PPT\ParsYuva-<Kanal>`, `ParsYuva-<Kanal>.exe`, `ParsYuva <Kanal>` kısayolu, `ParsYuva/<Kanal>` AppData kökü ve `ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe` dağıtım adıdır.

`PR-229`; kaynak kod veya Windows paketleme davranışı değiştiğinde önceki ParsYuva installer `EXE`, `.blockmap` ve `.sha256` artefaktlarını geçersiz sayar ve yeni build öncesinde silinmelerini zorunlu kılar. Release klasörü boş olabilir; installer bulunduğunda yalnız güncel görünür sürüme ait en fazla bir set kabul edilir.

`PR-230`; Bronze, Silver ve Gold görünür sürüm satırlarında kanal adının tam bir kez bulunmasını zorunlu kılar. Kanal `releaseLabel` içinde kalır; `stage` kanal adı içeremez ve tüm Türkçe/İngilizce uygulama yüzeyleri aynı ortak biçimlendiriciyi kullanır.

`PR-231`; her durum değiştiren işlem öncesinde kural sicili, yeniden hesaplanan hash, kullanıcı onayı ve tüm aktif enforcement bağlarının doğrulanmasını zorunlu kılar. Kontrol PASS olmadan işlem başlayamaz; kural değişiminden sonra kontrol yenilenir ve waiver/atlama kullanılamaz.

`PR-232`, `PR-233` ile superseded edilmiştir. `PR-233`; ilk kullanıcı oluşturma diliyle üç bilgi kartı arasında geçiş yapan fakat sahte ilerleme göstermeyen özel installer, Türkçe/İngilizce aynı dil kadın sesi önceliği ve erkek/kurulu aynı dil ses yedeği, eski tek pars marka görseli, 900x640 reflow, kilitli oturumda kasayı koruyan yeniden doğrulama, güvenilir cihaz kurulumu için kapalı bootstrap kanalları, veri koruyan yükseltme, temiz tam derleme, paketli runtime sınaması ve GitHub + haricî Git + geri-okumalı haricî kaynak arşivini tek teslim kapısına bağlar.

`PR-234`, `PR-236` ile superseded edilmiştir. Nested program kökü tarihsel kalır; kanal kimliği, veri ve worktree yalıtımı `PR-236` içinde korunur.

`PR-235`; her mutasyondan sonra exact changed-file etki analizini bağlı kural, karar, aktif belge, manifest, ratchet, test ve UAT kapsamıyla eşler. Baseline repo içinde yalnız pointer olarak, Bronze kanalına sabit harici append-only SHA-256 zincirinde exact tree/fingerprint ve işlem-kural/producer SHA bağlarıyla tutulur. Tek seferlik `BOOTSTRAP_ADOPTION` diff tabanı sabit kalır; producer yalnız pointer `sourceCommit` kayıt commitinde external-pointer exact eşitliği ve `base → pointer → HEAD` ancestry altında doğrulanır. Normal `PRE_MUTATION` producer bağı baseline commitinde kalır. Assessment `sourceCommit` değeri canlı release provenance HEAD, `baselineCommit` değeri doğrulanmış harici baseline pointer HEAD ile exact eşleşmeden hiçbir analiz, postflight, builder veya paket provenance tüketicisi ilerleyemez. Hedefli test yalnız repo içi `.test.ts` dosyaları ve sabit worker argümanlarıyla çalışır. Kalıcı completion ve paketleme aynı temiz kanal commitine bağlı hedefli test, tam regresyon ve kaynak bütünlüğü PASS olmadan; installer teslimi ise paket sonrasında aynı commit ve paket provenance'ına bağlı gerçek kurulu ana EXE UAT PASS olmadan yapılamaz.

`PR-236`; Bronze, Silver ve Gold programlarını legacy `ParsYuva` kökünün dışındaki `C:\Program Files\PPT\ParsYuva-<Kanal>` kardeş dizinlerine taşır; AppData `ParsYuva/<Kanal>` olarak kalır. Interactive kaldırıcı signed-in kullanıcı bağlamına geçip her çıkışta all-users bağlamını geri yükler. Legacy 37–44 kökünde kanal dizini varsa recursive silme fail-closed durur; otomatik legacy veri taşıma veya silme yoktur.

`PR-237`; sürüm tahsisini zorunlu expected release ID ile ayrı ve tek seferli mutasyon yapar. Preview salt okunurdur; mismatch herhangi yazıma veya temizliğe geçmeden durur. Signed/local/dir paket girişleri yalnız önceden tahsis edilmiş exact current kimliği tüketir ve tarihsel kanıtlar değişmeden kalır.

`PR-238`, `PR-239` ile superseded edilmiştir. `PR-239`; Bronze 50 için previous package/runtime kabul etmeyen temiz bootstrap ilk kurulum + same-version maintenance ve normal sequence 52+ için immutable önceki package arşiviyle canlı sibling N runtime'ı bağlayan exact N→N+1 + maintenance modlarını UAT110 V3 union sözleşmesiyle ayırır. Zorunlu installer-experience V2, parent-run bağlı UAT111 V3 ve final V3 makbuzları source/producer/path/hash/kronoloji/screenshot/secret geri-okumalarıyla kanıtlanır. Tracked TypeScript kaynağından türetilen exact modül/rota otoritesi, tüm uygun kontrollerin dinamik outcome kapsamı, gerçek native CANCEL/ACCEPT ve reparse içermeyen exclusive kanıt kökü zorunludur; guard kaybında path temizliği yapılmaz. Legacy nested runtime trusted predecessor değildir. NotSigned/Kaspersky koruması kapalı test üretim kanıtı değildir.

`PR-240`; en küçük değişiklikte dahi etkilenen ana/kanal kaynakları, kural-karar sicilleri, aktif ve ticari belgeler, iş listesi, kapsam/envanter/ratchet/manifest/indeks, güncel ana DOCX/PDF ve kanıt sözleşmelerinin aynı zincirde güncellenmesini zorunlu kılar. Her değişiklik hedefli ve filtresiz tam regresyon, typecheck, sözdizimi ve kaynak bütünlüğü; UI etkisinde tüm modül/rota/menü/kontrol/durum/erişilebilirlik/görsel bütünlük UAT'ı gerektirir. Gerçek test hatası `wip(rejected)` checkpoint olarak kaydedilir; bütün kapanış tamamlanmadan ara installer üretilemez.

`PR-241`; exact Bronze 51 recovery fresh-install yolunu immutable rejected Bronze 50 tarihçesinden ayırır. Bronze 52 `REJECTED_INSTALLER_VISUAL_UAT_FAIL` olduğunda Bronze 53 normal continuation öncesi yalnız no-launch, non-delivery teknik predecessor receipt'i kullanılabilir; receipt canlı .51, immutable .51/.52 bundle, .52 installer/runtime, AppData ve diğer kanal/legacy sınırlarını exact geri okur. UAT110 ve final teslim bu receipt'in UUID yolunu, boyutunu, SHA-256/producer bağını ve canlı .52 runtime'ı doğrulamadan başlayamaz. Diğer sequence 52+ normal semantiği ve bütün exact test/UAT kapıları değişmez.

## Aşılmaz uygulama

Her oturum ve sürüm GOVERNED_PREFLIGHT ile başlar. Her teslim GOVERNED_POSTFLIGHT ile kapanır. Güncel kural hash'i doğrulanmadan kod değişikliği başlatılamaz. Eski Ana Build Defteri ve RC/MVP/Build belgeleri yalnız tarihsel kanıttır.

## Kural değişikliği

Kural yalnız açık kullanıcı kararı, yeni DEC kaydı, yeni görünür aylık sürüm, yeni kural sicili sürümü ve yeni SHA-256 ile değişebilir. Sessiz istisna yoktur.
