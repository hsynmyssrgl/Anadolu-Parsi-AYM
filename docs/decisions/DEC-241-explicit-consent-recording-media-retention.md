# DEC-241 — Açık rızalı görüşme kaydı ve medya saklama

## Durum

`34-D` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu yerel uygulamayla değiştirilmez. `countsAsRequirementPass=false`; kalıcı receipt ile dış ve manuel kanıtlar `NOT_RUN` kalır.

## Karar

Görüşme kaydı varsayılan kapalıdır. Kayıt isteği, her katılımcının kendi açık rıza kararı, geri çekme, sonradan katılan kişi, on-record/off-record niyeti ve ses/video/transkript/çeviri saklama süreleri yalnız merkezi Life PEP receipt/fence altında; aile, hesap ve kişi sahibiyle birebir bağlanarak yazılır. Her yazım idempotent `clientOperationId`, request fingerprint, optimistic revision, current state fingerprint ve immutable mutation kaydı taşır. Rıza, segment ve olay geçmişi içeriksiz durable ledger'dır; audit ve outbox medya, konuşma metni, dosya yolu, anahtar ya da ağ adresi taşımaz.

Katılımcı yalnız kendi rızasını verebilir veya geri çekebilir. Bir kişinin reddi ya da geri çekmesi isteği off-record durumuna getirir. Sonradan katılan kişi için rıza kaydı pending oluşturulur ve durum `paused_for_joiner` olur. Çocuk veya yaşı bilinmeyen katılımcı için veli/uzman/hukuk politikası yapılandırılmadığından rıza fail-closed reddedilir. Renderer yalnız sekiz exact kanal kullanır; medya yakalama, provider, dosya, anahtar ve ağ otoritesi renderer'a verilmez.

Migration 108 mutation, request, consent, retention, segment ve event tablolarını owner/account/family bağlarıyla kurar. Request sayısı 256, katılımcı sayısı 16 ve segment sayısı 128 ile fail-closed sınırlıdır. Segment kaydı yalnız kullanıcı niyetini gösterir; `capture_started`, transkript ve çeviri persistence alanları şemada zorunlu olarak sıfırdır.

## Dürüstlük sınırı

Gerçek ses/video yakalama, transkript veya çeviri kaydı, kırmızı kayıt göstergesinin gerçek capture durumuyla etkinleşmesi, sesli başlat/durdur duyurusu, E2EE recorder rolü, medya anahtar bağı, şifreli medya dosyası, hash/imza, erişim geçmişi, fiziksel güvenli silme ve backup propagation uygulanmamıştır. Retention yalnız politika metadata'sıdır; süre dolumu çalıştırılmaz. Veli/uzman/hukuk politikası ve çocuk kaydı hukuki incelemesi yoktur. Ağ kullanılmaz. Bu nedenle REC-001..REC-011 ve AUD-COM-004 kapanmış sayılmaz.

## Yerel kanıt

Migration 108 `explicit_consent_recording_media_retention` SHA-256 değeri `45f60e7ff16f505386a75a4737d5b6bc4e0bc4c07e4b042594e40418ff20626e` olarak doğrulanır. Kayıt talebi exact çağrı rosterına, geç katılımcı ise aktif çağrı ve aktif oda üyeliğine bağlanır; sona ermiş çağrıda veya rızası modellenmemiş çağrı katılımcısı varken bölüm değişimi reddedilir. Beş hedef dosyada 23 test; domain, application, repository-contracts, database, repositories ve desktop typecheck zinciri; migration verifier ile PPK-015/021/022 ratchetleri yerel teknik kanıttır. Bunlar gerçek kayıt, provider, medya şifreleme, güvenli fiziksel silme, hukuki uygunluk veya requirement kapanışı değildir.
