# DEC-239 — Mesaj yaşam döngüsü ve mahremiyet koruyan presence

## Durum

`34-B` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu yerel uygulamayla değiştirilmez. `countsAsRequirementPass=false`; kalıcı receipt ve dış/manual kanıtlar `NOT_RUN` kalır.

## Karar

Mesaj metadata'sı, presence profili ve oda saklama kararı yalnız merkezi Life PEP receipt/fence altında; aile, hesap ve kişi sahibiyle birebir bağlanarak yazılır. Her yazım idempotent `clientOperationId`, request fingerprint, optimistic revision, current state fingerprint ve immutable mutation kaydı taşır. Mesaj oluşturma/düzenleme/silme/geri alma/tepki/sabitleme/yer imi/teslim durumu olayları içeriksiz append-only ledger'a eklenir. Audit ve outbox içerik, dosya yolu, sealed reference, hash veya provider kanıtı taşımaz.

Metin ve konum açıklaması payload'ı SQLite'a yazılmaz. Main-process `ProtectedSideArtifactStore` üstündeki ayrı kasada şifrelenir; exact aile/sahip/oda/mesaj/payload sürümü ve zaman bağı, byte/hash/size readback, symlink-realpath-nlink kontrolü, no-overwrite yayın, başlangıç crash onarımı, kota ve bounded orphan sweep uygulanır. Renderer yalnız on güvenli mesaj kanalına erişir. Mesaj içeriği ancak açık “İçeriği göster” eylemiyle döner; renderer hesap/aile/sahip, dosya yolu, sealed reference, payload hash, provider kanıtı, policy receipt, relay veya ağ otoritesi alamaz. Ses/fotoğraf/video/belge seçimi mevcut main-process korumalı dosya seçicisini kullanır; uygulama gönderimden önce opaque dosya kimliğini aynı sahip, aynı oda, `ready_local`, temiz tarama kanıtı ve exact MIME sınıfıyla yeniden doğrular. Sahte veya başka odadan attachment kimliği fail-closed reddedilir.

Presence varsayılanı çevrimdışı, uygun değil, audience=`nobody`, son görülme/yazıyor/okundu/acil ulaşılabilirlik kapalıdır. Görünmez durum dışarıya `hidden` üretir; aktif cihaz ve kesin aktivite hiçbir renderer view'ında açıklanmaz. Süresi dolan profil okumada derhal çevrimdışı/nobody görünür ve main-only bakım yürütücüsü kalıcı görünürlük alanlarını kapatır. Saklama politikası kalıcı, süreli, otomatik mantıksal silme veya reason hash'li hukuki koruma kararını modeller. Main-only bakım, güncel oda kararından expiry türetir, hukuki koruma/kalıcı kayıtları atlar ve süre dolan mesajı yeni PEP receipt altında mantıksal siler; fiziksel silme iddiası üretmez.

## Dürüstlük sınırı

COM-003'ün reply/quote/thread/reaction/pin/bookmark metadata zinciri, COM-004'ün altı yerel içerik türü ve main-issued temiz medya bağı, COM-005'in yerel offline kuyruk ve retry state machine'i, COM-006'nın içeriksiz değişiklik geçmişi ile mantıksal silme/geri alma akışı, COM-008'in kullanıcı kontrollü yazıyor/okundu alanları, COM-009'un kişi/tarih/tür/oda metadata filtresi ile yalnız main-process kasasında yetkili metin/konum araması, COM-010'un saklama karar modeli ve mantıksal expiry yürütmesi ile PRS-001/004/006'nın yerel mahremiyet varsayımları uygulanmıştır.

COM-007 için zamanlama ve sessiz metadata ile authoritative yerel saate bağlı, idempotent ve tekrar çalıştırılabilir yerel hatırlatma yürütücüsü vardır. Bu yürütücü yalnız süresi gelen `scheduled` mesajı `sealed_local` durumuna geçirir; uzak teslimat ya da bildirim garantisi vermez. Çoklu cihaz presence aggregation, selected-people audience listesi ve takvim eşleme yoktur. Relay teslimi, uzak alındı bilgisi, mesaj imzası, production MLS payload sağlayıcısı ve gerçek ağ alışverişi yoktur. İçerik araması en yeni yetkili ve bounded aday kümesinde yereldir; dış arama indeksine çıkmaz. Mantıksal silme ve orphan dosya kaldırma fiziksel secure erase veya yedek silme yayılımı garantisi değildir. Bu açıklar ve dış/manual UAT yokluğu nedeniyle on dört requirement kapanmış sayılmaz.

## Yerel kanıt

Migration 106 `communication_messaging_lifecycle_privacy_presence` SHA-256 değeri `5b088bb6d759403044f84ad9f2a82be1823e33a17334d7122beed92af56cce50` olarak tarihsel temel; migration 117 `communication_scheduled_message_release` SHA-256 değeri `9602df3d935441f033eb45d89d7403e09d8dbed3849873cfe68a098ff754dde3` olarak güncel zamanlayıcı kanıtıdır. Beş hedef dosyada 30 test; application, repository-contracts, repositories, database ve desktop typecheck/build zinciri; migration verifier ve PPK ratchetleri yerel teknik kanıttır. Bunlar dış mesaj teslimi, gerçek çoklu cihaz presence, fiziksel silme veya requirement kapanışı değildir.

## 24.08.2026 değişiklik-etki doğrulaması

PR-235 kapsamında güncel kullanıcı dili ve renderer sözleşmesi bu karara yeniden bağlandı; 52/52 sınır-sözleşme-çalışma zamanı zinciri PASS oldu. Bu kayıt dış/manual kanıtları kapatmaz ve `countsAsRequirementPass=false` sınırını değiştirmez.
