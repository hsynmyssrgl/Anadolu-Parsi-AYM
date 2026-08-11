# Panthera pardus tulliana — Bronze MVP-42

**Sürüm:** 23.07.2026.42  
**Revizyon:** REVİZYON-060  
**Milestone:** B060-M3 Runtime Foundation

## Eklenenler

- Electron başlangıcına bağlı merkezi configuration bootstrap
- Data, archive, cache, logs ve temp klasörlerinin ayrıştırılması
- Mevcut `panthera-family.db` ile geriye uyumlu merkezi database path çözümlemesi
- JSON Lines dosya logger'ı
- Hassas metadata maskeleme
- Boyut bazlı log rotasyonu ve saklama süresi temizliği
- AsyncLocalStorage tabanlı correlation context
- 124 IPC kanalının tamamında merkezi request correlation ve süre loglama
- Background scheduler işlemlerinde job correlation
- Runtime Foundation otomatik doğrulama betiği
- Bronze Runtime Gate

## Korunan davranışlar

- Renderer IPC API'si değiştirilmedi.
- Mevcut IPC dönüş değerleri Result envelope'a henüz geçirilmedi.
- Mevcut SQLite veritabanı adı ve verisi korundu.
- Aile üyesi ekleme ve yerel `.db` backup smoke akışları çalışmaya devam etti.

Bu sürüm Bronze geliştirme kaynak teslimidir; Silver test veya Gold üretim artifact'i değildir.
