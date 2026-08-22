# Kanonik Kural Sicili

- Görünür sürüm: **Bronze 22.08.2026.45**
- Sicil kimliği: `PPT-CANONICAL-RULE-REGISTRY-V20`
- Toplam kural: **232**
- Aktif kural: **211**
- Açıkça superseded tarihsel kural: **21**
- Kural SHA-256: `a11d80649bc74759371fe68f7f5b8c0ab12c1cd6a9e77e09c7e96a9a3a7e068b`
- Makine okunur tek aktif kaynak: `config/canonical-rule-registry.json`

`PR-186` her bağlayıcı kararın aynı sürümde DEC ve makine defterine kaydını, `PR-187` bilinen belge/kod/kural driftinde kapanış yasağını getirir. `DEC-251` ve `config/documentation-synchronization-policy.json` bu iki kuralı karar anında DEC + etkilenen belge + iş listesi açık/kapalı/neden güncellemesi olarak fail-closed uygular.

`PR-209`–`PR-214`; ParsYuva Aile Yaşam Merkezi tam ürün adı ve teknik uyumluluk sınırını, dış kurumsallaşma no-claim kapısını, aktif metadata'yı, yeni kalıcı kütüphane dalını, platform/cihaz ayrımını ve konu bazlı kurumsal belge yapısını bağlar.

`PR-215`; ilk açılışta sistem dilinin Electron ana sürecinde belirlenmesini, yalnız Türkçe ve İngilizce desteğini, desteklenmeyen/çözülemeyen dilde İngilizcenin güvenli varsayılan olmasını ve kullanıcının sonraki açılışlar için ana süreçte saklanan `system|tr|en` tercihini Ayarlar üzerinden değiştirebilmesini bağlar.

`PR-216`; kurulum öncesi sayfalarda hareketli sahte ilerlemeyi yasaklar ve yalnız yerel NSIS dosya kurulum ilerlemesinden okunan tek yüzde görünümüne izin verir.

`PR-217`; güncel ürün ve belge başlıklarında yalnız `ParsYuva Aile Yaşam Merkezi` tam adının kullanılmasını bağlar. `AYM` kısaltması kullanıcı yüzeylerinde yasaktır; yalnız değiştirilemeyen tarihsel kayıtlar ve geriye dönük uyumluluk için zorunlu teknik kimliklerde korunabilir.

`PR-218`–`PR-232`; sürüm kanalı renk/saydamlık sistemini, güvenli parola görünürlüğünü, kurulum adlandırma ve yaşam döngüsü kanıtını, atomik sürüm numarasını, 30 günlük deneme/Gold etkinleştirmeyi, kaldırma-yedek-sıfırlama sınırını, tepsiye küçülmeyi, veri koruyan migration/rollback sözleşmesini, ek kararların ana sicillere/Git teslimine bağlanmasını, Windows kurulum yoluyla kısa teslim adını, eski installer temizliğini, görünür sürüm kanalının tek kez gösterilmesini, her işlem öncesi zorunlu kural kontrolünü ve özel kurulumdan çift yedeğe uzanan temiz teslim kabul zincirini düzenler.

`PR-220` dosya adı bölümü `PR-228` ile değiştirilmiştir. Güncel teknik teslim kuralı: `C:\Program Files\PPT\ParsYuva`, `ParsYuva.exe`, `ParsYuva` kısayolu ve `ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe` dosya adıdır.

`PR-229`; kaynak kod veya Windows paketleme davranışı değiştiğinde önceki ParsYuva installer `EXE`, `.blockmap` ve `.sha256` artefaktlarını geçersiz sayar ve yeni build öncesinde silinmelerini zorunlu kılar. Release klasörü boş olabilir; installer bulunduğunda yalnız güncel görünür sürüme ait en fazla bir set kabul edilir.

`PR-230`; Bronze, Silver ve Gold görünür sürüm satırlarında kanal adının tam bir kez bulunmasını zorunlu kılar. Kanal `releaseLabel` içinde kalır; `stage` kanal adı içeremez ve tüm Türkçe/İngilizce uygulama yüzeyleri aynı ortak biçimlendiriciyi kullanır.

`PR-231`; her durum değiştiren işlem öncesinde kural sicili, yeniden hesaplanan hash, kullanıcı onayı ve tüm aktif enforcement bağlarının doğrulanmasını zorunlu kılar. Kontrol PASS olmadan işlem başlayamaz; kural değişiminden sonra kontrol yenilenir ve waiver/atlama kullanılamaz.

`PR-232`; özel marka uyumlu installer, 900x640 ölçekli üç pars aile ekranı, aynı dilde kadın ses önceliği ve erkek ses yedeği, belirgin simgeler, atomik SQLite ilk kurulum, veri koruyan yükseltme, temiz tam derleme, paketli runtime sınaması ve GitHub + haricî Git + geri-okumalı haricî kaynak arşivini tek teslim kapısına bağlar.

## Aşılmaz uygulama

Her oturum ve sürüm GOVERNED_PREFLIGHT ile başlar. Her teslim GOVERNED_POSTFLIGHT ile kapanır. Güncel kural hash'i doğrulanmadan kod değişikliği başlatılamaz. Eski Ana Build Defteri ve RC/MVP/Build belgeleri yalnız tarihsel kanıttır.

## Kural değişikliği

Kural yalnız açık kullanıcı kararı, yeni DEC kaydı, yeni görünür aylık sürüm, yeni kural sicili sürümü ve yeni SHA-256 ile değişebilir. Sessiz istisna yoktur.
