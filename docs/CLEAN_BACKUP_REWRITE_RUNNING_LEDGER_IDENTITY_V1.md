# Çalışan Temiz-Yedek Defteri Kimliği V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Temiz-yedek yeniden yazımında `running` durumundaki çalışma defteri satırı ile kalıcı politika sahibinin tek ve doğrulanabilir bir kimlik oluşturmasını zorunlu kılmak.

## Bağlayıcı kurallar

- `backup_clean_rewrite_runs.status='running'` satırı yalnız politika `state='running'` iken oluşturulabilir.
- Defter `id` değeri politika `in_progress_run_id` değeriyle aynı olmalıdır.
- Defter `trigger` değeri politika `last_trigger` değeriyle aynı olmalıdır.
- Defter `started_at`, politika `in_progress_started_at` ve `last_attempt_at` değerleriyle aynı olmalıdır.
- Defter `updated_at`, claim anındaki politika `updated_at` değeriyle aynı olmalıdır.
- Aktif `running` defterin kimliği, tetikleyicisi veya başlangıç kronolojisi değiştirilemez ve satır silinemez.
- Yetim veya uyuşmayan çalışan defter, tek-çalışma indeksini kilitlemeden önce SQLite tarafından fail-closed reddedilir.
- Geçerli repository claim ve terminal sonuçlandırma akışı korunur.

## Kanıt

- Repository davranışı: `scripts/verify-build193-clean-rewrite-running-ledger-identity-runtime.mjs`
- Gerçek SQLite: `scripts/verify-build193-clean-rewrite-running-ledger-identity-sqlite-runtime.mjs`
- Kontrollü TypeScript/regresyon: `scripts/verify-build193-clean-rewrite-running-ledger-identity-syntax.mjs`

`DEC-083`, `ADR-066` ve `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.
