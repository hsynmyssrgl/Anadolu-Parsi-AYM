# DEC-145 — PPK-002 new-correlation operation idempotency

## Karar

30-T, bilinmeyen bir SQLite COMMIT sonucundan sonra aynı arşiv yazma niyetinin yeni correlation, nonce ve receipt ile yeniden gönderilmesinde ikinci bir iş mutasyonu oluşmasını engeller.

Her üretim arşiv mutasyonu correlation'dan bağımsız ve çağrı sahibi tarafından tekrar kullanılabilen bir işlem kimliği taşır. Bu kimlik; aile, aktör, kaynak, eylem ve semantik girdinin kanonik SHA-256 özetiyle bağlanır. İlk başarılı işlemde kimlik, özgün receipt ve başarılı sonuç iş mutasyonu, audit ve outbox ile aynı SQLite transaction'ında kalıcılaştırılır. Aynı kimlik ve aynı özetle gelen yeni-correlation tekrarında yeni yetkilendirme receipt'i kanıt olarak kaydedilebilir, ancak iş mutasyonu, audit, outbox ve bağlı etkinlik artışı yeniden çalıştırılmaz; özgün kalıcı sonuç geri döndürülür. Aynı kimliğin farklı bir özetle kullanılması fail-closed reddedilir.

Renderer–main IPC sınırı, retry yapılabilen belirsiz sonuçlarda aynı işlem kimliğini korur. Doğrulamalar gerçek SQLite transaction'ı, rollback, fingerprint çatışması ve yeni correlation ile tekrar senaryosunu kapsar.

## Kapsam sınırı

Bu karar yalnız governed üretim arşiv yazma yolu için operation idempotency sağlar. Tüm API/use-case/repository yüzeylerinde evrensel PEP enforcement tamamlanmış sayılmaz. Koordineli veritabanı+journal geri dönüşüne karşı haricî monoton otorite, süresi dolmuş kullanılmamış replay rezervasyonlarının temizlenmesi, obligation execution, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service/SCM kanıtı açık kalır.

PPK-002 `PARTIAL`; evrensel repository enforcement `NOT_COMPLETE`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold `FORBIDDEN_NOT_READY` kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
