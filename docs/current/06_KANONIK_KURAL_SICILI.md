# Kanonik Kural Sicili

- Görünür sürüm: **Bronze 20.08.2026.37**
- Sicil kimliği: `PPT-CANONICAL-RULE-REGISTRY-V16`
- Toplam kural: **228**
- Aktif kural: **207**
- Açıkça superseded tarihsel kural: **21**
- Kural SHA-256: `c7cd9a0b82e58d3bf9dbc3aca7cf38d452b73b7e5bc361690e84d94821a7b25d`
- Makine okunur tek aktif kaynak: `config/canonical-rule-registry.json`

`PR-186` her bağlayıcı kararın aynı sürümde DEC ve makine defterine kaydını, `PR-187` bilinen belge/kod/kural driftinde kapanış yasağını getirir. `DEC-251` ve `config/documentation-synchronization-policy.json` bu iki kuralı karar anında DEC + etkilenen belge + iş listesi açık/kapalı/neden güncellemesi olarak fail-closed uygular.

`PR-209`–`PR-214`; ParsYuva Aile Yaşam Merkezi tam ürün adı ve teknik uyumluluk sınırını, dış kurumsallaşma no-claim kapısını, aktif metadata'yı, yeni kalıcı kütüphane dalını, platform/cihaz ayrımını ve konu bazlı kurumsal belge yapısını bağlar.

`PR-215`; ilk açılışta sistem dilinin Electron ana sürecinde belirlenmesini, yalnız Türkçe ve İngilizce desteğini, desteklenmeyen/çözülemeyen dilde İngilizcenin güvenli varsayılan olmasını ve kullanıcının sonraki açılışlar için ana süreçte saklanan `system|tr|en` tercihini Ayarlar üzerinden değiştirebilmesini bağlar.

`PR-216`; kurulum öncesi sayfalarda hareketli sahte ilerlemeyi yasaklar ve yalnız yerel NSIS dosya kurulum ilerlemesinden okunan tek yüzde görünümüne izin verir.

`PR-217`; güncel ürün ve belge başlıklarında yalnız `ParsYuva Aile Yaşam Merkezi` tam adının kullanılmasını bağlar. `AYM` kısaltması kullanıcı yüzeylerinde yasaktır; yalnız değiştirilemeyen tarihsel kayıtlar ve geriye dönük uyumluluk için zorunlu teknik kimliklerde korunabilir.

`PR-218`–`PR-228`; sürüm kanalı renk/saydamlık sistemini, güvenli parola görünürlüğünü, kurulum adlandırma ve yaşam döngüsü kanıtını, atomik sürüm numarasını, 30 günlük deneme/Gold etkinleştirmeyi, kaldırma-yedek-sıfırlama sınırını, tepsiye küçülmeyi, veri koruyan migration/rollback sözleşmesini, ek kararların ana sicillere/Git teslimine bağlanmasını ve Windows kurulum yoluyla kısa teslim adını düzenler.

`PR-220` dosya adı bölümü `PR-228` ile değiştirilmiştir. Güncel teknik teslim kuralı: `C:\Program Files\PPT\ParsYuva`, `ParsYuva.exe`, `ParsYuva` kısayolu ve `ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe` dosya adıdır.

## Aşılmaz uygulama

Her oturum ve sürüm GOVERNED_PREFLIGHT ile başlar. Her teslim GOVERNED_POSTFLIGHT ile kapanır. Güncel kural hash'i doğrulanmadan kod değişikliği başlatılamaz. Eski Ana Build Defteri ve RC/MVP/Build belgeleri yalnız tarihsel kanıttır.

## Kural değişikliği

Kural yalnız açık kullanıcı kararı, yeni DEC kaydı, yeni görünür aylık sürüm, yeni kural sicili sürümü ve yeni SHA-256 ile değişebilir. Sessiz istisna yoktur.
