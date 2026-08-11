# DEC-146 — PPK-002 kalıcı bekleyen işlem kimliği kurtarma

## Karar

30-U, bilinmeyen bir işlem sonucundan sonra renderer veya uygulama yeniden başladığında çağrı sahibinin kararlı işlem kimliğini kaybetmesini engeller.

Governed arşiv mutasyonu, korunan iş yan etkilerinden önce aile, aktör, mutasyon ailesi ve kanonik semantik özet ile bağlı bir bekleyen işlem kimliğini SQLite üzerinde ayırır. Aynı niyet renderer belleği kaybolduğunda veya uygulama ile SQLite yeniden açıldığında aynı kimliği geri alır. Eşleşmeyen özet, belirsiz eşleşme ve çatışan eşzamanlı edinim fail-closed reddedilir.

İşlem sonucu çağrı sahibine kesin olarak ulaştığında ayrı ve açık bir acknowledgement bekleyen kimliği mühürler. Sonuç bilinmiyorsa kayıt açık kalır ve 30-T operation ledger üzerinden aynı iş sonucuna dönülür; korunan iş, audit, outbox veya attachment mutasyonları ikinci kez çalıştırılmaz. Başarı acknowledgement'ından sonra aynı semantik girdinin bilinçli yeni kullanımı yeni bir işlem kimliği alabilir.

Doğrulama, gerçek SQLite kapatma/açma ve ayrı süreç sınırları üzerinden işlem kimliği kurtarmayı, exactly-once mutasyon sonucunu, eşzamanlı edinimi ve fingerprint çatışmasını gerçek process exit code'larıyla kapsar.

## Kapsam sınırı

Bu karar yalnız governed üretim arşiv yazma yolunun bekleyen işlem kimliği kurtarmasını hedefler. Süresi dolmuş ve hiç kullanılmamış kayıtların temizlenmesi bu adımda PASS sayılmaz. Tüm API/use-case/repository yüzeylerinde evrensel PEP enforcement, koordineli veritabanı+journal geri dönüşüne karşı haricî monoton otorite, obligation execution, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service/SCM kanıtı açık kalır.

PPK-002 `PARTIAL`; evrensel repository enforcement `NOT_COMPLETE`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
