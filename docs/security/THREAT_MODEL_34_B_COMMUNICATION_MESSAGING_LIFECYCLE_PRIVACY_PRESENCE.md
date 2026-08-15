# 34-B Mesajlaşma Yaşam Döngüsü ve Presence Tehdit Modeli

## Korunan varlıklar

- Mesaj metni ve gelecekte main-issued olacak medya payload'ları.
- Mesaj/oda/sender ilişkisi, reply/quote/thread, reaction/pin/bookmark ve teslim metadata'sı.
- Presence, son görülme, yazıyor/okundu ve acil ulaşılabilirlik tercihleri.
- Saklama ve hukuki koruma kararları.
- PEP receipt/fence, mutation/event ledger, audit ve outbox bütünlüğü.

## Güven sınırları

- Renderer güvenilir payload, owner/account/family, dosya yolu, sealed reference, hash, provider, receipt veya relay otoritesi değildir.
- DataStore yalnız central PEP + repository resolver + aynı SQLite transaction üzerinden yazım yapar.
- Mesaj payload kasası main-process sınırındadır ve uygulama veritabanından ayrı kökte tutulur.
- Yerel offline queue metadata'sı uzak teslim ya da remote receipt kanıtı değildir.
- Kullanıcı tarafından girilen metin IPC'de 32 KiB, exact-key ve control-character sınırlarına tabidir.

## Tehditler ve kontroller

| Tehdit | Kontrol | Kalan risk |
|---|---|---|
| Renderer'ın storage/provider/relay yetkisi enjekte etmesi | Exact on kanal, recursive plain-object/accessor/prototype/symbol ve unknown-field reddi; metin-only create | Main-issued medya akışı yok |
| Başka aile/kişi mesajına erişim | Exact account/person/family/owner PEP receipt ve tüm repository sorgularında owner filtresi | Gerçek çoklu hesap UAT yapılmadı |
| Replay veya revision atlama | Unique clientOperation, request fingerprint, optimistic revision, state fingerprint, mutation/current trigger bağı | Sınırsız yaşam boyu mutation retention incelemesi yapılmadı |
| DB'de plaintext sızıntısı | Yalnız sealed ref/hash/size/provider metadata; korumalı ayrı payload kasası; testte canary taraması | Crash sonrası orphan payload sweep yok |
| Payload path/symlink/hardlink saldırısı | Canonical basename, realpath, no symlink, nlink/inode/dev, no-overwrite, 0600, readback | Crash recovery ve scheduled orphan bakım otoritesi yok |
| Olay geçmişi tahrifi | Mutation/event UPDATE/DELETE triggerları fail-closed; current fiziksel delete yasak | İçerik sürüm geçmişi tutulmaz |
| Sahte teslim iddiası | Yerel state vocabulary; truth alanları relay/remote receipt/network=false | Gerçek teslim sağlayıcısı yok |
| Presence ile aktif cihaz/aktivite ifşası | Renderer view'da activeDeviceDisclosed=false ve preciseActivityDisclosed=false; görünmez=hidden | Multi-device aggregation ve selected-people enforcement yok |
| Retention etiketinin fiziksel silme sayılması | View'da physicalSecureEraseGuaranteed=false ve backupPropagationGuaranteed=false | Otomatik expiry, file deletion ve backup propagation yok |
| Audit/outbox üzerinden içerik sızıntısı | Yalnız mutation kind, resource id ve revision; plaintext/hash/path yok | Harici log/privacy review NOT_RUN |

## Fail-closed ve no-claim sınırları

Central policy veya `ProtectedSideArtifactStore` yoksa mesaj okuma/yazma durur. Renderer medya handle üretemez. Silinen mesaj içeriği okunmaz; restore mantıksal current state geçişidir. Relay, uzak receipt, imza, production MLS, gerçek ağ kullanımı, reminder, full-content search, çoklu cihaz aggregation, otomatik expiry, fiziksel secure erase ve backup propagation uygulanmış sayılmaz.

## Açık kanıtlar

Gerçek medya, çoklu cihaz, relay, remote receipt, signature, scheduled reminder, retention executor, crash recovery, orphan sweep, physical erase, backup propagation, privacy/legal/security/accessibility incelemeleri ve kalıcı governance receipt `NOT_RUN` durumundadır.
