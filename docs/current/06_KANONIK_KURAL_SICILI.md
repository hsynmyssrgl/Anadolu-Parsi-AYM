# Kanonik Kural Sicili

- Görünür sürüm: **Bronze 04.08.2026.29**
- Sicil kimliği: `PPT-CANONICAL-RULE-REGISTRY-V9`
- Toplam kural: **208**
- Aktif kural: **194**
- Açıkça superseded tarihsel kural: **14**
- Kural SHA-256: `5e7e45b7c2ae9f3c7465866a58d9d389ef6a793dab855a68a1434e003eade081`
- Makine okunur tek aktif kaynak: `config/canonical-rule-registry.json`

`PR-186` her bağlayıcı kararın aynı sürümde DEC ve makine defterine kaydını, `PR-187` bilinen belge/kod/kural driftinde kapanış yasağını getirir. `DEC-251` ve `config/documentation-synchronization-policy.json` bu iki kuralı karar anında DEC + etkilenen belge + iş listesi açık/kapalı/neden güncellemesi olarak fail-closed uygular.

## Aşılmaz uygulama

Her oturum ve sürüm GOVERNED_PREFLIGHT ile başlar. Her teslim GOVERNED_POSTFLIGHT ile kapanır. Güncel kural hash'i doğrulanmadan kod değişikliği başlatılamaz. Eski Ana Build Defteri ve RC/MVP/Build belgeleri yalnız tarihsel kanıttır.

## Kural değişikliği

Kural yalnız açık kullanıcı kararı, yeni DEC kaydı, yeni görünür aylık sürüm, yeni kural sicili sürümü ve yeni SHA-256 ile değişebilir. Sessiz istisna yoktur.
