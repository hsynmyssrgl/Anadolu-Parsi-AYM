# Bronze RC2 Active Development — Build 148

- Current Application Version: `29.07.2026.148`
- Current Package Version: `29.7.2026-148`
- Current Build: **148**
- Current Stage: **Bronze RC2 Active Development**
- Final/Freeze/Silver/Gold: **Not entered**

## Tamamlanan ana geliştirme

Build 148 yalnız kalan kod açıkları ve Build 145–147 entegrasyon sınırlarının
sertleştirilmesini ele alır.

- Kritik IPC kanalları için argüman sayısı, izin verilen alanlar, tür ve uzunluk
  sınırları merkezi kanal politikasıyla doğrulanır.
- Ham ağ iptal listesi renderer IPC yüzeyinden kaldırılmıştır. Ağ alımı, TLS SPKI
  pin denetimi ve bekleyen içerik yalnız Electron ana sürecinde tutulur.
- Renderer yalnız bekleyen listenin özet kimliğini görür; güçlü doğrulama isteğinde
  liste gövdesi gönderemez.
- Bekleyen iptal listesi sağlayıcı profili, URL, sağlayıcı kimliği ve etkin pin
  durumunun SHA-256 parmak izine bağlanmıştır. Profil veya güven zinciri değişirse
  bekleyen içerik otomatik olarak geçersizleşir.
- Aile verisi içe aktarma ön izlemeleri kullanıcı ve aile oturumuna bağlanmıştır;
  farklı oturumda uygulanamaz ve çıkışta bellekten temizlenir.
- Soy ağacı, zaman tüneli ve arşiv imleçleri kullanıcı ile normalize filtrelerin
  SHA-256 kapsamına bağlanmıştır; başka filtre veya kullanıcıyla yeniden kullanılamaz.
- Main ve preload IPC kanal envanteri **179/179** eşleşmektedir.

## Gerçek hedefli kontroller

- Build 148 entegrasyon sertleştirme sözleşmesi: **PASS — 43/43**
- IPC kanal politikası runtime senaryoları: **PASS — 22/22**
- Güvenli iptal senkronizasyonu runtime senaryoları: **PASS — 17/17**
- Aile verisi içe aktarma runtime devamlılığı: **PASS — 25/25**
- Aile verisi içe aktarma SQLite runtime devamlılığı: **PASS — 11/11**
- Büyük veri sayfalama runtime devamlılığı: **PASS — 16/16**
- Büyük veri SQLite/query-plan devamlılığı: **PASS — 14/14**
- Renderer/preload/global/main/politika sözdizimi: **PASS — 5/5**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS — kontrollü dış tip kabuğu**
- Main/preload IPC kanal eşleşmesi: **PASS — 179/179**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace / Build 148**
- Kaynak bütünlüğü: **PASS — 1.230 kaynak dosyası / 1.231 SHA256SUMS girdisi**

Sürüm güncelleme aracının ilk çağrısı, Build 147 durum belgesindeki eski etiketlerle
aracın beklediği güncel etiketlerin uyuşmaması nedeniyle belge yazım aşamasında
durmuştur. Etiketler uyumlu hâle getirildikten sonra araç yeniden çalıştırılmıştır.
Bu olay uygulama runtime testi değildir ve PASS olarak sayılmamıştır.

## Çalıştırılmayan geniş kapılar

- Source preflight gate: **NOT_RUN**
- Clean install gate / temiz `npm ci`: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Render edilmiş ekran UAT: **NOT_RUN**
- Gerçek internet/TLS sağlayıcı testi: **NOT_RUN**
- Windows launch / installer lifecycle: **NOT_RUN**

Kaynak manifesti: **1.230 dosya**; `SHA256SUMS.txt`: **1.231 giriş**.
Deterministik ZIP, ZIP içerik doğrulaması ve dış SHA-256 teslim adımında gerçekten
çalıştırılacaktır.
