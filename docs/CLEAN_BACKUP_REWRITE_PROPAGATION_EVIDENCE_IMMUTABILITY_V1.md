# Temiz Yedek Propagation Kanıtı Değiştirilemezliği V1

## Amaç

Terminal temiz-yedek çalışma kaydına bağlanan propagation sonucunun, bağlantı kurulduktan sonra sessizce yeniden yazılmasını engellemek.

## Korunan alanlar

- `status`
- `pending_records`
- `target_count`
- `refreshed_targets`
- `quarantined_artifacts`
- `pending_remaining`
- `manual_backup_warning`
- `target_results`
- `error`
- `started_at`
- `completed_at`

## Davranış

Bir `backup_propagation_runs` satırı `backup_clean_rewrite_runs.propagation_run_id` tarafından referanslanıyorsa, yukarıdaki alanlardan herhangi birinin değerini değiştiren UPDATE işlemi reddedilir. Aynı değerleri yeniden yazan no-op güncellemeler kabul edilir. Referanslanmamış propagation kayıtları normal şekilde yönetilebilir.

## Uygulama

Migrasyon 47, SQLite `BEFORE UPDATE` tetikleyicisiyle fail-closed koruma sağlar. Silme ve kimlik değişikliği koruması migrasyon 46 ile birlikte çalışır.
