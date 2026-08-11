# ADR-076 — Bağlı propagation kanıtını dondurma

## Karar

`backup_propagation_runs` satırı bir `backup_clean_rewrite_runs.propagation_run_id` tarafından referanslandığında, sonuç kanıtını oluşturan tüm alanlar SQLite `BEFORE UPDATE` tetikleyicisiyle değiştirilemez hâle gelir.

## Gerekçe

Temiz-yedek terminal defteri denetim kanıtıdır. Bağlantı kurulduktan sonra propagation durumunun, sayaçlarının, hedef sonuçlarının, hatasının veya zamanlarının değiştirilmesi tarihsel sonucu sessizce yeniden yazardı.

## Sonuç

No-op güncellemeler ve referanslanmamış propagation kayıtlarının normal yönetimi korunur. Bağlı kanıt yalnız okunabilir olur.
