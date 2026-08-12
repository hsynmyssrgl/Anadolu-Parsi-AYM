# DEC-208 — B0-03/B0-04 ürün yüzeyi ve Feature Reality Gate

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B0-03, B0-04
- Uygulama paketi: 32-W

## Karar

Ürünün kanonik masaüstü yüzeyi, tek domain sözleşmesinde tanımlanan **17 ürün
modülü + 5 yönetişim yüzeyi = 22 rota** olarak kabul edilmiştir. Renderer menüsü
ve dört menü grubu bu sözleşmeden üretilir; ayrı `ScreenId`, rota veya menü
listesi tutulmaz. Her rota exact bir ekran dispatch koluna sahip olmak zorundadır.

Tarihsel “16 modül” ifadesi; Yetkiler ve Ayarlar gibi kontrol yüzeylerini ürün
modülü sayarken sonradan gelen Haneler, Kişi Profilleri ve Davetler akışlarını
ayrı sınıflandırmamasından doğmuştur. Yeni ayrım işlev silmez: 17 kullanıcı iş
akışı ürün modülü, 5 güvenlik/işletim yüzeyi yönetişim sınıfıdır.

Preload'da tanımlı ve main süreçte kayıtlı olduğu halde renderer tarafından
çağrılmayan exact 14 API, kapalı bir sınıflandırma taksonomisine bağlanmıştır:
`BACKGROUND_OPERATIONAL`, `DIAGNOSTIC_OPERATOR_API` veya
`SUPERSEDED_READ_MODEL`. Sınıflandırma API'yi kendiliğinden silme yetkisi vermez;
B9-01 uyumluluk taramasında `RETAIN_NON_UI` ya da kontrollü kaldırma kararı ayrıca
verilir.

## Fail-closed uygulama

`verify-product-surface-governance.mjs` route, menü, ekran ve kullanılmayan API
envanterini doğrudan kaynak koddan çıkarır. Eksik, fazla, duplicate veya
sınıflandırılmamış kayıt `pretypecheck` ve `prebuild` aşamalarını durdurur.
Feature Reality Gate, `COMPLETE` durumundaki her gereksinimin 13 zincir alanının
tamamını `true` bulmak zorundadır. Kapının negatif öz-testleri eksik zincir,
sahte API ve eksik rota mutasyonlarını reddeder.

## Veri ve migration sınırı

Bu paket kullanıcı verisi değil, kaynak kod yönetişim sözleşmesi ekler. Yeni
SQLite migration, backfill, gerçek veri taşıma, cutover veya Desktop vault
sahiplik değişimi yoktur; latest migration 77 olarak kalır.

## Kapanış sınırı

B0-03 ve B0-04 birlikte tamamlanır. Yüzlerce açık Bronze gereksinimi ve diğer
kapanış kapıları bulunduğu için B9-01, Silver readiness ve Bronze Final bu
kararla tamamlanmış sayılmaz.
