# PPK-014 sürümlü Core Service API tehdit modeli

## Korunan varlıklar

- Core Service politika karar otoritesi ve uygulama servisi yöntemleri.
- İstemci uygulama kimliği ile imzalı politika paketindeki uygulama sürümü bağı.
- Yerel yönetim taşımasının kimlik doğrulama belirteci, istek ve yanıt bütünlüğü.
- Desktop kasası, etkin SQLite oturumu ve PPK-012 hassas önbellek/no-cache sınırları.
- DEC-171 ile kapalı tutulan gerçek veri taşıma ve yazma sahipliği cutover otoritesi.

## Güven sınırları

1. Core Service süreci yetkili uygulama servislerinin ve politika çekirdeğinin sahibidir.
2. Core Service dışındaki uygulama kaynakları yalnız `@ppt/core-service-client` kullanan tek Desktop uygulama adaptörüne ulaşabilir; Core Service iç kaynaklarına, yerel sokete veya istemci SDK'sına başka üretim modülünden erişemez.
3. Adaptör ile Core Service arasındaki yerel named-pipe/socket taşıması korumalı başlangıç otoritesinden gelen belirteçle kimlik doğrular.
4. Sunucu, kimlik doğrulamadan sonra zarfı protokol sürümü, API sürümü, istemci uygulama kimliği, imzalı uygulama sürümü, yöntem, zaman ve tekrar kimliği ile doğrular.
5. İstemci yanıtı protokol/API sürümü, sunucu uygulama kimliği, istek kimliği ve tam alan kümesiyle doğrular.

## Tehditler ve kontroller

| Tehdit | Fail-closed kontrol |
| --- | --- |
| Core Service iç modülünü doğrudan import ederek dispatcher/policy atlama | Bütün Core dışı `apps/*/src` alanını tarayan derleme öncesi kaynak kapısı; sıfır istisna kaydı |
| İstemci SDK'sını yetkisiz üretim modülünden veya doğrudan socket primitive'iyle kullanma | Tek izinli Desktop adaptörü ve kötü niyetli öz-sınamalı statik kapı |
| API/protokol downgrade veya farklı uygulama kimliğiyle çağrı | Tam zarf, sabit protokol/API sürümü ve yalnız `windows-desktop` kimliği |
| Dağıtılmış istemcinin imzalı sürümünü taklit etme | İstek sürümünün Core Service API sürümü ve imzalı politika paketindeki istemci uygulama sürümüyle exact eşleşmesi |
| Bilinmeyen yönteme ya da veri sağlayıcısına geçiş | Kanonik tipli yöntem allowlist'i; bilinmeyen yöntem callback açılmadan ret |
| Fazladan alanla confused-deputy veya bozuk veri saldırısı | İstek ve yanıt zarflarında exact anahtar kümesi; düz nesne ve biçim doğrulaması |
| Eski, gelecek zamanlı veya yeniden oynatılan istek | Kesin yaş sınırı, ileri saat kayması sınırı ve süreç başına bounded tekrar defteri |
| Tekrar defterini doldurarak korumayı devre dışı bırakma | Kapasitede kayıt tahliyesiyle sessiz gevşeme yerine `REPLAY_STATE_CAPACITY_EXCEEDED` fail-closed reddi |
| Sahte/bozuk sunucu yanıtı | İstemcide exact yanıt zarfı, kanonik hata kodu, sunucu uygulama kimliği ve istek kimliği doğrulaması |
| API durumu üzerinden yol, anahtar veya cutover yetkisi sızdırma | Durum sözleşmesinde `persistentPathExposed`, `secretMaterialExposed` ve `cutoverAuthorityAttached` sabit `false` |

## Kalan riskler

- Tekrar defteri süreç içidir; Core Service yeniden başladığında önceki süreç kimliklerini taşımaz. Kısa istek ömrü ve korumalı yerel kimlik doğrulama bu sürümdeki sınırdır.
- Yerel belirtecin güvenli üretimi ve başlangıç authority dosyasının korunması mevcut Core Service başlangıç mimarisinin sorumluluğundadır; bu paket anahtar yaşam döngüsünü veya Windows Service kurulumunu değiştirmez.
- Gelecekte yeni istemci uygulaması eklemek ayrı imzalı manifest, allowlist, sözleşme ve hedefli güvenlik kanıtı gerektirir.

## Gerçeklik sınırı

Bu paket gerçek kullanıcı verisi taşımaz, oturum bağlamaz, SQLite sahipliğini değiştirmez ve Desktop kasa yapısını bozmaz. Yeni tablo/migration gerekmez. DEC-171 cutover yasağı, PPK-012 hassas cache/no-cache çiti ve PPK-013 doğrudan veri erişim yasağı aynen korunur.
