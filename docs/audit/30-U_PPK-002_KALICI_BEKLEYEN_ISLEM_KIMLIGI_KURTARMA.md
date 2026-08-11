# 30-U — PPK-002 kalıcı bekleyen işlem kimliği kurtarma denetimi

## Sonuç

30-U hedef dilimi yerel olarak PASS durumundadır. Korunan arşiv mutasyonu başlamadan önce SQLite'a kaydedilen işlem kimliği, renderer belleği kaybolduğunda veya uygulama süreci yeniden başladığında aynı aktör, aile, mutasyon ve kanonik semantik girdi için geri alınır. Başarılı sonuç açıkça onaylanana kadar kimlik açık kalır.

## Uygulanan kontroller

- Migration 61 kalıcı bekleyen işlem kimliği sicilini, açık niyet için tekillik indeksini, değiştirilemez geçişleri ve sonuçla uyumlu onay kurallarını oluşturur.
- Kimlik; aile, aktör, mutasyon ve semantik girdinin kanonik SHA-256 parmak izine bağlanır. Çakışan kullanım, aktör farkı, yeniden bağlama ve onaylanmış kimlik kullanımı fail-closed reddedilir.
- Yedi üretim arşiv mutasyonu, iş veya dosya seçimi sınırına girmeden önce açık kalıcı kimliği zorunlu kılar.
- Preload katmanı bellek içi eş çağrıları birleştirir; bellek kaybından sonra kalıcı kimliği yeniden edinir ve yalnız doğrulanmış başarılı sonuçtan sonra açık onay gönderir.
- İki ayrı uygulama-ana-süreç worker'ı, ilk süreç commit ettikten fakat onaylamadan kapandıktan sonra ikinci sürecin aynı kimliği kurtardığını, iş kaydını tek tuttuğunu, sonucu replay ettiğini ve sonrasında yeni kimliğe izin verdiğini kanıtlar.
- Doğrudan SQLite değiştirme/silme, bağ uyuşmazlığı, niyet uyuşmazlığı, eşzamanlı edinim ve yan etkisiz iptal yolları doğrulanmıştır.

## Doğrulama kanıtı

- Sözleşme: 95/95 PASS.
- Kontrollü çalışma zamanı: 85/85 PASS; 13 alt sürecin tamamı exit code 0.
- İki bağımsız süreçli yeniden başlatma kanıtı: 12/12 PASS.
- Odaklı ve üretim regresyon testleri: 52/52 PASS.
- Tam test paketi: 31/31 paket ve 93/93 test PASS.
- IPC payload güvenliği: 138/138 PASS.
- Governed final doğrulama: 24/24 süreç PASS; gerçek exit code değerlerinin tamamı 0.
- Altı başarısız deneme ayrı tanılama kanıtı olarak korunmuştur ve hiçbiri PASS sayılmamıştır.

## Açık sınır

Bu teslim, üretim arşiv IPC yüzeyindeki yedi mutasyonun kalıcı çağıran işlem kimliği kurtarmasını ve kontrollü iki-süreç yeniden başlatma davranışını doğrular. Tüm API/use-case/repository yüzeylerinin evrensel enforcement kapsamı, koordineli veritabanı ve journal geri dönüşüne karşı haricî monoton otorite, süresi dolmuş kullanılmamış reservation temizliği, obligation execution, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service kanıtı açık kalır. PPK-002 `PARTIAL`; Bronze doğrulanmış ilerleme `%25,0`; Silver ve Gold yasaktır. Library receipt ve geri okuma PASS olmadan 30-U tamamlandı sayılmaz.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
