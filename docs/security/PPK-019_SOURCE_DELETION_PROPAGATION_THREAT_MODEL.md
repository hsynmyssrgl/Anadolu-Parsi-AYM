# PPK-019 — Kaynak silme ve retention yayılımı tehdit modeli

## Durum ve varlıklar

Durum: `VALIDATED / COMPLETE`.

Korunan varlıklar kaynak payloadı, ona bağlı erişim metadata'sı, süreç-içi cache kopyaları, gelecekteki OCR/index/thumbnail/AI-memory materializationları, plaintext replica yasağı, purged tombstone, yönetilen korumalı yedekler, harici kopya kanıtları ve propagation plan hash zinciridir.

## Tehditler

1. Kaynak satırının cache veya türetilmiş owner temizlenmeden silinmesi.
2. Yeni OCR/index/thumbnail/AI-memory tablosunun merkezi registry ve delete adapterı olmadan eklenmesi.
3. Policy değerlendirmesi ile repository yazımı arasında şema değiştirerek owner taramasının atlatılması.
4. Plan source, owner outcome, cache registry, zaman veya hash alanının değiştirilmesi.
5. Yanlış lifecycle durumu, legal hold, yetkisiz bağlam veya bulunmayan kaynakta delete çalıştırılması.
6. Object permission ya da AI consent satırının kaynak siliminden sonra kalması.
7. Raw SQLite dosyasının plaintext replica/export olarak üretilmesi.
8. Fresh yedek doğrulanmadan veya eski yönetilen kopya aktif kökteyken pending tombstone'un kapatılması.
9. Yönetilmeyen ya da harici kopyanın uygulama tarafından fiziksel olarak yok edilmiş gibi raporlanması.
10. Recoverable karantinanın fiziksel destruction evidence yerine geçirilmesi.
11. Silme duruşu IPC'sinden kaynak, path, tombstone veya kullanıcı payloadı sızdırılması.
12. Cache invalidator'ın boş/no-op bağlanması veya bir cache sahibi temizlenemediği halde source delete'in açılması.

## Kontroller

- Merkezi policy tam yedi owner kind ve üç runtime cache registry setini, aynı transaction zamanını, kanonik plan hashini ve local/backup phase sonuçlarını doğrular.
- Cache invalidation use-case kontrol akışında persistent inspection ve repository delete çağrısından önce yürür; hata halinde sonraki iki çağrı yapılmaz.
- SQLite repository planı tekrar doğrular, `sqlite_schema` taramasını yeniden yapar ve şema/owner sapmasında transactionı geri alır.
- Lifecycle `purge_scheduled`, legal hold kapalı ve exact kaynak varlığı zorunludur. `secure_delete`, kaynak ile object permission/AI consent silimini aynı transactiona bağlar.
- Lifecycle tombstone kaynak payloadından ayrı tutulur ve `backup_propagation_pending=1` olarak korunur.
- Managed backup zinciri fresh korumalı backup success/path/SHA-256 doğrulaması, eski managed artefakt karantinası, unmanaged artefakt sıfırı ve exact pending update koşullarının tamamını ister.
- No target, başarısız refresh veya unmanaged artefakt attention/partial/failure üretir ve pending kaydı kapatmaz.
- Harici kopya mevcut signed evidence/attestation sınırında kalır; uygulama fiziksel erişimi olmadığını gizlemez.
- Statik gate primary delete, derived payload persistence, yetkisiz composition, plaintext replica ve no-op cache bypasslarını üretim kaynaklarında reddeder.
- Status IPC sıfır argümanlı, no-cache ve content-free'dir.

## Fail-closed sonuçlar

Cache registry/sayaç/zaman sapması, cache temizleme hatası, kayıt dışı kalıcı owner, plaintext replica, bozuk provenance sınıflaması, plan tamperı, TOCTOU şema değişikliği, lifecycle/legal-hold uyuşmazlığı, kaynak bulunamaması, fresh yedek/hash eksikliği, quarantine hatası, yönetilmeyen artefakt veya exact tombstone sürüm sapmasında kaynak/pending operasyonu başarılı sayılmaz. Transaction içi hata kaynak ve erişim metadata satırlarını birlikte geri alır.

## Gerçeklik ve kapsam sınırı

Bugün aktif semantic persistent OCR/index/thumbnail/AI-memory ownerı yoktur; gate gelecek eklemeyi varsayılan-ret ile yakalar. Runtime cache invalidation global cache temizliğidir; kaynak-spesifik payload sızıntısı bırakmamak için daha dar değil daha güvenli bir davranıştır. Yönetilen eski backup karantinası geri alınabilir idari ayrımdır, fiziksel imha değildir. Harici kopyalar ancak signed destruction evidence veya attestation ile kapanabilir. Yeni migration, gerçek veri taşıma, historical backfill, cutover ya da SQLite/vault sahiplik değişimi yoktur.

## Doğrulama durumu

Hedefli policy/repository/cache/backup matrisi, eski Build136 ve Build137 runtime'ları, PPK-012–PPK-019 güvenlik regresyonu, tam Vitest, root TypeScript, üretim constituent build'i, DataStore smoke, migration runtime, bağımlılık/workspace/karar defteri ve iki aşamalı contract/runtime demeti gerçek PASS vermiştir. Yönetişim kayıtları bu kanıtlarla `COMPLETE` durumuna geçirilmiştir.
