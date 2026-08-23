# Kanonik Kural Sicili

- Görünür sürüm: **Bronze 22.08.2026.50**
- Sicil kimliği: `PPT-CANONICAL-RULE-REGISTRY-V22`
- Toplam kural: **234**
- Aktif kural: **211**
- Açıkça superseded tarihsel kural: **23**
- Kural SHA-256: `67462d63e873b68a1eacfb358f904226d9199f99c81950645e05350df9963506`
- Makine okunur tek aktif kaynak: `config/canonical-rule-registry.json`

`PR-186` her bağlayıcı kararın aynı sürümde DEC ve makine defterine kaydını, `PR-187` bilinen belge/kod/kural driftinde kapanış yasağını getirir. `DEC-251` ve `config/documentation-synchronization-policy.json` bu iki kuralı karar anında DEC + etkilenen belge + iş listesi açık/kapalı/neden güncellemesi olarak fail-closed uygular.

`PR-209`–`PR-214`; ParsYuva Aile Yaşam Merkezi tam ürün adı ve teknik uyumluluk sınırını, dış kurumsallaşma no-claim kapısını, aktif metadata'yı, yeni kalıcı kütüphane dalını, platform/cihaz ayrımını ve konu bazlı kurumsal belge yapısını bağlar.

`PR-215`; ilk açılışta sistem dilinin Electron ana sürecinde belirlenmesini, yalnız Türkçe ve İngilizce desteğini, desteklenmeyen/çözülemeyen dilde İngilizcenin güvenli varsayılan olmasını ve kullanıcının sonraki açılışlar için ana süreçte saklanan `system|tr|en` tercihini Ayarlar üzerinden değiştirebilmesini bağlar.

`PR-216`; kurulum öncesi sayfalarda hareketli sahte ilerlemeyi yasaklar ve yalnız yerel NSIS dosya kurulum ilerlemesinden okunan tek yüzde görünümüne izin verir.

`PR-217`; güncel ürün ve belge başlıklarında yalnız `ParsYuva Aile Yaşam Merkezi` tam adının kullanılmasını bağlar. `AYM` kısaltması kullanıcı yüzeylerinde yasaktır; yalnız değiştirilemeyen tarihsel kayıtlar ve geriye dönük uyumluluk için zorunlu teknik kimliklerde korunabilir.

`PR-218`–`PR-234`; sürüm kanalı renk/saydamlık sistemini, güvenli parola görünürlüğünü, kurulum adlandırma ve yaşam döngüsü kanıtını, atomik sürüm numarasını, 30 günlük deneme/Gold etkinleştirmeyi, kaldırma-yedek-sıfırlama sınırını, tepsiye küçülmeyi, veri koruyan migration/rollback sözleşmesini, ek kararların ana sicillere/Git teslimine bağlanmasını, eski installer temizliğini, görünür sürüm kanalının tek kez gösterilmesini, her işlem öncesi zorunlu kural kontrolünü, geçişli sesli kurulum kabul zincirini ve Bronze/Silver/Gold kanal yalıtımını düzenler.

`PR-220` önce `PR-228` ile değiştirilmiş, `PR-228` ise `PR-234` ile superseded edilmiştir. Güncel teknik teslim kuralı kanal yalıtımlıdır: `C:\Program Files\PPT\ParsYuva\<Kanal>`, `ParsYuva-<Kanal>.exe`, `ParsYuva <Kanal>` kısayolu ve `ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe` dağıtım adıdır.

`PR-229`; kaynak kod veya Windows paketleme davranışı değiştiğinde önceki ParsYuva installer `EXE`, `.blockmap` ve `.sha256` artefaktlarını geçersiz sayar ve yeni build öncesinde silinmelerini zorunlu kılar. Release klasörü boş olabilir; installer bulunduğunda yalnız güncel görünür sürüme ait en fazla bir set kabul edilir.

`PR-230`; Bronze, Silver ve Gold görünür sürüm satırlarında kanal adının tam bir kez bulunmasını zorunlu kılar. Kanal `releaseLabel` içinde kalır; `stage` kanal adı içeremez ve tüm Türkçe/İngilizce uygulama yüzeyleri aynı ortak biçimlendiriciyi kullanır.

`PR-231`; her durum değiştiren işlem öncesinde kural sicili, yeniden hesaplanan hash, kullanıcı onayı ve tüm aktif enforcement bağlarının doğrulanmasını zorunlu kılar. Kontrol PASS olmadan işlem başlayamaz; kural değişiminden sonra kontrol yenilenir ve waiver/atlama kullanılamaz.

`PR-232`, `PR-233` ile superseded edilmiştir. `PR-233`; ilk kullanıcı oluşturma diliyle üç bilgi kartı arasında geçiş yapan fakat sahte ilerleme göstermeyen özel installer, Türkçe/İngilizce aynı dil kadın sesi önceliği ve erkek/kurulu aynı dil ses yedeği, eski tek pars marka görseli, 900x640 reflow, kilitli oturumda kasayı koruyan yeniden doğrulama, güvenilir cihaz kurulumu için kapalı bootstrap kanalları, veri koruyan yükseltme, temiz tam derleme, paketli runtime sınaması ve GitHub + haricî Git + geri-okumalı haricî kaynak arşivini tek teslim kapısına bağlar.

`PR-234`; Bronze, Silver ve Gold için kurulum, EXE, kısayol, appId, kullanıcı veri kökü ve kaldırma kapsamını birbirinden ayırır. Kaynak kodları `C:\PPT\AYM\06_KOD\kanallar\<Kanal>` altında ayrı Git worktree ve branch olarak tutar; kanallar arasında build çıktısı veya kullanıcı verisi paylaşımını yasaklar.

## Aşılmaz uygulama

Her oturum ve sürüm GOVERNED_PREFLIGHT ile başlar. Her teslim GOVERNED_POSTFLIGHT ile kapanır. Güncel kural hash'i doğrulanmadan kod değişikliği başlatılamaz. Eski Ana Build Defteri ve RC/MVP/Build belgeleri yalnız tarihsel kanıttır.

## Kural değişikliği

Kural yalnız açık kullanıcı kararı, yeni DEC kaydı, yeni görünür aylık sürüm, yeni kural sicili sürümü ve yeni SHA-256 ile değişebilir. Sessiz istisna yoktur.
