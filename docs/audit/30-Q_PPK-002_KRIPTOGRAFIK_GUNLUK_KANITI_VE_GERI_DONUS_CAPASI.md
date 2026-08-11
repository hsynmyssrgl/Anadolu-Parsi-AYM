# 30-Q — PPK-002 kriptografik günlük kanıtı ve geri dönüş çapası

30-Q, 30-P sonrasında açık kalan iki günlük bütünlüğü sınırını hedefler. Korumalı günlük artık başarılı `ensure` çağrısından boş sonuç döndürmez; tam makbuz kaydına, günlük girdisine ve geri okunan günlük başına bağlı, alan ayrımlı HMAC-SHA256 kanıtı üretir. Üretim çalışma zamanı bu kanıtı korumalı günlük üzerinde doğrulamadan SQLite projeksiyon kaydını onaylayamaz.

Onay işlemi kanıtın bütün alanlarını projeksiyon satırına yazar ve aynı SQLite işlemi içinde tekil günlük başı çapasını yalnız daha ileri bir sıra numarasına taşır. Yeni yetkilendirme veya bekleyen projeksiyon kurtarması başlamadan önce bu çapa güncel korumalı günlükte doğrulanır. İki girdili günlük dosyasının, kendi içinde geçerli olan tek girdili eski sonuna geri alınması gerçek dosya ve SQLite testinde tespit edilmiş; yeni yetkilendirme kapalı durmuştur.

Yerel temiz kanıtlar: sözleşme 89/89 PASS, kontrollü çalışma zamanı 30/30 PASS, odaklı Vitest 16/16 PASS, tam Vitest 83/83 PASS ve kök tür denetimi exit code 0. İlk toplu doğrulamada eski arşiv test bağlantısının kalıcı makbuz zincirini üretmediği gerçek exit code 1 ile görüldü; bağlantı üretim sözleşmesine yükseltildikten sonra arşiv kullanım senaryosu 16/16 ve exit code 0 ile geçti. On üç başarısız teknik/yazım/paketleme denemesi ayrı kanıtlarda korunur ve hiçbirisi PASS sayılmaz.

Bu çalışma PPK-002'yi tamamlamaz. Veritabanı ile günlük dosyasının birlikte eski hâle alınmasına karşı haricî monoton otorite, evrensel repository/doğrudan SQL koruması, yeni correlation ile bilinmeyen commit tekrar güvenliği, süresi dolmuş kullanılmamış replay temizliği, yükümlülük icrası, güvenli dosya silme/veritabanı atomikliği ve kurulu Core Service kanıtları açıktır. Bronze doğrulanmış ilerleme %25,0 olarak korunur; Silver ve Gold yasaktır. Native etkileşimli Windows Hello ile installer bu çalışmada çalıştırılmamıştır ve PASS değildir.

Kalıcı G: kaydı ve geri okuma zinciri tamamlanmadan 30-Q resmî COMPLETED veya PASS ilan edilmez.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
