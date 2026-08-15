# DEC-203 — PPK-022 imzalı capability manifest build/runtime kapısı

## Durum

32-R kapsamında kabul edildi, uygulandı ve doğrulandı. Hedefli/tam test, production build, bağımlılık, yönetişim ve contract/runtime kanıt zinciri `COMPLETE` durumundadır.

## Karar

Kamera, mikrofon, dosya, OCR, AI, konum ve ağ kullanımı iki bağımsız ve birbirini tamamlayan kapıya bağlanacaktır:

1. Üretim TypeScript/JSX ağacı `@babel/parser` AST ile taranır. Her kaynak yüzeyi exact `kind|path|symbol` anahtarı, source-prefix ile sabit kanonik uygulama sahipliği, runtime capability ve exact bootstrap/signed-startup enforcement aşamasıyla manifestte bulunmalıdır. Parse edilemeyen kaynak, çözülemeyen dinamik import, yeni/stale/duplicate yüzey, owner/stage drift ve wildcard build'i durdurur.
2. Çalışma zamanında uygulamanın capability kümesi `PlatformApplicationIdentityManifest.runtimeCapabilities` içinde yer alır; bu alan manifest SHA-256'sına ve imzalı Platform Policy paketine dahildir. Uygulama kimliği, sürüm, manifest hash'i, paket hash'i veya capability exact coverage uyuşmazlığı fail-closed reddedilir.

Yedi kanonik runtime capability şunlardır: `camera.access`, `microphone.access`, `file.access`, `ocr.process`, `ai.process`, `location.access`, `network.access`. On dört kanonik uygulama exact registry'de bulunur. Deployed `windows-desktop` profili `file.access`, `network.access` ve yerel OCR için `ocr.process`; `windows-core-service` profili yalnız `file.access` ile `network.access` taşır. Diğer on iki profil boş capability kümesiyle not-deployed/profile-only kalır; özellikle `ocr-worker` capability kümesi boştur. Build kaydı veya profil tanımı yetki vermez. Mevcut Windows OCR child-process yürütümü için `lowPrivilegeSandboxVerified=false` gerçeği korunur; capability kaydı düşük ayrıcalık doğrulaması iddiası değildir.

## Başlangıç ve runtime otoritesi

Core Service imzalı politika paketini kurduktan hemen sonra on dört uygulamanın her biri için exact coverage kontrolü yapar ve sapmada dinleme sunucusunu açmaz. Desktop, authenticated yerel Core Service sağlık zarfındaki kendi signed application manifestini ve paket hash'ini doğrulamadan kullanıcı penceresini açmaz.

Desktop'ın bu authenticated el sıkışmasına ulaşabilmesi için gereken pre-handshake dosya bootstrap'ı ile yerel Core Service bağlantısı `assertPinnedBootstrapRuntimeCapability` üzerinden sırasıyla `file.access` ve `network.access` sabit baseline'ına pinlenir. Exact yüzey manifestinde 24 dosya ve 2 yerel bağlantı yüzeyi `PINNED_BOOTSTRAP_THEN_SIGNED` durumundadır. Bu pin yalnız bootstrap gereksinimini ispatlar. Build manifesti tek başına runtime yetkisi değildir; signed startup otoritesi ve mevcut PEP/receipt/IPC güvenlik sınırları ayrıca zorunludur.

## İstemci sınırı

Renderer yalnız content-free `PlatformCapabilityManifestGateBoundaryView` alır. Kanal sıfır argümanlı ve no-cache'tir. Kaynak yolları, exact manifest girdileri, manifest/paket hashleri, secret veya kullanıcı payloadı istemciye çıkmaz. UI, build manifestinin tek başına runtime authority olmadığını açıkça gösterir.

## Şema ve sahiplik

Yeni migration veya repository persistence eklenmez; latest migration 77 kalır. Gerçek kullanıcı verisi taşıma, backfill, cutover, Desktop vault sahipliği ya da SQLite sahiplik aktarımı yapılmaz. PPK-012 offline capability lease ve hassas cache çiti ile mevcut policy-sensitive IPC no-cache kuralları zayıflatılmaz.

## Ardıl kapsam

PPK-023 her yeni uygulama için ASVS/MASVS/SSDF eşlemesi ve tehdit modelidir. DEC-203 bu ardıl gereksinimi tamamlamaz.

## Doğrulama durumu

Final doğrulamada 18 source zone, 355 dosya ve 237 exact capability yüzeyi 33 kötü niyetli ve 5 benign self-testle sıfır bulgu vermiştir. Üç hedefli dosyada 19/19 test, PPK-012–PPK-022 regresyonunda 264/264 test ve tam Vitest'te 77/77 dosya ile 672/672 test geçmiştir. On sekiz workspace production build, migration 77, bağımlılık/workspace/karar defteri ve 108/108 contract ile 24/24 runtime kanıt demeti gerçek çalıştırmayla doğrulanmıştır.

34-B iletişim mesajlaşma yaşam döngüsü ve korumalı payload kasası bileşimi sonrasındaki güncel source ratchet, tarihsel kapanış sayılarını değiştirmeden, 18 zone / 507 dosya / 360 exact capability yüzeyini sıfır bulguyla bağlar. Güncel manifest SHA-256 değeri `b4b2f09c461235528f98c3f4b942e28a9e3068c71de5697fe116e4b57f54c77c` olarak sabitlenmiştir; 26 bootstrap yüzeyi değişmemiştir.
