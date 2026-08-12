# DEC-201 — PPK-020 çok platformlu ortak policy conformance suite

## Durum

32-P kapsamında kabul edildi ve doğrulandı. PPK-020 hedefli matris, tam regresyon, üretim build'i, bütünlük kontrolleri ve iki aşamalı contract/runtime kanıtlarıyla `COMPLETE` durumundadır.

## Karar

Windows, macOS, iOS, iPadOS ve servis profilleri ayrı test mantığı kopyaları kullanmayacaktır. `PlatformPolicyConformanceSuite`, 14 kanonik `PlatformApplicationId` hedefinin her birine aynı sıralı 22 vaka kimliğini uygular. Vaka yürütümü mock bir karar nesnesiyle değil, gerçek `PlatformPolicyKernel.evaluate` çağrısıyla yapılır. Referans package imzası, policy/package/hash, decision authority, application version, capability manifest, device certificate, subject/resource scope, purpose, online ve cluster bağları testten önce exact doğrulanır.

Her hedefte baseline allow yanında invalid request, policy/package/authority/application/manifest/certificate sapmaları, undeclared capability, action ve data-class uyumsuzluğu, cihaz/membership/resource/purpose/offline/cluster retleri, explicit deny ve owner-or-grant retleri aynı sırada çalıştırılır. Context hash, geçerli isteklerde exact yeniden hesaplanır; invalid request context hash üretemez.

## Deployment doğrusu

Bugünkü gerçek runtime hedefleri yalnız `windows-desktop` ve `windows-core-service`tir. `macos-companion`, `ios-companion`, `ipados-companion`, diğer Apple profilleri, cluster agent, worker/service ve signed-plugin kimlikleri `NOT_DEPLOYED / PROFILE_ONLY` kalır. Ortak referans harness bu profillerin policy semantiğini test eder; native binary, OS entegrasyonu, dağıtım veya production capability yetkisi kanıtı sayılmaz. Bir native uygulama yayımlanmadan önce aynı suite'in o gerçek runtime/CI ortamında ayrıca çalışması zorunludur.

## Runtime ve istemci sınırı

Masaüstü yalnız content-free `PolicyConformanceSuiteBoundaryView` alır. Sıfır argümanlı IPC no-cache'tir ve test request/certificate/signing key/report payloadı taşımaz. Görünüm açıkça build-verified durumunu, iki deployed hedefi, on iki profile-only hedefi ve native Apple çalıştırması iddia edilmediğini gösterir.

## Şema ve sahiplik

Yeni migration veya repository persistence yoktur; latest migration 77 kalır. Gerçek kullanıcı verisi taşınmaz, backfill/cutover yapılmaz, Desktop vault ve SQLite sahipliği değiştirilmez. `schema` ve `repository` zincirleri bu açık “persistence gerekmez” kararıyla kapanır; yeni kanıt tablosu veya sahte platform satırı oluşturulmaz.

## Güvenlik ratchet'i

Statik gate; `skip/only`, vaka/hedef altkümesi, sahte native runtime iddiası, referans harness'e runtime yetkisi, yetkisiz suite compositionı ve duplicate case registry kaçışlarını reddeder. Root pretypecheck ve prebuild bu gate'i zorunlu çalıştırır.

## Ardıl kapsam

PPK-021 AST tabanlı yasaklı çağrı kapısı ve sonraki PPK paketleri bu kararla tamamlanmış sayılmaz. PPK-020 yalnız ortak policy conformance test sözleşmesini kapatır.

## Doğrulama durumu

İki hedefli test dosyası 26/26 test ve matris içinde 308/308 gerçek kernel değerlendirmesi; statik source gate, PPK-012–PPK-020 birleşik regresyonu, 71/71 dosya ve 636/636 tam Vitest, root/constituent TypeScript, 18 workspace üretim build'i, migration 77, foundation/runtime, tarihsel güvenlik kapıları, bağımlılık/workspace/karar defteri ve final contract/runtime demetleri gerçek PASS vermiştir.
