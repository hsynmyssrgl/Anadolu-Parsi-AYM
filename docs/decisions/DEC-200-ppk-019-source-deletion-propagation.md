# DEC-200 — PPK-019 kaynak silme ve retention yayılımı

## Durum

32-O kapsamında kabul edildi. PPK-019 üst gereksinimi hedefli testler, tam regresyon, üretim build'i, bütünlük kontrolleri ve iki aşamalı contract/runtime kanıtlarıyla `COMPLETE` durumundadır.

## Karar

Kaynak veri için kalıcı imha ancak merkezi `SourceDeletionPropagationPolicy` ve `EnforceSourceDeletionPropagationUseCase` üzerinden yürütülür. Politika OCR metni, arama indeksi, thumbnail, AI hafızası, cache, replica ve yedek olmak üzere yedi zorunlu owner sınıfını sabitler. Üç runtime cache kaydı (`family-import-preview`, `ipc-main-read`, `offline-sensitive`) silme transactionı başlamadan önce temizlenmek veya kilitlenmek zorundadır. Eksik/yinelenen registry, temizleme arızası, bozuk sayaç/zaman, kayıt dışı persistent owner, plaintext replica, bozuk metadata sınıflaması veya plan hash/shape sapması fail-closed reddedilir.

SQLite repository, planı yeniden doğrular ve `sqlite_schema` üzerinden ikinci bir persistent-owner taraması yapar. Böylece policy değerlendirmesi ile yazım arasındaki şema değişikliği reddedilir. Kaynak lifecycle kaydı `purge_scheduled` ve legal hold kapalı değilse operasyon açılmaz. `PRAGMA secure_delete=ON` sonrasında kaynak satırı, ona ait object permission ve AI consent metadata satırları aynı yetkili transactionda kaldırılır. Ardından lifecycle tombstone `purged` ve `backup_propagation_pending=1` olarak korunur; audit ve outbox olayı aynı transactiona bağlıdır.

Bugünkü üretim şemasında kalıcı semantic OCR/index/thumbnail/AI-memory ownerı yoktur. Bu yokluk bir özellik vaadi değil, hem statik kaynak taraması hem runtime şema taramasıyla doğrulanan mevcut durumdur. Gelecekte yeni owner yalnız merkezi registry, delete adapterı, aynı transaction/kanıt zinciri ve hedefli negatif testleriyle eklenebilir. PPK-016 `derived_data_policy_*` tabloları kullanıcı semantik payloadı değil, content-free immutable provenance metadata'sıdır ve payload silme ownerı sayılmaz.

## Yedek ve replica kararı

Plaintext `.db` replica/export yolu kapalı kalır; yalnız korumalı `.pptbackup` sınırı desteklenir. Yerel kaynak silme tamamlandığında backup propagation pending olarak kalır. Her etkin yönetilen hedef için fresh korumalı yedek success, file path ve SHA-256 ile doğrulanır; eski yönetilen yedek artefaktları recoverable karantinaya taşınır ve aktif hedeften ayrılır. Bütün etkin hedefler başarıyla yenilenmeden ve hedefte yönetilmeyen aktif `.pptbackup` kalmadığı doğrulanmadan pending kayıtlar exact sürüm bağıyla kapatılmaz.

Karantina fiziksel yok etme değildir. Yönetilmeyen veya uygulamanın fiziksel kontrolü dışındaki harici kopyalar otomatik silinmiş sayılmaz. Bunlar attention/pending duruşunu korur ve mevcut external-backup inventory zincirinde signed destruction evidence ya da açık attestation gerektirir. Korumalı whole-vault backup ayrı kriptografik sınırdır; varlığı PPK-019 propagation kanıtının yerine geçmez.

## İstemci ve görünürlük sınırı

`system:getSourceDeletionPropagationBoundary` sıfır argümanlı ve policy-sensitive no-cache IPC'dir. Domain/use-case/renderer zinciri yalnız sabit owner/cache registry adlarını, fail-closed duruşu, migration sürümünü ve content-free booleanları gösterir. Kaynak kimliği, tombstone, yedek yolu, kullanıcı içeriği, silinen payload veya kanıt zarfı renderer'a çıkarılmaz.

## Şema ve veri kararı

Yeni migration eklenmez; latest migration 77 kalır. Migration 16/17 data lifecycle ve backup propagation temelini, migration 18/19 karantina/harici kopya temelini, migration 29-49 ise temiz yeniden yazımın crash-safe ve immutable kanıt zincirini sağlar. Gerçek kullanıcı verisi taşınmaz, historical backfill veya cutover yapılmaz, Desktop vault ve SQLite sahipliği değiştirilmez.

## Statik kaçış kapısı

`verify-source-deletion-propagation-boundary.mjs`, bütün `apps/*/src` ve `packages/*/src` alanlarını tarar. Merkezi repository dışındaki primary source delete SQL'i, kayıt dışı derived payload tablosu/writerı, yetkisiz propagation repository çağrısı veya enforcement compositionı, plaintext database copy ve boş cache invalidator reddedilir. Politika, use-case, repository, DataStore ve main composition markerları ayrıca zorunludur.

## Korunan önceki sınırlar

PPK-012 offline lease/no-cache, PPK-013 istemci veri erişim yasağı, PPK-014 sürümlü Core API, PPK-015 ağ egress, PPK-016 türetilmiş veri politika mirası, PPK-017 content-free log ve PPK-018 değişmez karar audit zinciri gevşetilmez. PPK-020 çok platformlu conformance suite ayrı kabul şartıdır ve bu kararla tamamlanmış sayılmaz.

## Sonuç

PPK-019 `COMPLETE` olarak kapanmıştır. Yeni semantic derived owner, runtime cache sahibi, replica yolu veya backup target türü; merkezi owner registry, fail-closed delete adapterı, aynı transaction/kanıt zinciri ve negatif testler olmadan üretime eklenemez. Yönetilmeyen ve harici kopyalar için fiziksel imha iddiası yapılmaz; mevcut kanıt/attestation sınırı korunur. PPK-020 ve sonraki Bronze kapsamı açık kalır.
