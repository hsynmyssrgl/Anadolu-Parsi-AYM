# DEC-147 — PPK-002 süresi dolmuş kullanılmamış replay rezervasyonu temizliği

## Karar

30-V, kalıcı üretim replay deposunda süresi dolduğu hâlde hiçbir politika işlem receipt’i tarafından tüketilmemiş nonce rezervasyonlarını sınırlı ve deterministik gruplar hâlinde temizler.

SQLite içinde tekil bir yerel temizleme eşiği tutulur ve bu eşik yalnız ileri taşınabilir. Replay rezervasyonu silme tetikleyicisi, yalnız rezervasyon süresi kalıcı eşikten kesin olarak küçükse ve nonce herhangi bir transaction receipt’i tarafından kullanılmamışsa silmeye izin verir. Gelecekteki, eşik üzerindeki veya tüketilmiş bir rezervasyonun repository dışı doğrudan SQL ile silinmesi fail-closed reddedilir.

Üretim replay deposu her yeni nonce rezervasyonunda aynı transaction içinde önce yerel eşiği ilerletir, son kullanma zamanı ve nonce sırasına göre sınırlı sayıda uygun kaydı temizler, sonra yeni rezervasyonu oluşturur. Eşik gerilemesi, geçersiz zaman, sınırsız istek ve tüketilmiş kaydı silme girişimi reddedilir.

## Kapsam sınırı

Bu karar yerel SQLite replay rezervasyonu yaşam döngüsünü ve kaynak tüketimi sınırını hedefler. Koordineli veritabanı ve journal geri dönüşüne karşı haricî monoton otorite bu adımda uygulanmaz ve `NOT_IMPLEMENTED` kalır. Tüm API/use-case/repository yüzeylerinde evrensel PEP enforcement, obligation execution, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service/SCM kanıtı açık kalır.

PPK-002 `PARTIAL`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
