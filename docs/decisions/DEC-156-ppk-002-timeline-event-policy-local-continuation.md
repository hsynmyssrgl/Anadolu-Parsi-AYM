# DEC-156 - PPK-002 timeline-event politika enforcement yerel devam dilimi

## Durum

ACTIVE - 2026-08-10 tarihli full-auto yerel devam kararı.

## Seçim kararı

DEC-137 sırası korunmuştur. 30-Z haricî Library receipt `PENDING` ve GOV-005 `PENDING_EXTERNAL_AUTHORITY` olduğundan resmî 30-Z adımı ilerletilmez. Yerel olarak eyleme uygun, başlanmış, P0 ve `PARTIAL` durumdaki PPK-002 zincirinde DEC-151'in açık bıraktığı timeline-event politika sınırı seçilmiştir.

Bu çalışma yeni Build değildir. 30-Z resmî tamamlanma iddiası `false`, haricî receipt durumu `PENDING`, PPK-002 durumu `PARTIAL` kalır. `LOCAL_CONTINUATION_ONLY` sonucu haricî Library receipt veya resmî completion transition yerine geçmez.

## Dar uygulama sınırı

- Timeline event create/read/update/archive/participant/invitation/notes işlemleri exact `event` policy intent ve `PolicyAuthorizedRepositoryExecutionContext` olmadan repository'ye giremez.
- Migration 67; event owner, event receipt, timeline fence, journal projection, görünürlük hassasiyeti ve isteğe bağlı source-location read receipt bağlarını SQLite trigger ve `governed_timeline_events` görünümüyle doğrular.
- Receiptless ve ownerless tarihsel event satırları silinmez; tabloda kalır ve governed projection dışında karantinaya alınır.
- Receiptless aktif-owner insert, stale receipt update ve governed fiziksel delete fail-closed reddedilir.
- Event üzerinde konum referansı varsa ayrı exact `location.read` receipt zorunludur; event receipt bu receipt'in yerine geçmez.
- Audit ve outbox kayıtları aynı canonical `event` policy receipt'e bağlanır. Eski `timeline_event` permission alias'ları yalnız okuma uyumluluğu için korunur.
- Aile veri içe aktarmadaki receiptless timeline yazma yolu kaldırılmış ve multi-receipt batch tamamlanana kadar event import fail-closed tutulmuştur.
- Automation, AI consent, dashboard, entity catalog, genealogy, large-family read model ve report okuyucuları governed event projection kullanır.

## Korunan açık sınırlar

Evrensel bütün API/use-case/repository enforcement, obligation execution, haricî monoton otorite, governed deletion/claim/repair iş akışları ve haricî 30-Z Library receipt tamamlanmamıştır. Bu nedenle schema/migration/use-case/repository/API alanlarında yalnız timeline dikey dilimi kanıtlanmış; PPK-002 chain alanları evrensel tamamlanmış olarak değiştirilmemiştir.

## İzlenebilirlik

- Gereksinim: `PPK-002`
- Öncelik: `DEC-137`
- Önceki dilim: `DEC-151`
- Kaynak/receipt/Build sınırı: `DEC-152`
- Kurallar: `PR-087`, `PR-187`, `PR-189`, `PR-194`, `PR-203`, `PR-208`
- Schema/migration: `packages/database/src/family-database-migrations.ts`, migration 67
- Use-case: `packages/application/src/timeline-use-cases.ts`
- Repository: `packages/repositories/src/timeline-repository.ts`
- PEP/runtime: `apps/desktop/src/main/timeline-application-adapter.ts`, `apps/desktop/src/main/timeline-production-policy-runtime.ts`, `apps/desktop/src/main/data-store.ts`
- Test: `scripts/verify-ppk002-timeline-policy-local-continuation.mjs`, `scripts/verify-timeline-use-cases.mjs`, `scripts/verify-database-migrations.mjs`
- Kanıt: `artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json`, `artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json`, `artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json`
- Denetim: `docs/audit/PPK-002_TIMELINE_POLICY_LOCAL_CONTINUATION.md`
- Tanı ve yeniden üretim: `scripts/diagnose-ppk002-timeline-sql-fence.mjs`, `scripts/diagnose-ppk002-timeline-authorization-fence.mjs`, `scripts/apply-ppk002-timeline-repository-foundation.mjs`, `scripts/apply-ppk002-timeline-policy-runtime.mjs` ve bağlı `fix-ppk002-*` betikleri

Çalıştırılmayan, yerel veya kapsamı dar sonuçlar resmî PASS sayılmamıştır.

## Tam regresyon kapanışı

2026-08-10 tam Vitest paketi 28/28 dosya ve 158/158 test ile PASS olmuştur. Test fixture uyarlamaları süreli nesne izni, timeline okuması için `family.read`, tam LIFE-create drift noktası, `governed_timeline_events` fixture görünümü ve receipt'siz korumalı satır üretmeyen kontrollü otomasyon kaynağı ile sınırlıdır. Ürün fail-closed davranışı gevşetilmemiştir.

Kanıt: `artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json`. Yeniden üretim: `scripts/fix-ppk002-governed-regression-fixtures.mjs`, `scripts/refine-ppk002-governed-regression-fixtures.mjs`, `scripts/complete-ppk002-governed-regression-fixtures.mjs`.

## Doğrudan rol bypassı kapanışı

Timeline repository içindeki PEP-sonrası doğrudan `family_admin` görünürlük bypassı kaldırıldı. Kişisel etkinlik görünürlüğü yalnız sahiplik, aile görünürlüğü, seçili katılım ve süreli nesne izni ile belirlenir. Platform Policy Gate PASS: legacy debt 28, new bypass 0. Son tam regresyon 28/28 dosya ve 158/158 test PASS.
