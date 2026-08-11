# Bronze RC2 Build 204 Sürüm Notları

Build 204, SQLite REPLACE çatışma çözümünün bağlı propagation kanıtı değişmezliğini atlamasını engeller.

- Varsayılan `recursive_triggers=0` davranışı altında Build 203 kaçışı yeniden üretildi.
- Referanslanmış propagation kimliğine INSERT/REPLACE reddedilir.
- Referanslanmamış propagation kayıtlarının normal yönetimi korunur.
- Migrasyon 48, DEC-094 ve ADR-077 eklendi.
