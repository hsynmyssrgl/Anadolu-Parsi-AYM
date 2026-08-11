# Bronze RC2 Active Development — Build 147

- Current Application Version: `29.07.2026.147`
- Current Package Version: `29.7.2026-147`
- Current Build: **147**
- Current Stage: **Bronze RC2 Active Development**
- Final/Freeze/Silver/Gold: **Not entered**

## Tamamlanan ana geliştirme

Build 147 yalnız büyük soy ağacı, zaman tüneli ve arşiv performansını ele alır.
Üç görünüm için ayrı izin duyarlı okuma modeli, anahtar tabanlı sayfalama, 20–200
kayıt sınırı, ölçüm bilgisi ve SQLite indeksleri eklenmiştir. Renderer başlangıçta
tam arşiv listesini istemez ve yalnız yüklenen sayfaları çizer.

Soy ağacı `(nesil, ad, kimlik)`, zaman tüneli `(başlangıç zamanı, kimlik)`, arşiv
`(oluşturma zamanı, kimlik)` sıralamasıyla ilerler. İmleçler görünüm türü ve sürümü
ile doğrulanır; arama ve filtre girdileri sınırlıdır. Olay ve arşiv kayıtları
repository dönüşünden sonra nesne izinlerinden geçirilmeden renderer’a verilmez.

## Gerçek hedefli kontroller

- Build 147 büyük veri performans sözleşmesi: **PASS — 42/42**
- Build 147 servis runtime senaryoları: **PASS — 15/15**
- Build 147 SQLite performans/runtime senaryoları: **PASS — 14/14**
- Renderer/preload/global/main sözdizimi: **PASS — 4/4**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS — kontrollü dış tip kabuğu**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace / Build 147**

SQL runtime kontrolünün ilk denemesi, yeni test düzeneğinde `events` tablosu için
20 placeholder yazılması nedeniyle başlamadan FAIL verdi. Test şeması 19 sütunla
eşleştirildikten sonra kontrol yeniden çalıştırıldı ve **PASS — 14/14** oldu. Bu
ilk hata uygulama repository kodundan değil hedefli test düzeneğinden kaynaklandı.

## Bağımlılık kurulumu nedeniyle çalıştırılamayan etkilenen-alan kontrolleri

- Mevcut soy ağacı doğrulaması: **BLOCKED** — `@types/node` bulunamadı.
- Mevcut zaman tüneli doğrulaması: **BLOCKED** — `@types/node` bulunamadı.
- Mevcut arşiv doğrulaması: **BLOCKED** — `@types/node` bulunamadı.

Temiz `npm ci` bu ara derlemede çalıştırılmadığından bu üç kontrol PASS sayılmamıştır.

## Çalıştırılmayan geniş kapılar

- Source preflight gate: **NOT_RUN**
- Clean install gate / temiz `npm ci`: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Render edilmiş ekran UAT: **NOT_RUN**
- Windows launch / installer lifecycle: **NOT_RUN**

Kaynak manifesti: **1.221 dosya**; `SHA256SUMS.txt`: **1.222 giriş**.
Deterministik ZIP, ZIP içerik doğrulaması ve dış SHA-256 teslim adımında
gerçekten çalıştırılacaktır.
