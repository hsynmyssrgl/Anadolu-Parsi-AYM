# PPK-023 — Uygulama güvenlik profilleri tehdit modeli

## Durum

`VALIDATED / COMPLETE`

## Standart tabanı ve gerçeklik sınırı

Bu model, OWASP ASVS `5.0.0`, OWASP MASVS `2.1.0` ve final NIST SP 800-218 SSDF `1.1` kimliklerini sürümlü olarak kullanır. Resmî kaynaklar:

- https://owasp.org/www-project-application-security-verification-standard/
- https://mas.owasp.org/MASVS/
- https://csrc.nist.gov/pubs/sp/800/218/final

Eşleme bir uygunluk sertifikası, penetrasyon testi veya native runtime doğrulaması değildir. Windows Desktop ve Windows Core Service dışındaki on iki profil yayımlanmış runtime değildir. Bir uygulama kimliğinin bu dokümanda ve hash-bağlı manifestte yer alması çalışma yetkisi vermez; PPK-007, PPK-008, PPK-020, PPK-021 ve PPK-022 kapıları ayrıca geçerlidir.

## Ortak güvenlik hedefleri

Her profil korunan varlıkları, güven sınırlarını, giriş yüzeylerini, kötüye kullanım vakalarını, zorunlu kontrolleri ve kalan riskleri ayrı kaydeder. Bütün profiller ASVS ve SSDF tabanını devralır. Yalnız iOS, iPadOS, watchOS ve visionOS hedeflerinde MASVS uygulanır; diğer profillerde MASVS için gerekçeli `NOT_APPLICABLE` kaydı zorunludur. Eksik profil, eksik bölüm, yeni uygulama, bozuk doküman hash'i, standart sürüm sapması veya gerekçesiz N/A build'i fail-closed durdurur.

## APP-THREAT-windows-desktop

- Korunan varlıklar: Desktop vault, oturum ve cihaz bağları, renderer'a dönen hassas veri, yerel yedek anahtarları.
- Güven sınırları: Electron renderer/preload/main, authenticated Core Service kanalı, repository ve dosya kasası sınırı.
- Giriş yüzeyleri: IPC, dosya seçimi ve import, yerel Core Service bağlantısı, kullanıcı formları.
- Kötüye kullanım vakaları: renderer'dan repository kaçışı, stale policy ile yazma, yetkisiz dosya/ağ kullanımı, hassas log/cache sızıntısı.
- Zorunlu kontroller: context isolation, exact IPC sözleşmesi, current PEP, imzalı policy ve capability manifesti, no-cache hassas IPC, AST build kapıları.
- Kalan riskler: Electron/OS zafiyetleri ve gerçek cihaz saldırıları ayrı sürüm ve operasyon doğrulaması gerektirir.

## APP-THREAT-windows-core-service

- Korunan varlıklar: karar otoritesi, imzalı policy paketi, receipt ve audit zinciri, Core Service yönetim kanalı.
- Güven sınırları: yerel pipe/socket, Desktop istemcisi, platform policy kernel, repository adapterleri.
- Giriş yüzeyleri: authenticated local-admin protokolü, sağlık/manifest yanıtı, gelecekteki servis API'leri.
- Kötüye kullanım vakaları: istemci kimliği ikamesi, policy package downgrade, replay, servis unavailable halinde fail-open, doğrudan SQL erişimi.
- Zorunlu kontroller: cihaz sertifikası, exact uygulama/sürüm/hash bağları, versioned API, deny-by-default kernel ve merkezi repository composition.
- Kalan riskler: Windows Service kurulumu ve gerçek production secret provider henüz ayrıca doğrulanmalıdır.

## APP-THREAT-windows-cluster-agent

- Korunan varlıklar: gelecekteki cluster üyeliği, node kimliği ve dağıtık yazma otoritesi.
- Güven sınırları: agent/Core Service, cihaz sertifika otoritesi ve cluster lease sınırı.
- Giriş yüzeyleri: henüz profile-only olan node kayıt, heartbeat ve görev kanalları.
- Kötüye kullanım vakaları: sahte node, split-brain writer, stale lease, yetkisiz cluster admin capability.
- Zorunlu kontroller: yayımdan önce native conformance, tek-yazar lease, mTLS/cihaz kimliği, signed manifest ve fail-closed policy.
- Kalan riskler: uygulama deploy edilmemiştir; profile-only doğrulama gerçek cluster güvence iddiası değildir.

## APP-THREAT-macos-companion

- Korunan varlıklar: eşlikçi uygulama oturumu, senkronize aile verisi ve cihaz anahtarları.
- Güven sınırları: macOS sandbox/keychain, Core Service/API ve yerel UI süreci.
- Giriş yüzeyleri: profile-only dosya, network, deep-link ve bildirim yüzeyleri.
- Kötüye kullanım vakaları: entitlement genişlemesi, keychain yanlış erişim grubu, stale policy ve dışa veri aktarımı.
- Zorunlu kontroller: yayımdan önce native macOS testleri, signed capability manifesti, merkezi PEP ve egress allowlist.
- Kalan riskler: uygulama deploy edilmemiştir; ASVS/SSDF eşlemesi notarization veya native runtime PASS değildir.

## APP-THREAT-ios-companion

- Korunan varlıklar: mobil aile verisi, oturum tokenları, keychain anahtarları, kamera/konum izinleri.
- Güven sınırları: iOS sandbox/keychain, uygulama extensionları, Core Service/API ve OS permission broker.
- Giriş yüzeyleri: universal link, push, kamera/fotoğraf, dosya, konum ve network.
- Kötüye kullanım vakaları: excessive permission, pasteboard/snapshot sızıntısı, certificate pinning bypassı, jailbreak tamperi.
- Zorunlu kontroller: MASVS'in 24 kontrolü, ASVS/SSDF tabanı, least privilege entitlement, current PEP ve yayımdan önce native test.
- Kalan riskler: uygulama deploy edilmemiştir; MASVS eşlemesi tek başına iOS güvence veya App Store uygunluk iddiası değildir.

## APP-THREAT-ipados-companion

- Korunan varlıklar: tablet üzerinde gösterilen hassas aile verisi, dosya provider verisi ve kimlik bilgileri.
- Güven sınırları: iPadOS sandbox, multi-window UI, document picker ve uzak API sınırı.
- Giriş yüzeyleri: dosya paylaşımı, drag/drop, kamera, konum, network ve external display.
- Kötüye kullanım vakaları: sahne/snapshot sızıntısı, yanlış dosya scope'u, background task veri sızıntısı, yetki genişlemesi.
- Zorunlu kontroller: MASVS 2.1.0 profili, ASVS/SSDF tabanı, platform privacy kontrolleri ve native yayımlama testi.
- Kalan riskler: uygulama deploy edilmemiştir; profile-only kayıt native iPadOS davranışını kanıtlamaz.

## APP-THREAT-watchos-companion

- Korunan varlıklar: saat yüzeyindeki minimal sağlık/aile bildirimi, session ve pairing bağları.
- Güven sınırları: watchOS sandbox, paired-device session ve uzak API.
- Giriş yüzeyleri: complication, notification action, connectivity mesajı ve sınırlı sensör izinleri.
- Kötüye kullanım vakaları: kilit ekranı sızıntısı, sahte paired-device mesajı, fazla veri replikasyonu ve replay.
- Zorunlu kontroller: MASVS privacy/storage/platform kontrolleri dahil tam mobil profil, minimum payload ve current PEP.
- Kalan riskler: uygulama deploy edilmemiştir; gerçek saat, pairing ve kilit ekranı testleri gereklidir.

## APP-THREAT-visionos-companion

- Korunan varlıklar: uzamsal UI'da gösterilen aile verisi, kamera/konum benzeri platform verileri ve oturum.
- Güven sınırları: visionOS sandbox, immersive scene, sensor permission broker ve uzak API.
- Giriş yüzeyleri: spatial input, scene lifecycle, network, paylaşım ve platform izinleri.
- Kötüye kullanım vakaları: omuz sörfü/uzamsal görünürlük, gereksiz sensor erişimi, scene snapshot sızıntısı ve tamper.
- Zorunlu kontroller: MASVS privacy/platform/resilience tabanı, veri minimizasyonu, exact capability manifesti ve native test.
- Kalan riskler: uygulama deploy edilmemiştir; profile-only model visionOS cihaz doğrulaması değildir.

## APP-THREAT-ocr-worker

- Korunan varlıklar: OCR girdisi, geçici metin, türetilmiş veri policy mirası ve model dosyaları.
- Güven sınırları: worker kuyruğu, dosya decoder/OCR engine, PEP ve türetilmiş veri repository sınırı.
- Giriş yüzeyleri: belge/image payloadı, model/config yükleme ve sonuç callback'i.
- Kötüye kullanım vakaları: parser bombası, path traversal, hassas metin logu/cache'i, policiesiz türev yazımı.
- Zorunlu kontroller: boyut/tür sınırı, sandbox, PPK-016 sealed inheritance, PPK-017 logging ve capability manifesti.
- Kalan riskler: worker deploy edilmemiştir; gerçek OCR engine ve sandbox doğrulaması ayrıdır.

## APP-THREAT-ai-worker

- Korunan varlıklar: prompt/context, türetilmiş AI çıktısı, model endpoint anahtarları ve consent kayıtları.
- Güven sınırları: worker queue, egress PEP, model sağlayıcı ve derived-data enforcement.
- Giriş yüzeyleri: prompt/context, tool çağrıları, model response ve provider network.
- Kötüye kullanım vakaları: prompt injection, cross-family context, izinsiz egress, hassas output cache/log ve tool abuse.
- Zorunlu kontroller: PPK-015 egress, PPK-016 miras, consent, schema doğrulama, no-cache ve fail-closed capability.
- Kalan riskler: worker deploy edilmemiştir; model/provider güvenliği ve adversarial test ayrıca gerekir.

## APP-THREAT-translation-worker

- Korunan varlıklar: çevrilecek içerik, çeviri çıktısı, provider credential ve policy metadata.
- Güven sınırları: worker queue, provider egress ve türetilmiş veri sınırı.
- Giriş yüzeyleri: metin payloadı, dil/model parametresi ve uzak provider yanıtı.
- Kötüye kullanım vakaları: hassas metnin yanlış sağlayıcıya çıkışı, policy downgrade, log/cache sızıntısı ve output injection.
- Zorunlu kontroller: exact egress allowlist, data-class binding, sealed inheritance ve hassas log yasağı.
- Kalan riskler: worker deploy edilmemiştir; gerçek provider sözleşmesi ve dil modeli testi ayrıca gerekir.

## APP-THREAT-communication-service

- Korunan varlıklar: iletişim içeriği, alıcı kimliği, teslim credentialları ve audit kayıtları.
- Güven sınırları: Core Service, dış iletişim sağlayıcısı, queue ve policy enforcement.
- Giriş yüzeyleri: mesaj şablonu, alıcı adresi, webhook ve provider API.
- Kötüye kullanım vakaları: yanlış alıcıya ifşa, header/template injection, webhook forgery ve retry flood.
- Zorunlu kontroller: alıcı/purpose bağlama, egress allowlist, payload minimizasyonu, imzalı webhook ve rate limit.
- Kalan riskler: servis deploy edilmemiştir; gerçek sağlayıcı entegrasyonu için ayrı threat review gerekir.

## APP-THREAT-backup-worker

- Korunan varlıklar: şifreli tam yedek, anahtarlar, destruction/revocation kanıtları ve retention policy.
- Güven sınırları: Desktop vault, protected backup adapter, harici hedef ve lifecycle repositories.
- Giriş yüzeyleri: backup schedule, hedef yolu, restore/verify ve harici evidence.
- Kötüye kullanım vakaları: plaintext replica, path swap, stale external evidence, key leakage ve retention bypass.
- Zorunlu kontroller: yalnız `.pptbackup`, authenticated encryption, path revalidation, propagation ve quarantine lifecycle.
- Kalan riskler: worker deploy edilmemiştir; harici medya fiziksel güvenliği ayrı operasyon sınırıdır.

## APP-THREAT-signed-plugin

- Korunan varlıklar: host process, plugin capability sınırı, kullanıcı verisi ve signing trust store.
- Güven sınırları: plugin package doğrulayıcı, sandbox/host API ve Platform Policy.
- Giriş yüzeyleri: plugin install/update, manifest, exported hooks ve host callbacks.
- Kötüye kullanım vakaları: signature bypass, dependency confusion, capability escalation ve host API kaçışı.
- Zorunlu kontroller: imzalı/versioned package, exact capability manifesti, deny-by-default host API ve supply-chain gate.
- Kalan riskler: plugin runtime deploy edilmemiştir; sandbox ve signing authority üretim doğrulaması ayrıdır.

## Kapsam dışı ve ardıl sınır

PPK-023 yeni repository, migration, kullanıcı verisi taşıma, cutover, Desktop vault sahipliği veya SQLite sahipliği değişikliği yapmaz. PPK-024 policy service unavailable/stale/invalid signature halinde runtime read-only/deny davranışını ayrıca tamamlayacaktır.
