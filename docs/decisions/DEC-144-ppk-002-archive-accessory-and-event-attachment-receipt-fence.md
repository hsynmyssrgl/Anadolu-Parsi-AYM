# DEC-144 — PPK-002 archive accessory and event-attachment receipt fence

## Karar

30-S, arşiv üretim yazma kapsamının `archive_retention_policies`, `archive_categories`, `archive_tags`, `archive_item_tags` ve `events.attachment_count` yüzeylerini SQLite seviyesinde geçerli ve kapsamı tam eşleşen PPK-002 receipt'ine bağlar.

Saklama politikası ile kategori oluşturma kendi kaynak kimliği ve `create` eylemiyle bağlanır. Sınıflandırma güncellemesindeki etiket ve kayıt-etiket değişiklikleri, tek kullanımlık ve değiştirilemez bir istenen-etiket kümesi içeren `archive_item/update` batch'i içinde yürür; batch son durumda mühürlenmeden işlem başarılı sayılamaz. Bağlı etkinliğin ek sayacı yalnız aynı ailedeki yeni arşiv kaydının `archive_item/create` receipt'iyle ve tam bir artış olarak değiştirilebilir.

Doğrudan SQL ile receipt'siz, kapsamı farklı, eski fence'e bağlı, plan dışı veya tekrar kullanılan yazılar fail-closed reddedilir. Başarılı aksesuar ve çapraz-aggregate yazıları değiştirilemez tüketim siciline kaydedilir.

## Kapsam sınırı

Bu karar yalnız yukarıdaki arşiv yardımcı tablolarını ve etkinlik ek sayacını kapsar. Tüm API/use-case/repository yüzeylerinin evrensel PEP kapsamı tamamlanmış sayılmaz. Koordineli veritabanı+journal geri dönüşüne karşı haricî monoton otorite, yeni-correlation unknown-commit idempotency, expired reservation pruning, obligation execution, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service kanıtı açık kalır.

PPK-002 `PARTIAL`; evrensel repository enforcement `NOT_COMPLETE`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
