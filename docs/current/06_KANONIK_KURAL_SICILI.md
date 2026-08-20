# Kanonik Kural Sicili

- Görünür sürüm: **Bronze 20.08.2026.35**
- Sicil kimliği: `PPT-CANONICAL-RULE-REGISTRY-V13`
- Toplam kural: **217**
- Aktif kural: **197**
- Açıkça superseded tarihsel kural: **20**
- Kural SHA-256: `5b83854fb2d21e978ffe1dc79cfbcf180547f42d06cd32a8ba7918a58cf1a0ed`
- Makine okunur tek aktif kaynak: `config/canonical-rule-registry.json`

`PR-186` her bağlayıcı kararın aynı sürümde DEC ve makine defterine kaydını, `PR-187` bilinen belge/kod/kural driftinde kapanış yasağını getirir. `DEC-251` ve `config/documentation-synchronization-policy.json` bu iki kuralı karar anında DEC + etkilenen belge + iş listesi açık/kapalı/neden güncellemesi olarak fail-closed uygular.

`PR-209`–`PR-214`; ParsYuva AYM marka ve teknik uyumluluk sınırını, dış kurumsallaşma no-claim kapısını, aktif metadata'yı, yeni kalıcı kütüphane dalını, platform/cihaz ayrımını ve konu bazlı kurumsal belge yapısını bağlar.

`PR-215`; ilk açılışta sistem dilinin Electron ana sürecinde belirlenmesini, yalnız Türkçe ve İngilizce desteğini, desteklenmeyen/çözülemeyen dilde İngilizcenin güvenli varsayılan olmasını ve kullanıcının sonraki açılışlar için ana süreçte saklanan `system|tr|en` tercihini Ayarlar üzerinden değiştirebilmesini bağlar.

`PR-216`; kurulum öncesi sayfalarda hareketli sahte ilerlemeyi yasaklar ve yalnız yerel NSIS dosya kurulum ilerlemesinden okunan tek yüzde görünümüne izin verir.

`PR-217`; ürün ve belge başlıklarında yalnız `ParsYuva AYM` kullanılmasını bağlar. `AYM` kısaltması ile `Aile Yaşam Merkezi` aynı başlıkta tekrar edilemez; açık uzun ad yalnız ayrı açıklama veya hukuk metninde kullanılabilir.

## Aşılmaz uygulama

Her oturum ve sürüm GOVERNED_PREFLIGHT ile başlar. Her teslim GOVERNED_POSTFLIGHT ile kapanır. Güncel kural hash'i doğrulanmadan kod değişikliği başlatılamaz. Eski Ana Build Defteri ve RC/MVP/Build belgeleri yalnız tarihsel kanıttır.

## Kural değişikliği

Kural yalnız açık kullanıcı kararı, yeni DEC kaydı, yeni görünür aylık sürüm, yeni kural sicili sürümü ve yeni SHA-256 ile değişebilir. Sessiz istisna yoktur.
