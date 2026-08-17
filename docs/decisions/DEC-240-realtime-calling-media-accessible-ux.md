# DEC-240 — Gerçek zamanlı arama planlama ve erişilebilir arama deneyimi

## Durum

`34-C` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu yerel uygulamayla değiştirilmez. `countsAsRequirementPass=false`; kalıcı receipt ile dış ve manuel kanıtlar `NOT_RUN` kalır.

## Karar

Arama oturumu, katılımcı, erişilebilirlik tercihi, preflight ve kalite metadata'sı yalnız merkezi Life PEP receipt/fence altında; aile, hesap ve kişi sahibiyle birebir bağlanarak yazılır. Her yazım idempotent `clientOperationId`, request fingerprint, optimistic revision, current state fingerprint ve immutable mutation kaydı taşır. Oturum yaşam döngüsü olayları içeriksiz append-only ledger'a eklenir; audit ve outbox medya, cihaz tanımlayıcısı, provider kanıtı veya ağ adresi taşımaz.

Renderer yalnız altı exact kanalı kullanır. Mikrofon, kamera, hoparlör, kalite ölçümü, provider kanıtı, ağ, relay credential, ekran yakalama ve media transport otoritesi renderer'a verilmez. Yerel medya preflight sağlayıcısı production main-process composition'a bağlanmıştır: izole, sandboxed ve görünmez Electron penceresinde yalnız exact kamera/mikrofon izni verilir; ekran yakalama ve tüm dış istekler reddedilir. Oturum ve PEP doğrulanmadan cihaz erişimi başlamaz, replay cihazları yeniden açmaz ve içeriksiz provider kanıtı en fazla 120 saniye yaşındadır. Bu ön-kontrol fiziksel kamera/mikrofon çalışmasını veya duyulabilir hoparlörü sertifikalandırmaz. Kalite portu production composition'a bağlı değildir. Bu sürüm yalnız yerel plan, bekleme odası durumu, audio-only tercihi, toplantı kilidi, altyazı/RTT/screen-share isteği, el kaldırma, yerel katılımcı ve işaret dili konuşmacısı sabitleme ile erişilebilirlik tercihlerini yönetir.

Migration 107 mutation, session, participant, event, preference ve quality observation tablolarını owner/account/family bağları ve durable PEP triggerlarıyla kurar. Oturum sayısı 256 ve kalite kanıtı sayısı 512 ile fail-closed sınırlıdır. Bu sınırlar güvenli bir yaşam döngüsü prune/retention politikası değildir; otomatik silme uygulanmamıştır.

## Dürüstlük sınırı

WebRTC peer connection, SFU, STUN/TURN, kısa ömürlü relay credential, SFrame, MLS media-key binding, gerçek ses/video byte akışı, screen/window capture, background processing, canlı altyazı sağlayıcısı, RTT transportu, iOS CallKit/PushKit, Windows call notification ve do-not-disturb entegrasyonu uygulanmamıştır. Yerel preflight sağlayıcısı production composition'a bağlı olsa da gerçek cihaz UAT'si, bire bir arama, grup araması ve ağ kullanımı yapılmamıştır. Quality port production composition'a bağlı değildir. Katılımcı kick ve eksiksiz host moderation yoktur. Bu nedenle RTC ve UX-COM gereksinimleri kapanmış sayılmaz.

## Yerel kanıt

Migration 107 `communication_realtime_calling_accessible_ux` SHA-256 değeri `299024d7bd040343717abceb2ada6e543a95bea921c7ee6c7d34a10cf2b6515b` olarak doğrulanır. Altı hedef dosyada 26 test; domain, application, repository-contracts, database, repositories ve desktop typecheck zinciri; migration verifier ile PPK-015/021/022 ratchetleri yerel teknik kanıttır. Bunlar gerçek medya taşıma, fiziksel cihaz sertifikasyonu, gerçek cihaz UAT'si veya requirement kapanışı değildir. `countsAsRequirementPass=false` ve tüm dış/manual kanıtlar `NOT_RUN` kalır.
