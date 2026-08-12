# PPK-020 çok platformlu policy conformance tehdit modeli

## Korunan güvenlik özellikleri

- Her kanonik istemci ve servis kimliği aynı vaka kimliklerini aynı sırada çalıştırır.
- Testler gerçek `PlatformPolicyKernel`, imzalı package, application manifest ve device certificate doğrulamasını kullanır.
- Geçerli isteklerde exact context hash; bozuk isteklerde fail-closed ret korunur.
- Referans test harness'i production authority veya deployment kanıtı üretmez.
- Native uygulama yokken native runtime PASS yazılmaz.

## Tehditler ve kontroller

1. **Platforma özel vaka atlama:** `it.skip`, `test.only`, hedef/vaka slice/filter altkümesi ve farklı case registry statik gate ile reddedilir; test her target için exact `POLICY_CONFORMANCE_CASE_IDS` sırasını karşılaştırır.
2. **Mock karar ile sahte PASS:** suite doğrudan gerçek `PlatformPolicyKernel.evaluate` kullanır; signed package self-verification ve baseline binding tamamlanmadan rapor üretmez.
3. **Kimlik veya manifest karışması:** target applicationId, application version, capability manifest hash ve certificate application bağları exact doğrulanır.
4. **Policy/package/context sapması:** version, package version/hash, decision authority ve context hash negatif vakaları her hedefte çalışır.
5. **Device veya üyelik fail-open:** eksik/expired certificate, trusted=false ve membership=false retleri ortak matristedir.
6. **Capability/action/data-class gevşemesi:** undeclared capability, action mismatch ve cross-domain data-class mismatch vakaları her hedefte reddedilir.
7. **Offline/cluster/scope gevşemesi:** offline-only, cluster writable, family scope, purpose ve owner/grant retleri ortak matristedir.
8. **Native deployment sahteciliği:** Core Service uygulama sürüm kaydıyla suite target inventory birlikte kontrol edilir; on iki profil açıkça `not-deployed/profile-only` kalır.
9. **Test harness'in üretim yetkisine dönüşmesi:** snapshot `referenceHarnessGrantsRuntimeAuthority=false`; fixture anahtarı yalnız test dosyasındadır ve production composition yalnız content-free snapshot üretir.
10. **IPC cache veya payload sızıntısı:** durum kanalı sıfır argümanlı ve no-cache'tir; renderer request, certificate, signing key, case sonucu veya report hash almaz.
11. **Rapor tamperi:** target report canonical SHA-256 ile bağlanır; case sonucu/sırası veya target descriptor değişirse `verify` reddeder.
12. **Migration ile sahte platform varlığı:** PPK-020 persistence eklemez; migration 77 değişmez ve native/profile gerçeği kaynak manifestinde tutulur.

## Sınırlar ve kalan risk

Bu suite policy semantiği uyumunu kanıtlar; macOS/iOS/iPadOS binary'sinin henüz var olduğunu, Apple signing/notarization, entitlements, sandbox, keychain veya gerçek cihaz davranışının doğrulandığını iddia etmez. İlgili runtime yayımlanmadan önce bu ortak suite native CI/device üzerinde çalıştırılmalı ve platforma özgü dağıtım kanıtı ayrıca üretilmelidir. Bu açık deployment gerçeği PPK-020 kapanışını engellemez; çünkü kabul şartı ortak suite'tir, henüz planlanmamış native ürün teslimi değildir.

Final doğrulamada hedefli 308 çekirdek değerlendirmesi, entegrasyon testleri, statik gate, tam regresyon, production build ve contract/runtime kanıt demeti gerçekten çalışmış ve PASS vermiştir. Gelecekte bir profile native runtime eklendiğinde bu modelin native doğrulama şartı yeniden açılır; mevcut `PROFILE_ONLY` gerçeği sessizce yükseltilemez.
