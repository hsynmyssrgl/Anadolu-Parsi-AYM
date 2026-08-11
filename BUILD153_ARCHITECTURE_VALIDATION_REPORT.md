# Build 153 Mimari Doğrulama Raporu

## Kapsam

Build 153'ün tek ana konusu, Build 152 tarafından kabul edilmiş npm cache aktarım
paketinin tam RC2 doğrulama kapılarına güvenli biçimde bağlanmasıdır. Uygulama
özellikleri veya kullanıcı verisi kapsamı değiştirilmemiştir.

## Mimari kararlar

### 1. Kabul makbuzu tek başına yeterli değildir

`current-accepted.json`, makbuz, makbuz checksum'ı, kabul edilmiş ZIP, ZIP
checksum'ı, aktif `package-lock.json` ve paket sürümü birlikte doğrulanır.

### 2. Payload ve cache yeniden doğrulanır

ZIP içindeki bütün tarballar lockfile SHA-512 değerleriyle yeniden denetlenir.
İçe aktarılmış npm cache tam değilse gate runner başlatılmaz.

### 3. Gate runner yalnız doğrulanmış yolları alır

Kabul edilmiş ZIP ve makbuz yolları yalnız `PPT_NPM_CACHE_BUNDLE` ve
`PPT_NPM_CACHE_ACCEPTANCE_RECEIPT` ortam değişkenleriyle alt sürece aktarılır.
Runner, gate config ve politika dosyaları proje kökü dışına çıkamaz ve sembolik
bağlantı olamaz.

### 4. Platform ve release tamamlanması ayrıdır

Geçerli platformdaki bütün uygun kapılar PASS olsa bile Windows'a özgü kapılar
çalışmadıysa release readiness `INCOMPLETE` kalır.

### 5. Fail-closed sınır

Pointer, makbuz, ZIP veya cache kurcalaması fixture senaryolarında gate runner
başlamadan reddedilir. Downstream kapı hatası orkestratör sonucuna FAIL olarak
taşınır.

## Hedefli fixture sonucu

İki yerel npm paketiyle kabul, tam bundle/cache doğrulaması, platform PASS, tam
sekiz kapı PASS, downstream FAIL, pointer kurcalama ve ZIP kurcalama senaryoları
birlikte **PASS — 20/20** verdi.
