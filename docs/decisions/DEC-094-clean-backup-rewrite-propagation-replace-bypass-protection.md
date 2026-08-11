# DEC-094 — Bağlı propagation kanıtında REPLACE kaçışını kapatma

Terminal temiz-yedek çalışma kaydına bağlanan propagation kimliğine yönelik yeni INSERT girişimleri reddedilir. Bu kural, SQLite `INSERT OR REPLACE` çatışma çözümünün varsayılan `recursive_triggers=0` ortamında DELETE tetikleyicisini atlayarak kanıtı yeniden yazmasını engeller.
