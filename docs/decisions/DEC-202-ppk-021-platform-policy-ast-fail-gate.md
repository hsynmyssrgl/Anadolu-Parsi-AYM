# DEC-202 — PPK-021 AST tabanlı fail-closed Platform Policy build kapısı

## Durum

32-Q kapsamında kabul edildi, uygulandı ve doğrulandı. PPK-021 hedefli AST/IPC testleri, tam regresyon, üretim build'i, bağımlılık ve yönetişim kontrolleri ile contract/runtime kanıt demetleri `COMPLETE` durumundadır.

## Karar

Üretim kaynak ağacındaki ayrıcalıklı kod yüzeyleri regex ile değil TypeScript/JSX AST üzerinden denetlenecektir. `@babel/parser` 7.29.8; import/export, dinamik import, `require`, alias, destructuring, computed property, `Reflect.construct`, Web Crypto ve global network düğümlerini sözdizimsel olarak ayrıştırır. SQL/SQLite, somut repository/database importu, kripto, network, doğrudan rol yetkilendirmesi ve use-case composition altı bağlayıcı kural ailesidir.

Mevcut meşru üretim yüzeyleri satır numarasına veya geniş klasör wildcard'ına değil exact `kind|path|symbol` anahtarına bağlanır. Yeni bir yüzey, kaldırılmış fakat allowlistte kalan stale kayıt, wildcard, tekrar eden kayıt, yetersiz gerekçe veya parse edilemeyen kaynak build'i durdurur. Direct role authorization hiçbir allowlist girdisiyle açılamaz. Renderer'daki rol koşulu yalnız presentation olabilir; backend yetkisi vermez.

## Statik ve runtime yetki ayrımı

AST kapısı bir build ratchet'idir; AST gate runtime policy yerine geçmez. `PlatformPolicyKernel`, PEP, current context, receipt, obligation, repository transaction veya runtime authorization ayrıca zorunludur. Allowlist girdisi runtime capability ya da erişim yetkisi oluşturmaz. Yeni use-case composition exact kayda girmiş olsa bile ilgili runtime policy ve fail-closed test zinciri ayrıca zorunludur.

## İstemci sınırı

Masaüstü yalnız content-free `PlatformPolicyAstGateBoundaryView` alır. IPC sıfır argümanlı ve no-cache'tir. Kaynak yolları, allowlist anahtarları, manifest hash'i, SQL, secret veya kullanıcı payloadı renderer'a çıkmaz. Arayüz build-verified AST durumunu ve statik kapının runtime policy yerine geçmediğini açıkça gösterir.

## Şema ve sahiplik

Yeni migration ve repository persistence yoktur; latest migration 77 kalır. Gerçek kullanıcı verisi taşıma, historical backfill, cutover, Desktop vault sahipliği veya SQLite sahiplik aktarımı yapılmaz. `schema`, `migration` ve `repository` zincirleri bu açık persistence-yokluğu kararı ve mevcut runtime enforcement'ın korunmasıyla kapanacaktır.

## Build zinciri

Gate root `pretypecheck`, `prebuild` ve birleşik `verify:platform-policy` akışına zorunlu eklenir. Kötü niyetli ve benign self-testler gate'in kendi başına; hedefli Vitest ise manifest drift, parse failure, direct role zero-exception, stale/wildcard ve content-free IPC/UI sözleşmelerini doğrular.

## Ardıl kapsam

PPK-022 capability manifest dışı kamera, mikrofon, dosya, OCR, AI, konum ve ağ kullanımının build/runtime reddidir; DEC-202 bu ardıl gereksinimi tamamlamaz.

## Doğrulama durumu

PPK-021 kapanışında üretim AST kapısı 18 source zone, 352 dosya ve 512 exact ayrıcalıklı yüzeyi 17 kötü niyetli ve 4 benign self-testle sıfır bulgu olarak doğruladı. Üç hedefli dosyada 17/17 test, PPK-012–PPK-021 birleşik regresyonda 245/245 test ve tam Vitest'te 74/74 dosya ile 653/653 test PASS verdi. On sekiz workspace production build, root lifecycle TypeScript, migration 77, tarihsel güvenlik kapıları, bağımlılık/workspace/karar defteri ve 83/83 contract ile 20/20 runtime demeti çalıştırıldı. PPK-026 ve 32-W entegrasyonları sonrasında aynı exact ratchet 18 zone / 372 dosya / 523 yüzeye ilerlemiş ve sıfır bulguyla yeniden doğrulanmıştır; bu ardıl artış PPK-021'in tarihsel kapanış sayılarını değiştirmez.

33-Q yerel OCR, şifreli arama indeksi ve explicit legacy arşiv sahiplik yeniden doğrulaması sonrasındaki güncel source ratchet, tarihsel kapanış kanıtını yeniden yazmadan, 18 zone / 442 dosya / 685 exact yüzeyi sıfır bulguyla bağlar. Güncel allowlist SHA-256 değeri `7713c4b422c9822f6a5505b7245e27032f34872e98843d3126cf6de9a285759e` olarak sabitlenmiştir.
