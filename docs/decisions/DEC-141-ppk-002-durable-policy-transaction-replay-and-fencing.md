# DEC-141 — PPK-002 Kalıcı Policy Transaction, Replay ve Database Fence Dilimi

## Durum

Kullanıcının tam otomatik devam talimatı ve `DEC-137` öncelik politikası uyarınca 30-P başlangıç kararı olarak kabul edilmiştir.

## Karar

30-O, üretim arşiv PEP kompozisyonunu, korumalı receipt journal bağlantısını, gerçek SQLite repository akışını ve aynı transaction içindeki authority/resource yeniden doğrulamasını kalıcı Library receipt zinciriyle tamamladı. Buna rağmen PPK-002 `PARTIAL`; kalıcı çok-süreç replay koruması, receipt ile business commit atomikliği ve cross-process fence ile SQLite COMMIT bütünlüğü açık kalmıştır.

30-P yalnız arşiv üretim yüzeyinde şu bütünlük zincirini kurar:

1. Replay rezervasyonları gerçek SQLite veritabanında kalıcı ve benzersiz tutulur.
2. Policy receipt özeti, nonce, correlation, resource/action/capability ve fence epoch aynı SQLite transaction'ında doğrulanıp kaydedilir.
3. Arşiv mutasyonu, değişmez audit kaydı ve güvenilir outbox kaydı bu receipt bağlamıyla birlikte commit veya rollback olur.
4. Database-enforced fence satırı transaction içinde doğrulanır; eşzamanlı süreçler aynı nonce, correlation veya eski epoch ile yazamaz.
5. Korumalı journal, transaction outbox'taki kalıcı receipt kaydından idempotent biçimde projekte edilir ve yeniden başlatmada readback doğrulanır.
6. İki süreçli yarış, crash/restart, rollback ve tamper senaryoları gerçek süreç çıkış kodlarıyla sınanır.

## Açık kalan sınırlar

Bu karar PPK-002'yi veya evrensel repository enforcement'ı tamamlamaz. Policy obligation yürütme, bütün repository ailelerinde audit/outbox enforcement, event/attachment cross-aggregate receipt bağlama, secure file deletion ile database commit atomikliği, Windows installed-service/SCM ve Core Service secret provisioning/rotation/ACL bu dilimin dışındadır.

Korumalı journal'ın geçerli tam kuyruğunun veritabanıyla birlikte eski bir sürüme döndürülmesini, veritabanı dışı güvenilir monoton otorite olmadan tespit etmek mümkün değildir. Bu nedenle complete-tail rollback detection `NOT_IMPLEMENTED` kalır ve PASS sayılmaz.

30-P database-fence iddiası yalnız policy-bound, governed arşiv repository yoluyla sınırlıdır. Her arşiv tablosunda evrensel direct-SQL enforcement `NOT_COMPLETE` kalır. Kurtarma yalnız ölü projection lock ile son tamamlanmamış byte kuyruğunu, tam önek doğrulandıktan ve özgün byte'lar adli kurtarma kanıtı olarak saklandıktan sonra kapsar. Geçerli complete-tail rollback, ayrı doğrulanabilir proof token ile journal acknowledgement, kullanılmamış süresi dolmuş replay satırlarının temizlenmesi ve bilinmeyen commit sonucu sonrasında yeni correlation ile retry idempotency açık kalır ve PASS sayılmaz.

Native etkileşimli Windows Hello kanıtı cihaz bulunmadığı için `NOT_RUN_NOT_PASS` kalır. Bronze doğrulanmış ilerleme %25,0'dır; Silver ve Gold yasaktır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
