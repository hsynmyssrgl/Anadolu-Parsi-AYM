# PPK-022 capability manifest build/runtime kapısı tehdit modeli

Durum: `VALIDATED / COMPLETE`.

## Korunan özellikler

- Kamera, mikrofon, dosya, OCR, AI, konum ve ağ kaynak yüzeyleri exact build manifesti dışında kullanılamaz.
- Runtime capability kümesi uygulama manifest hash'i ve imzalı policy package ile kriptografik olarak bağlıdır.
- On dört uygulamanın eksik veya beklenmeyen capability kümesi Core Service başlamadan reddedilir.
- Desktop signed/authenticated Core Service manifestini doğrulamadan operasyonel UI açmaz.
- Build manifesti, statik allowlist veya status UI hiçbir zaman runtime yetkisi sayılmaz.
- PPK-012 offline lease, hassas cache ve policy-sensitive no-cache çitleri korunur.

## Tehditler ve kontroller

1. **Beyansız statik import:** korunan Node, browser, kamera, mikrofon, OCR ve AI modülleri AST import düğümünden exact manifest yüzeyine bağlanır.
2. **Dinamik import/require kaçışı:** literal dynamic import, `require`, TypeScript `import = require`, protected re-export, `process.getBuiltinModule` ve `createRequire` aliası çözümlenir; statik çözülemeyen hedef fail-closed reddedilir.
3. **Alias ve computed property kaçışı:** global network/file constructor aliasları, destructuring, assignment, `.call/.apply/.bind`, `Reflect.apply/construct`, computed Electron çağrıları ve ilgili API düğümleri sözdizim ağacında yakalanır. JSX `input[type=file]` ve capture yüzeyi de dosya/kamera capability'sine bağlanır.
4. **Kamera ve mikrofon kaçışı:** `getUserMedia`, Desktop capture ve bilinen native modül aileleri iki ayrı capability olarak sınıflanır; production manifestte ikisi de beyan edilmediğinden yeni yüzey build'i durdurur.
5. **OCR/AI kaçışı:** OCR ve AI sağlayıcı/runtime modülü importu ile alias çağrıları ayrı `ocr.process` ve `ai.process` gerektirir; deployed uygulamalarda ikisi de runtime capability baseline'ında yoktur.
6. **Konum kaçışı:** geolocation API çağrısı `location.access` gerektirir; production baseline boş olduğundan yeni çağrı reddedilir.
7. **Dosya veya ağ yüzeyi ekleme:** yeni yüzey exact manifestte yoksa build fail olur; manifest eklense bile uygulama signed runtime baseline'ı exact eşleşmiyorsa servis/startup reddedilir.
8. **Stale, owner/stage veya wildcard genişleme:** koddan silinmiş entry, duplicate key, kaynak yoluna uymayan uygulama sahibi, bootstrap ile signed-startup aşamasının değiştirilmesi ve wildcard fail-closed bulgudur; unutulmuş geniş yetki kalıcılaşmaz.
9. **Manifest içeriği tamperi:** `runtimeCapabilities` manifest SHA-256 girdisidir. Sırasız, duplicate, bilinmeyen veya hash'i yeniden bağlanmamış değer malformed authority olarak reddedilir.
10. **İmzalı paket ikamesi:** policy package hash'i, application ID/version ve capability manifest hash'i runtime request/authority arasında exact bağlanır; unverified paket veya uyuşmazlık deny üretir.
11. **Eksik capability ile fail-open:** exact coverage required olduğu için required `file.access` veya `network.access` eksikse Core Service/desktop startup durur.
12. **Fazladan capability ile privilege broadening:** kamera/OCR/AI gibi beklenmeyen capability imzalı manifestte bulunsa dahi production baseline karşılaştırması reddeder.
13. **Pre-handshake boşluğu:** Desktop’ın Core Service sağlık doğrulamasından önce gereken dosya bootstrap ve authenticated yerel bağlantı yetkileri sırasıyla `file.access` ve `network.access` production requirement'larına pinlenir; kamera/mikrofon/OCR/AI/konum bu pin üzerinden açılamaz.
14. **Status IPC sızıntısı:** sıfır argümanlı no-cache cevap yalnız sabit sayaç/bool taşır; source path ve manifest hash'i renderer'a verilmez.
15. **Statik PASS'i runtime authority sayma:** policy snapshot, domain view ve UI `buildManifestAloneGrantsRuntimeAuthority=false` taşır; mevcut PEP, signed receipt, context ve obligation kontrolleri ayrı kalır.
16. **Migration ile sahte kanıt:** paket yeni persistence kurmaz; migration 77, Desktop vault ve SQLite ownership değişmez.

## Sınırlar ve fail-closed gerçekliği

AST kapısı kaynakta görünen üretim TypeScript/JSX import/API yüzeylerini denetler. Native işletim sistemi sandbox'ı veya kullanıcı onayı yerine geçmez. İzin verilen `file.access` ve `network.access`, uygulama içindeki veri/egress authorization'ını kendiliğinden vermez; PPK-013 istemci veri sınırı, PPK-015 network egress, PEP/receipt ve no-cache kuralları ayrıca zorunludur. Runtime authority yalnız doğrulanmış policy package ve exact application manifestinden gelir. Tam test, build, dependency/workspace/decision ve contract/runtime kanıtları gerçek çalıştırmada PASS vermiş; açık production bypass veya kapanış blocker'ı kalmamıştır.
