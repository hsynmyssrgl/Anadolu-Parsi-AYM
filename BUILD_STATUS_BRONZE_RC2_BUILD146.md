# Bronze RC2 Active Development — Build 146

- Current Application Version: `28.07.2026.146`
- Current Package Version: `28.7.2026-146`
- Current Build: **146**
- Current Stage: **Bronze RC2 Active Development**
- Final/Freeze/Silver/Gold: **Not entered**

## Tamamlanan ana geliştirme

Build 146 yalnız gerçek aile verisi içe aktarma konusunu ele alır. Main process
tarafından seçilen katı UTF-8 JSON kaynakları şema, kayıt sınırı, referans,
SHA-256 ve çakışma planı açısından doğrulanır. Ön izleme 15 dakika geçerlidir;
renderer dosya yolu veya içerik gönderemez.

Uygulama yalnız aile yöneticisinin güçlü yeniden doğrulamasından sonra tek atomik
veritabanı işlemi içinde yapılır. Aynı dışa aktarma paketinin yeniden uygulanması
engellenir. Oluşturulan ve yeniden kullanılan kayıtların kaynak kimliği izlenir;
24 saatlik geri alma yalnız sonradan bağımlılık oluşmamış oluşturulan kayıtları
siler.

## Gerçek hedefli kontroller

- Build 146 aile verisi içe aktarma sözleşmesi: **PASS — 34/34**
- Build 146 bellek içi runtime senaryoları: **PASS — 23/23**
- Build 146 SQLite repository runtime senaryoları: **PASS — 11/11**
- Renderer/preload/global sözdizimi: **PASS — 3/3**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS — kontrollü dış tip kabuğu**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**

## Çalıştırılamayan hedefli kontrol

- Renderer workspace TypeScript: **BLOCKED** — temiz `npm ci` çalıştırılmadığı için
  yerel `vite/client` tip paketi bulunamadı. Bu kapı PASS olarak raporlanmamıştır.

## Çalıştırılmayan geniş kapılar

- Source preflight gate: **NOT_RUN**
- Source integrity: **NOT_RUN**
- Clean install gate: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Render edilmiş ekran UAT: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

Kaynak ZIP ve SHA-256 teslimi Build 146 paketleme adımında oluşturulur.
