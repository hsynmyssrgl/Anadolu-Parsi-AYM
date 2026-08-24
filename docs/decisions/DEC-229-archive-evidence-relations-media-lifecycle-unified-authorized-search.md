# DEC-229 — Arşiv kanıt ilişkileri, medya yaşam döngüsü ve birleşik yetkili arama

## Durum

33-R yerel uygulama başlangıcıdır. B3-01, B3-03 ve B3-05 için domain, migration, repository, merkezi PEP/UoW, masaüstü facade, IPC ve UI zinciri yerel hedef testlerde çalışmaktadır. Buna rağmen 33-P aktif öncül olduğu, atomik registry kapanışı yapılmadığı ve dış/manual kabul kanıtları tamamlanmadığı için gereksinim PASS sayılmaz.

## Karar

Arşiv belgesi bir aile ilişkisine yalnız exact owner-bound belge, ilişki kimliği, kanıt tarihi ve `low|medium|high` güven düzeyiyle bağlanır. Bağ ekleme ve kaldırma optimistic revision, idempotent client operation, current state fingerprint ve aynı kaynak için merkezi `archive.write/update` PEP receipt/fence/projection kanıtına tabidir. Kaldırma fiziksel geçmiş silmez; current kayıt yalnız `active -> removed` ilerler ve append-only mutation geçmişi korunur.

İlk arşiv sürümü `create`, sonraki sürümler `update` receipt’iyle yazılır. Yeni sürüm dosyası ana süreçte seçilir; main-process inspection sonucu aile, actor, arşiv kaydı, normalleştirilmiş not, dosya SHA-256 ve boyutuna bağlanan deterministik operation/version kimliği üretilir. Şifreli kasa no-overwrite yazımı aynı kimlikte yalnız byte-exact dosyayı yeniden kabul eder ve doğrulanmış metadata transaction’ına bağlanır. Renderer dosya yolu, stored name, anahtar, receipt, account, family veya owner yetkisi almaz. Process restart sonrası renderer kimliği değişse bile aynı dosya ve semantik girdi aynı kalıcı işlem sonucunu replay eder; farklı içerik aynı kasa kimliğinde fail-closed reddedilir.

Birleşik arama family, event, archive, finance, health ve life kaynaklarını yalnız mevcut merkezi yetkili read use-case’leri üzerinden tarar. Yeni raw SQL arama veya renderer-side filtreleme yetki kaynağı değildir. Her kaynak eksiksiz ve başarılı dönmeden kısmi sonuç gösterilmez. Sorgu 80 karakter, 8 token, 5.000 aday ve 25 sonuçla sınırlıdır; renderer’a sorgu echo edilmez.

## Şema ve güvenlik sınırı

Migration 96 `archive_relation_evidence` current tablosunu ve `archive_relation_evidence_mutations` immutable ledger’ını ekler; archive version trigger’ını v1=create, vN=update receipt gerçeğine hizalar. Migration checksum’u `c00b2a72bf49d2200c85b2045a8ab7a01ef7a41882b2b14eb5a1f4715bde1eb2` değeridir. Owner/account/family/resource uyuşmazlığı, future evidence date, forged receipt, stale revision, duplicate operation mismatch ve current/history fiziksel silme girişimi fail-closed reddedilir.

PPK-021 güncel ratchet’i 568 dosya / 889 yüzey / `3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd`; PPK-022 ratchet’i 568 dosya / 428 yüzey / `1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1` değerindedir. Statik manifest girdileri runtime yetkisi değildir; merkezi policy ve repository receipt bağları ayrıca zorunludur.

## Fail-honest sınırlar

- Yerel 8 dosya / 30 test ve teknik gate sonuçları gereksinim kapanışı değildir.
- Şifreli dosya ile SQLite metadata arasında evrensel filesystem/transaction atomikliği iddia edilmez.
- Belirsiz commit sonrası aynı dosya ve semantik girdiyle process restart replay’i production DataStore/SQLite testiyle doğrulanır; genel filesystem/SQLite crash atomikliği veya kullanıcı seçimi olmadan otomatik devam iddiası kurulmaz.
- Legacy ownerless arşivler actor-owner yeniden doğrulaması olmadan fail-closed kalır.
- Gerçek kullanıcı, büyük aile, erişilebilirlik, gizlilik, hukuk ve güvenlik UAT kanıtları `NOT_RUN` durumundadır.
- Registry, roadmap, work plan ve active ledger bu starter tarafından değiştirilmez; persistent completion receipt üretilmez.

## Sonuç

33-R `PLANNED / LOCAL_IMPLEMENTATION_STARTED` olarak kalır. Teknik kaynak zinciri bir sonraki kapanış adımına hazırdır; `countsAsRequirementPass=false` gerçeği dış/manual kanıtlar ve öncül yönetişim kapanışları tamamlanana kadar korunur.

## 24.08.2026 değişiklik-etki doğrulaması

PR-235 kapsamında güncel kullanıcı dili ve renderer sözleşmesi bu karara yeniden bağlandı; 52/52 sınır-sözleşme-çalışma zamanı zinciri PASS oldu. Bu kayıt dış/manual kanıtları kapatmaz ve `countsAsRequirementPass=false` sınırını değiştirmez.
