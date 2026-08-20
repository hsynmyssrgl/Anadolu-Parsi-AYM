# DEC-260 — Ek kural toplu birleştirme ve doğrulanmış Git teslimi

- Tarih: 20.08.2026
- Durum: ACTIVE
- Görünür sürüm: Bronze 20.08.2026.36

## Karar

18.08.2026 tarihli ek kural tamponundaki `EK-001`–`EK-019` kayıtları tarihsel kaynak olarak korunur; aktif davranış doğrudan bu tampon dosyadan okunmaz. Her kayıt çatışma ve daha yeni karar denetiminden geçirilerek kanonik kural siciline, kullanıcı karar defterine, güncel ana sicile, ticari temel iş listesine ve yürütme kapılarına bağlanır.

Yenier marka kararları eski `Anadolu Parsı AYM` kısayol kararını geçersiz kılar. Aktif ürün adı `ParsYuva AYM`, kurulum dosya adı ASCII karakterli ve Türkçe anlamlıdır. Eski kayıt silinmez; `SUPERSEDED` eşlemesiyle tarihsel tutulur.

## Teslim zinciri

Bir yerel teslim ancak aşağıdaki zincir aynı kaynak anlık görüntüsünde kanıtlanırsa tamamlanmış sayılır:

1. karar ve kural senkronizasyonu,
2. governed preflight,
3. tam test ve typecheck,
4. tüm üretim derlemeleri,
5. installer doğrulaması ve paket üretimi,
6. paket hash ve imza gerçeği,
7. kurulu uygulama açılış, tek örnek, tepsiye küçülme ve tam kapanış kontrolü,
8. temiz çalışma ağacı ve iki Git uzak deposunda aynı commit.

## Dürüst sınırlar

- Yerel imzasız kurulum paketi kullanıcı testine verilebilir; Authenticode üretim yayını sayılamaz.
- Mevcut bilgisayardaki smoke testi temiz Windows makine/VM UAT’si yerine geçmez.
- Gold etkinleştirme üretim anahtarı, mağaza/sağlayıcı hesabı, hukuk-gizlilik-vergi onayı ve fiziksel bulut silme kanıtı dış kaynaktır; `NOT_RUN` veya `BLOCKED_EXTERNAL` kalır.
- Tarihsel belgeler değiştirilmez ve aktif karar otoritesi sayılmaz.

## Kanıt

- `docs/current/15_EK_KURAL_TOPLU_BIRLESTIRME_SICILI.md`
- `config/canonical-rule-registry.json`
- `config/rule-enforcement-registry.json`
- `artifacts/validation/governed-preflight.json`
- `artifacts/manifests/PROJECT_ARTIFACT_INDEX.json`
