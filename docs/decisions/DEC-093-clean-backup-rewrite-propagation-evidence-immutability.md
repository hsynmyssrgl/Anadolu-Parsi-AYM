# DEC-093 — Bağlı propagation kanıtının değiştirilemezliği

Terminal temiz-yedek çalışma kaydına bağlanan propagation sonucu artık yalnız kimliğiyle değil, tüm sonuç kanıtı alanlarıyla kalıcıdır. `status`, sayaçlar, hedef sonuçları, hata ve zaman alanları sonradan değiştirilemez. Koruma SQLite düzeyinde fail-closed uygulanır.
