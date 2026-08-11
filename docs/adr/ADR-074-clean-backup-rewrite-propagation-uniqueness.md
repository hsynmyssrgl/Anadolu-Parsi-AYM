# ADR-074 — Propagation sonucu tekil sahipliği

`backup_clean_rewrite_runs.propagation_run_id` NULL olmayan kayıtlar için benzersizdir. Böylece tek bir yayılım sonucu birden çok temiz-yedek çalışmasının sonucu olarak yeniden kullanılamaz.
