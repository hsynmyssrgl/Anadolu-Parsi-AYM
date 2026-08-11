# Build 146 Mimari Doğrulama Raporu

## Kapsam

- Main process tarafından sahiplenilen JSON dosya seçimi
- 25 MiB boyut sınırı, normal dosya ve `.json` uzantısı denetimi
- Katı UTF-8, NUL reddi, şema sürümü ve bilinmeyen alan doğrulaması
- Kayıt sınırları, yinelenen kimlikler, referanslar, tarihler ve koordinatlar
- Salt okunur, 15 dakika geçerli içe aktarma ön izlemesi
- Ön izleme ile uygulama arasında dosya stat/SHA-256 ve veri tabanı planı yeniden doğrulaması
- Ön izleme ve uygulama arasında sabit hedef kimlikleri
- Aile yöneticisi rolü ve güçlü yeniden doğrulama
- Tek transaction içinde atomik uygulama ve audit kaydı
- Etkin SHA-256 veya `exportId` paketlerinin yeniden uygulanmasının engellenmesi
- 24 saatlik kontrollü geri alma ve sonradan oluşan bağımlılıklarda fail-closed engelleme

## Güvenlik sonucu

Renderer dosya yolu veya dosya içeriği sağlayamaz; yalnız main process dosya seçim
iletişim kutusunu başlatabilir. Ön izlemede doğrulanan içerik doğrudan kalıcı veri
değiştirme yetkisi kazanmaz. Uygulama anında dosya bütünlüğü ve güncel veri tabanı
çakışma planı tekrar hesaplanır. Herhangi bir farkta işlem uygulanmadan reddedilir.

Geri alma yalnız ilgili batch tarafından oluşturulan kayıtları hedefler. Yeniden
kullanılan mevcut kayıtlar silinmez. Sonradan gerçek kullanıcı verisiyle ilişki,
katılım veya değişiklik oluşmuşsa geri alma engellenir.

## Çalıştırılan kontroller

- `verify:build146:family-data-import`: **PASS — 34/34**
- `verify:build146:family-data-import-runtime`: **PASS — 23/23**
- `verify:build146:family-data-import-sql-runtime`: **PASS — 11/11**
- `verify:build146:renderer-bridge-syntax`: **PASS — 3/3**
- `typecheck:package-source`: **PASS — TypeScript 5.8.3**
- `typecheck:desktop-main-source`: **PASS — kontrollü dış tip kabuğu**
- `verify:version`: **PASS — 178 assertion / 14 workspace**

SQLite runtime kontrolü Node 22 deneysel `node:sqlite` API’si ve bellek içi veri
tabanı kullanır. Üretim `better-sqlite3` adaptörü, disk kilitleme davranışı ve
Windows paketli runtime bu kontrolle kanıtlanmaz.

Renderer workspace TypeScript denemesi, temiz `npm ci` çalıştırılmadığından yerel
`vite/client` tip paketi bulunamadığı için BLOCKED kalmıştır ve PASS sayılmamıştır.
Bu kontroller tam workspace type-check, tüm test paketi, Electron production build,
render edilmiş UAT, smoke veya Windows installer doğrulaması değildir.
