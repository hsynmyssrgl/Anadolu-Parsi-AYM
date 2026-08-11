# Bronze MVP-42 Runtime Foundation Gate

**Sürüm:** 23.07.2026.42  
**Revizyon:** REVİZYON-060  
**Milestone:** B060-M3

Bu gate aşağıdaki koşulları zorunlu tutar:

- Merkezi configuration bootstrap Electron başlangıcında çalışır.
- Data, archive, cache, logs ve temp yolları ayrıdır.
- Mevcut `panthera-family.db` dosya adı korunur.
- JSON Lines structured log, hassas alan maskeleme ve dosya rotasyonu aktiftir.
- 124 IPC kanalının tamamı merkezi correlation wrapper üzerinden kayıt edilir.
- Background scheduler işlemleri ayrı job correlation ID taşır.
- Renderer API ve mevcut IPC dönüş değerleri bu aşamada değiştirilmez.
- Gerçek SQLite smoke akışı ve yerel `.db` backup davranışı korunur.
