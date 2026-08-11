# 30-T — PPK-002 yeni korelasyon işlem idempotency denetimi

## Sonuç

30-T hedef dilimi yerel olarak PASS durumundadır. Bilinmeyen commit sonucundan sonra aynı işlem kimliği ve semantik parmak iziyle, fakat yeni correlation, nonce ve receipt ile yapılan tekrar; daha önce commit edilmiş özgün sonucu döndürür ve iş mutasyonunu ikinci kez çalıştırmaz.

## Uygulanan kontroller

- Her yönetilen arşiv mutasyonu correlation ve receipt kimliğinden bağımsız, çağıran tarafından kararlı bir operation ID taşır.
- Operation ID; aile, aktör, kaynak, eylem, capability ve semantik girdinin kanonik SHA-256 parmak izine bağlanır. Farklı anlamla yeniden kullanım fail-closed reddedilir.
- Migration 60; özgün receipt bağını, kanonik parmak izini, başarılı sonucu ve sonuç hash'ini iş mutasyonuyla aynı SQLite transaction içinde saklar.
- Eşleşen tekrar özgün sonucu döndürür, iş callback'ini atlar ve ayrı, değiştirilemez retry receipt kanıtı yazar.
- Commit, rollback, uyuşmazlık ve SQLite kapatıp yeniden açma davranışları gerçek veritabanı üzerinde doğrulanmıştır.
- Arşiv dosyası yazımı exclusive create kullanır; yalnız aynı plaintext içeriği yeniden kullanır, farklı içeriği reddeder ve commit sonucu bilinmiyorsa olası kalıcı şifreli dosyayı silmez.
- Preload katmanı etkin renderer oturumu içinde eş mutasyonları birleştirir ve hata/timeout sonrasında aynı operation ID'yi tekrar kullanır.

## Doğrulama kanıtı

- Sözleşme: 83/83 PASS.
- Kontrollü çalışma zamanı: 63/63 PASS; içindeki gerçek alt süreçlerin tamamı exit code 0.
- Odaklı ve production regression testleri: 48/48 PASS.
- 30-T özel testleri: 4/4 PASS.
- IPC payload güvenliği: 138/138 PASS.
- Tam test paketi: 89/89 PASS.
- Governed final doğrulama: 24/24 süreç PASS; gerçek exit code değerlerinin tamamı 0.
- Dört başarısız deneme ayrı tanılama kanıtı olarak korunmuştur ve hiçbiri PASS sayılmamıştır.

## Açık sınır

Bu teslim, aynı çalışan renderer oturumundaki çağıran kimliği tekrarını ve SQLite'da kalıcı operation ledger sonucunun yeni korelasyonla geri alınmasını doğrular. Uygulama/renderer tamamen yeniden başlatıldıktan sonra henüz gönderilmiş fakat sonucu bilinmeyen operation ID'nin çağıran tarafta kalıcı kurtarılması uygulanmamıştır. Tüm API/use-case/repository yüzeylerinin evrensel enforcement kapsamı, koordineli veritabanı+journal geri dönüşüne karşı haricî monoton otorite, süresi dolmuş kullanılmamış reservation temizliği, obligation execution, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service kanıtı açık kalır. PPK-002 `PARTIAL`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold yasaktır. Library receipt ve geri-okuma PASS olmadan 30-T tamamlandı sayılmaz.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
