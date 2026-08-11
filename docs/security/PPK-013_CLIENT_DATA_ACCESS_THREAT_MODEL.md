# PPK-013 istemci veri erişim tehdit modeli

## Korunan varlıklar

- Repository portları, somut repository uygulamaları ve transaction bağlamları.
- Ham SQL metni, SQLite çalışma zamanı nesnesi ve aktif bellek içi veritabanı oturumu.
- Desktop kullanıcı veri kasasının yolu, şifreli konteyneri, açık veri anahtarı ve çözülmüş içerikleri.
- Politika receipt'i, uygulama kimliği, cihaz sertifikası, capability manifesti ve yetkilendirme context hash'i.
- PPK-012 kapsamındaki hassas bellek önbelleği ile politika-hassas IPC `no-cache` kanalları.

## Güven sınırları

1. Renderer, preload ve `@ppt/core-service-client` istemci alanıdır; veri sağlayıcısı değildir.
2. Tipli Electron IPC, istemcinin Desktop ana süreçteki uygulama servislerine ulaşabildiği tek yerel veri yoludur.
3. Desktop evrensel PEP, imzalı Core Service politika kararı ve receipt'i doğrulamadan korumalı use-case/repository işlemini açmaz.
4. Repository, SQLite ve mevcut Desktop kasa uygulamaları sağlayıcı alanında kalır. Bu fiziksel sahiplik DEC-171 değiştirilene kadar korunur.
5. Gelecekteki uzak istemciler için yalnız sürümlü Core Service API taşımacılığı modellenmiştir; bu paket PPK-014'ü veya cutover'ı tamamlamaz.

## Tehditler ve kontroller

| Tehdit | Etki | Kontrol | Ret davranışı |
|---|---|---|---|
| Renderer/preload tarafından repository importu | Merkezi policy ve receipt atlatması | TypeScript sözdizimi fail gate, sıfır istisna defteri | Derleme/test kapısı FAIL |
| Ham SQL veya SQLite çalışma zamanı kullanımı | Satır kapsamı, migration ve transaction korumalarının atlanması | SQL literal/SQLite sembol taraması ve paket sınırı | Derleme/test kapısı FAIL |
| Kasa dosyasına veya çözülmüş oturuma doğrudan erişim | Gizli veri/anahtar sızıntısı | `node:fs` ve kasa modülü import yasağı; renderer sandbox/preload sınırı | Derleme/test kapısı FAIL |
| Kayıtsız IPC kanalı | Denetimsiz servis yüzeyi | Çalışma zamanı kanal kaydı | `CHANNEL_NOT_REGISTERED` |
| Bootstrap yolunun genişletilmesi | Kimlik doğrulamadan veri erişimi | Ayrı ve açık bootstrap allowlist'i | `BOOTSTRAP_CHANNEL_FORBIDDEN` |
| Uygulama veya cihaz değiştirme | Başka istemci/cihaz adına işlem | Uygulama kimliği, cihaz kimliği ve cihaz sertifikası SHA-256 bağı | Fail-closed mismatch |
| Hesap veya aile bağlamı değiştirme | Yatay yetki yükseltme | Subject ve family bağının receipt isteğiyle exact karşılaştırılması | Fail-closed mismatch |
| Politika paketi/manifest değiştirme | Eski veya yetkisiz capability kullanımı | Policy version, package SHA-256 ve capability manifest SHA-256 bağı | Fail-closed mismatch |
| Receipt/context yeniden kullanımı veya bozulması | Önceki izni yeni işleme taşıma | Aktif transaction context, correlation/resource/fence ve context SHA-256 doğrulaması | İşlem callback'i açılmaz |
| Yetkilendirme süresinin dolması | Bayat karar kullanımı | Kesin bitiş anında `>= expiresAt` reddi ve PEP receipt expiry | Fail-closed expiry |
| Bozuk/fazladan alanlı veri | Parser belirsizliği/prototype istismarı | Exact plain-record anahtar kümesi ve kanonik biçim doğrulaması | `MALFORMED_CONTEXT` |
| Hassas IPC sonucunun cache'e alınması | Yetki bittikten sonra veri gösterimi | PPK-012 hassas cache kilidi ve mevcut policy-sensitive `no-cache` listesi korunur | Cache temizlenir/kilitlenir |

## Kalan risk ve savunma derinliği

- Desktop ana süreç aynı dağıtım paketi içinde geçici veri sağlayıcısıdır; istemci alanı değildir. Bu ayrım kaynak ağacı ve çalışma zamanı PEP/IPC katmanıyla korunur.
- Statik kapı doğrudan import, SQLite sembolü ve SQL literalini durdurur. PPK-020'nin daha geniş AST tabanlı crypto/network/role/use-case kapısı ayrı gereksinimdir.
- Kullanıcı tarafından seçilen dışa aktarım hedefleri korumalı kasa yolu değildir; dışa aktarım use-case ve dosya adaptörleri ana süreçte kalır.

## Gerçeklik sınırı

Gerçek aile verisi taşınmamıştır. SQLite yazma sahipliği Core Service'e geçirilmemiştir. Mevcut Desktop kasası ve bellek içi SQLite oturumu korunmuştur. Cutover otoritesi bağlanmamış, DEC-171 kaldırılmamış ve PPK-014 COMPLETE sayılmamıştır. Kalıcı yol, anahtar veya gizli malzeme yeni istemci sözleşmesine eklenmemiştir.
