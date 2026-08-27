# PPK-015 network egress historical closure and current ratchet

Bu kayıt yeni bir kapanış kararı değildir. Amaç, 32-K tarihsel kanıtını değiştirmeden güncel üretim ağ yüzeyini ayrı doğrulamaktır.

## Historical closure

DEC-196 ve 32-K kapanışı oluşturulduğunda latest migration 76 idi. Paket yalnız iptal-listesi adaptörünü yetkilendirmiş, mevcut migration 23 allowlist şemasını yeniden kullanmış ve migration 77 eklememişti. Tarihsel scope, karar ve audit dosyaları yeniden yazılmadı; current ratchet bu üç dosyayı byte-exact SHA-256 ile doğrular.

DEC-196 karar defterinde aktif tarihsel kayıt olarak kalır fakat daha sonraki kararların eklenmesi nedeniyle artık son kayıt değildir. Son karar olma şartı bir güvenlik koşulu değildir.

## Current ratchet

Güncel politika 2 adapter ve 3 purpose içerir:

- `secure-revocation-list-fetcher.ts` / `external-backup-revocation-list.fetch` / `GET`
- `secure-oidc-network-adapter.ts` / `oidc.token.exchange` / `POST`
- `secure-oidc-network-adapter.ts` / `oidc.jwks.fetch` / `GET`

OIDC adaptörü yalnız tam token ve JWKS primary/secondary SPKI pinleri, TLS 1.3, işletim sistemi sertifika güveni, public DNS, çözümlenen ve bağlanılan IP eşitliği, redirect yasağı, exact JSON içerik türü, boyut ve süre sınırlarıyla çalışır. Sağlayıcı görünürlüğü secure-network-ready profile ve main-only deep-link callback kaydına bağlıdır. Apple, korumalı `private_key_jwt` assertion sağlayıcısı olmadığı sürece görünmez. Provider availability veya delivery garantisi verilmez.

Güncel kaynak ratchet'i 18 source zone, 590 dosya, 7 malicious self-test, 2 adapter, 3 purpose, 4 yalnız-yerel taşıma dosyası, sıfır doğrudan primitive istisnası ve sıfır bulgudur. Üretim kaynak özeti `e1aa60de704e1791e8edd83bfeeebb94e41747801931f429ea19b15be247f2a3`; yetkili adapter/purpose özeti `8c3764ee962b55dda7fa85520b8fbb34088a65ab722febd30254416b7d6898bb` değeridir. `.51` sürüm kimliğinin `packages/domain/src/app-meta.ts` içinde güncellenmesi üretim dosyası sayısını veya ağ yetkisini değiştirmeden önceki kaynak özetini yenilemiştir. İlk exact tam regresyonda eski özetin kalması `cc922201` reddedilmiş checkpointiyle korunmuştur. Bronze 52 uninstall registry/UAT kaynak kapanışının `f4f84896` exact turunda hedefli 19 dosya/191 test PASS; filtresiz 399 dosya/2.483 test PASS iken yalnız kaynak özeti `f54e3f302649af67ed6d028e66673eea68b0d58c2ba43c912c1ccb7534babe98` değerinde eskimiş ve gerçek FAIL `8ea2dfe1` ile korunmuştur. `5fa1e559` exact hedefli turunda 23 dosya/233 test PASS iken yalnız yeni kaynak özeti tekrar eskimiş ve `2eeaac0b` ile korunmuştur. Canlı taramada bölge, dosya, bulgu, adapter, amaç ve yalnız-yerel taşıma sayıları değişmemiş; yeni ağ yetkisi açılmamıştır. Ratchet yeniden canlı tarama sonucuna eşlenir. Core Service companion, yerel ürün lisansı, fabrika ayarına dönüş, kaldırma yedeği, şifreli sürüm-geçiş kasası, yalnız `127.0.0.1:11434` üzerinde otomatik keşfedilen ve `PPT_LOCAL_AI_ENABLED=0` ile kapatılabilen yerel aile yapay zekâ modeli, Windows Defender OCR malware köprüsü ve `pardus-app://renderer/offline-map/turkiye.pmtiles` üzerinden okunan çevrimdışı aile haritası dış ağ adapteri/purpose'u oluşturmaz. Defender köprüsü var olan yerel scanner sonucunu OCR worker'a yalnız content-free verdict olarak taşır; path veya ağ yetkisi vermez. Yerel harita yalnız sabit uygulama originindeki doğrulanmış PMTiles aralıklarını okur; internet tile servisi veya genel renderer ağı kullanmaz. Yerel model adapteri yönlendirme kabul etmez, uzak adres veya bulut anahtarı almaz; yalnız sabit loopback adresini yoklar ve kapatma anahtarı etkinken ağ I/O'su yapmaz. Yerel çağrı preflight, kayıt-rıza, sağlayıcısız çeviri hazırlığı, toplantı-katılımcı rıza bağı, yerel korumalı dosya paylaşımı, iletişim denetim arşivi, sağlayıcısız dağıtık çekirdek/operasyon temeli ve fail-closed Windows dayanıklılık/evrensel UX temeli dış ağa çıkmaz; bu nedenle yetkili external egress adapter/purpose sayısını genişletmez.

## Migration ayrımı

Migration 77 daha sonra PPK-016 tarafından türetilmiş-veri metadata zinciri için eklenmiştir; PPK-015 tarafından eklenmiş değildir. Tarihsel `migration 117`, 34-B zamanlanmış mesajların yerel bırakma zinciri tarafından sahiplenilir; güncel latest migration 121'dir. Bu ardıl migrationlar, 32-K kapanış anındaki migration 76 gerçeğini veya PPK-015'in yeni persistence eklemediği gerçeğini değiştirmez. Bu exact tarihsel/güncel ayırıcı ilk ratchet retryında kaybolmuş, 32-K contract testi gerçek FAIL vermiş ve `24e6bd71` ile korunmuştur; ağ yetkisi değişmemiştir.

Ayırıcı geri kurulduktan sonraki taze retry contract 43/43, runtime 10/10, iki odaklı Vitest dosyası 23/23 ve ticari temel 1.254 kontrol PASS vermiştir. Bu odaklı PASS yeni exact committe hedefli/tam regresyon, kaynak bütünlüğü, paket veya kurulu UAT yerine geçmez.

## Gerçeklik sınırı

Bu ratchet gerçek internet isteği gerçekleştirmez, gerçek kullanıcı verisi taşımaz, Desktop kasa ya da SQLite sahipliğini değiştirmez, cutover otoritesi oluşturmaz ve tarihsel kapanış yüzdelerini yeniden hesaplamaz.
