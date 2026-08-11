# DEC-134 — B1-05 Veri Onarma Merkezi Masaüstü Çalışma Alanı

## Durum

Kabul edildi ve 30-J kapsamında uygulanıyor.

## Karar

Veri Onarma Merkezi masaüstü uygulamasında ayrı, görünür bir menü ve çalışma alanı olarak sunulur. Renderer doğrudan veritabanına veya repository'ye erişmez. Bütün tarama, önizleme, uygulama ve geri alma çağrıları preload üzerinden daraltılmış, tipli ve correlated/trusted IPC kanallarına gider; ana süreçteki `FamilyDataStore` bu çağrıları 30-I'de kabul edilen application use-case ve merkezi yetkilendirme sınırına bağlar.

## Kullanıcı güvenliği

- Bir bulgu seçilmeden onarma gerekçesi ve önizleme üretilemez.
- Gerekçe 5–500 karakter aralığında olmalıdır; asıl doğrulama application katmanında tekrar yapılır.
- Uygulama düğmesi yalnız sunucunun ürettiği değişiklik öncesi/sonrası snapshot ekranda gösterildikten ve kullanıcı açık onay kutusunu işaretledikten sonra etkinleşir.
- Uygulama çağrısı önizlemenin `revisionToken` değerini taşır. Veri sonradan değişmişse repository fail-closed davranır ve yeniden tarama ister.
- Uygulanan bir onarma geçmişte görünür ve yalnız governed geri alma çağrısıyla geri alınabilir.
- Renderer `auth.role` veya benzeri doğrudan rol karşılaştırmasıyla yetki kararı vermez. Yetkisiz erişim application/authorization katmanında reddedilir; ayrıntılı bulgu verisi renderer'a açıklanmaz.
- Kullanıcı metinleri onarma sonucunu, önizleme zorunluluğunu ve geri alma durumunu açıklar; kaynak kod veya veritabanı bilgisi gerektirmez.

## IPC sözleşmesi

- `data-repair:workspace`: güncel bulgular ve işlem geçmişi
- `data-repair:preview`: gerekçeli ve snapshot içeren değişmez önizleme
- `data-repair:apply`: işlem kimliği ile beklenen revision belirtecini kullanarak atomik uygulama
- `data-repair:undo`: uygulanmış işlemin fail-closed geri alınması

Kanallar doğrudan `ipcMain.handle` ile kaydedilemez; mevcut sender trust, correlation, lifecycle ve transport zarfını uygulayan `registerIpcHandler` üzerinden kaydedilir.

## Doğrulama ölçütü

B1-05 yalnız IPC sözleşmesi, preload/global tipleri, görünür menü ve ekran, zorunlu önizleme/onay, revision koruması, gerçek `FamilyDataStore` + SQLite apply/undo/stale/authorization çalışma zamanı ve regresyon kapıları gerçek exit code `0` ile doğrulandığında COMPLETE olabilir. Yalnız kaynak dosya varlığı PASS değildir.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
