# DEC-239 — Mesaj yaşam döngüsü ve mahremiyet koruyan presence

## Durum

`34-B` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu yerel uygulamayla değiştirilmez. `countsAsRequirementPass=false`; kalıcı receipt ve dış/manual kanıtlar `NOT_RUN` kalır.

## Karar

Mesaj metadata'sı, presence profili ve oda saklama kararı yalnız merkezi Life PEP receipt/fence altında; aile, hesap ve kişi sahibiyle birebir bağlanarak yazılır. Her yazım idempotent `clientOperationId`, request fingerprint, optimistic revision, current state fingerprint ve immutable mutation kaydı taşır. Mesaj oluşturma/düzenleme/silme/geri alma/tepki/sabitleme/yer imi/teslim durumu olayları içeriksiz append-only ledger'a eklenir. Audit ve outbox içerik, dosya yolu, sealed reference, hash veya provider kanıtı taşımaz.

Metin payload'ı SQLite'a yazılmaz. Main-process `ProtectedSideArtifactStore` üstündeki ayrı kasada şifrelenir; exact aile/sahip/oda/mesaj/payload sürümü ve zaman bağı, byte/hash/size readback, symlink-realpath-nlink kontrolü, no-overwrite yayın ve kota uygulanır. Renderer yalnız on güvenli kanala erişir. Mesaj içeriği ancak açık “İçeriği göster” eylemiyle döner; renderer hesap/aile/sahip, dosya yolu, sealed reference, payload hash, provider kanıtı, policy receipt, relay veya ağ otoritesi alamaz. Renderer oluşturma yüzeyi yalnız metin mesajını kabul eder; main-issued medya seçme zinciri yokken sahte attachment handle reddedilir.

Presence varsayılanı çevrimdışı, uygun değil, audience=`nobody`, son görülme/yazıyor/okundu/acil ulaşılabilirlik kapalıdır. Görünmez durum dışarıya `hidden` üretir; aktif cihaz ve kesin aktivite hiçbir renderer view'ında açıklanmaz. Saklama politikası kalıcı, süreli, otomatik silme metadata'sı veya reason hash'li hukuki koruma kararını modeller; otomatik yürütme ya da fiziksel silme iddiası üretmez.

## Dürüstlük sınırı

COM-003'ün reply/quote/thread/reaction/pin/bookmark metadata zinciri, COM-005'in yerel offline kuyruk ve retry state machine'i, COM-006'nın içeriksiz değişiklik geçmişi ile mantıksal silme/geri alma akışı, COM-008'in kullanıcı kontrollü yazıyor/okundu alanları, COM-009'un kişi/tarih/tür/oda metadata filtresi, COM-010'un saklama karar modeli ve PRS-001/004/006'nın yerel mahremiyet varsayımları uygulanmıştır.

COM-004'ün altı türü domain/schema'da modellenir; fakat renderer'dan gerçek ses/fotoğraf/video/konum/belge seçimi, şifreli byte aktarımı ve geri okuma uygulanmamıştır. COM-007 için zamanlama ve sessiz metadata vardır; hatırlatma yürütücüsü yoktur. Tam metin içerik araması yoktur. Çoklu cihaz presence aggregation, selected-people audience listesi, otomatik presence expiry, takvim eşleme, otomatik retention yürütme ve payload orphan sweep yoktur. Relay teslimi, uzak alındı bilgisi, mesaj imzası, production MLS payload sağlayıcısı ve gerçek ağ alışverişi yoktur. Mantıksal silme fiziksel secure erase veya yedek silme yayılımı garantisi değildir. Bu açıklar nedeniyle on dört requirement kapanmış sayılmaz.

## Yerel kanıt

Migration 106 `communication_messaging_lifecycle_privacy_presence` SHA-256 değeri `5b088bb6d759403044f84ad9f2a82be1823e33a17334d7122beed92af56cce50` olarak doğrulanır. Beş hedef dosyada 25 test; application, repository-contracts, repositories, database ve desktop typecheck/build zinciri; migration verifier ve PPK ratchetleri yerel teknik kanıttır. Bunlar dış mesaj teslimi, gerçek çoklu cihaz presence, fiziksel silme veya requirement kapanışı değildir.
