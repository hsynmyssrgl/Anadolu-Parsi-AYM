# PPK-015 ağ çıkış politikası tehdit modeli

## Korunan varlıklar

- Desktop süreç kimliği ve yalnız `external-backup-revocation-list.fetch` amacı için açılan dış ağ yetkisi.
- Repository'de yönetici ve güçlü kimlik doğrulama ile kaydedilmiş iptal-listesi uç nokta allowlist'i.
- TLS sunucu kimliği, SPKI pinleri, kontrollü çift-pin sertifika rotasyonu ve isteğe bağlı mTLS istemci kimliği.
- İmzalı iptal listesi yükünün bütünlüğü, boyut sınırı ve bekleyen güçlü-onay akışı.
- Desktop kasası, etkin SQLite oturumu, PPK-012 hassas önbellek/no-cache çiti ve PPK-013/014 erişim sınırları.

## Güven sınırları

1. Renderer ham ağ işlevi, URL veya kimlik malzemesi alamaz; yalnız tipli senkronizasyon ve güvenli durum IPC sözleşmelerine erişir.
2. `SecureRevocationSyncService`, yetkili repository uygulama servisinden gelen etkin uç nokta profilini ve o anda geçerli pinleri merkezi `GovernedRevocationListFetchUseCase`'e verir.
3. `NetworkEgressPolicy`, uygulama, amaç, yöntem, endpoint kimliği, kanonik URL, TLS modu, mTLS kimliği ve pin setini exact authority bağlamıyla eşleştirmeden adaptörü çağırmaz.
4. `secure-revocation-list-fetcher.ts` dış internete çıkabilen tek üretim adaptörüdür. Core Service named-pipe/socket dosyaları açıkça yerel taşıma olarak sınıflandırılır ve dış egress sayılmaz.
5. Adaptör yalnız HTTPS 443 ve TLS 1.3 kullanır; işletim sistemi güven zincirini, eş SPKI pinini, DNS sonuçlarını ve bağlanılan gerçek uzak adresi doğrular. Redirect kabul etmez.
6. mTLS kullanıldığında istemci kimlik ID'si politika bağlamına bağlıdır; sertifika ve özel anahtar yalnız adaptör çağrısı içinde kalır, IPC'ye veya kalıcı endpoint tablosuna yazılmaz.

## Tehditler ve kontroller

| Tehdit | Fail-closed kontrol |
| --- | --- |
| Yeni bir üretim modülünden `http`, `https`, `net`, `tls`, `dns`, `fetch`, WebSocket veya üçüncü taraf ağ istemcisiyle çıkış | 18 üretim kaynak alanını typecheck/build öncesi tarayan, 6 kötü niyetli öz-sınamalı statik kapı; sıfır doğrudan primitive istisnası |
| Tek adaptörü use-case/policy katmanını atlayarak çağırma | Adaptör import'u yalnız merkezi use-case dosyasında; use-case import'u yalnız senkronizasyon servisinde kabul edilir |
| Caller tarafından farklı URL, endpoint, uygulama, amaç veya yöntem seçimi | İstek ile repository kökenli authority bağlamının exact eşleşmesi; yalnız `windows-desktop`, `GET` ve kanonik iptal-listesi amacı |
| SSRF ile loopback, özel, link-local, ayrılmış veya DNS-rebinding adresine erişim | DNS sonuçlarının ve TLS bağlantısındaki gerçek `remoteAddress` değerinin ayrı ayrı public-only denetimi |
| TLS downgrade veya güven zinciri atlama | `rejectUnauthorized: true`, `minVersion: TLSv1.3`, yetkili socket ve gerçek TLS 1.3 protokol denetimi |
| Geçerli CA sertifikasıyla yanlış sağlayıcıya yönelme | Repository'de güçlü onaylı SPKI SHA-256 pin seti ve exact URL bağı |
| Sertifika rotasyonunda kesinti ya da sınırsız eski pin kabulü | En fazla 14 günlük, benzersiz primary/secondary pin penceresi; zaman çözümlemesi mevcut endpoint use-case'inde yapılır |
| Redirect ile allowlist path/origin dışına çıkma | Tüm 3xx yanıtları reddedilir; ikinci bir URL isteği üretilmez |
| mTLS özel anahtarını UI/IPC/veritabanı üzerinden sızdırma | IPC durum sözleşmesi yalnız güvenlik duruşu taşır; `secretMaterialExposed:false`; kimlik malzemesi detached runtime portudur |
| Büyük, yanlış tipli veya bozuk yanıtla bellek/şema saldırısı | 1 MiB kesin sınır, `application/json`, exact iptal-listesi şema alanları ve imza doğrulaması öncesi bekleyen akış |

## Kalan riskler

- Varsayılan iptal-listesi profilleri sunucu doğrulamalı TLS kullanır. Bir sağlayıcı mTLS gerektiriyorsa güvenli istemci kimliği sağlayıcısının ayrıca bağlanması gerekir; kimlik yokken mTLS taklidi veya sessiz fallback yapılmaz.
- CA köklerinin güncelliği işletim sistemi güven deposuna bağlıdır. SPKI pinleri bu riski daraltır; pin değişikliği güçlü yönetici doğrulaması gerektirir.
- Ağ yanıtı otomatik uygulanmaz. İmzalı liste bekleyen korumalı duruma alınır ve mevcut güçlü-onay akışıyla uygulanır; bunun kullanılabilirlik gecikmesi bilinçli bir güvenlik tercihidir.

## Gerçeklik sınırı

Bu paket gerçek internete doğrulama verisi göndermemiş, gerçek kullanıcı verisi taşımamış ve cutover yapmamıştır. Mevcut migration 23 endpoint allowlist/çift-pin şeması kullanılır; migration 77 eklenmez. Desktop kasa yapısı ve SQLite sahipliği korunur. DEC-171, PPK-012 policy-sensitive IPC no-cache, PPK-013 doğrudan veri erişim yasağı ve PPK-014 sürümlü Core API sınırı aynen yürürlüktedir.

## 24.08.2026 değişiklik-etki doğrulaması

PR-235 kapsamında güncel kullanıcı dili ve renderer sözleşmesi bu tehdit modeline yeniden bağlandı; 52/52 sınır-sözleşme-çalışma zamanı zinciri PASS oldu. Sonuç gerçek ağ, dış sağlayıcı veya production kabul kanıtı değildir.
