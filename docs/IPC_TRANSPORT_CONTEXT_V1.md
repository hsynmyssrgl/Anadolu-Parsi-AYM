# IPC Taşıma Bağlamı V1

Build 159 ile preload ve ana süreç arasındaki her `invoke` çağrısı uygulama argümanlarından ayrı bir taşıma bağlamı taşır.

Bağlam alanları:

- benzersiz renderer oturum kimliği,
- benzersiz istek kimliği,
- oturum çağı,
- çağrı sıra numarası,
- kanal adı,
- grafik, zaman tüneli, katalog, dashboard, bildirim ve arşiv revizyon özeti.

Ana süreç güvenilir renderer kontrolünden sonra bağlamı kesin alan ve tür sözleşmesiyle doğrular. Eski oturum çağı ve yinelenen istek kimliği reddedilir. Taşıma bağlamı uygulama argümanlarından ayrılmadan kanal politikasına veya handler'a verilmez.

Başarılı yanıt, istek bağlamını ve ana süreç correlation kimliğini içeren zarfla döner. Preload zarfın kanal, istek kimliği, renderer oturumu, sıra, oturum çağı ve revizyon özetini gönderdiği istekle birebir karşılaştırır. Oturum çağı ilerlemişse eski yanıt renderer API'sine değer olarak teslim edilmez.

Kimlik doğrulama kurulumu, giriş, çıkış, davet kabulü ve tam yedek geri yükleme çağrıları yeni taşıma oturum çağı başlatır. Mutasyon yanıtlarındaki revizyonlar yalnız monoton biçimde taşıma revizyon özetine eklenir.
