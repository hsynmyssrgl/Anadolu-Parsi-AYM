# Atomik Temiz-Yedek Terminal Geçişi V1

Build 197, aktif temiz-yedek çalışmasının terminal sonuçlandırmasını çalışma defteri tarafından sahiplenilen tek bir SQLite cümlesine bağlar.

- Politika `running` durumundan tek başına çıkarılamaz.
- Çalışma defteri terminal duruma geçtiğinde aynı SQL cümlesindeki `AFTER` tetikleyicisi politikayı eşleşen terminal duruma taşır.
- Çalışma kimliği, tetikleyici, saklama kesimi ve sayaçlar terminal cümlesinde değiştirilemez.
- `success`, `partial`, `failed`, `attention`, `deferred` ve `interrupted` eşlemeleri fail-closed doğrulanır.
- Kesinti kurtarması da çalışma defterini sonuçlandırarak politikayı atomik biçimde `backoff` durumuna geçirir.

Migrasyon 41, DEC-087 ve ADR-070 bağlayıcıdır.
