# Build 150 Mimari Doğrulama Raporu

## Kapsam

Build 150, uygulama işlevi eklemek yerine bağımlılık bootstrap mimarisini
tekrarlanabilir, taşınabilir ve fail-closed hâle getirir.

## Mimari kararlar

### 1. Cache paketi aktif kilit dosyasına bağlıdır

Cache aktarım ZIP'i yalnız aynı `package-lock.json` SHA-256 değeri ve aynı paket
sürümü için kabul edilir. Başka bir kaynak ağacına ait paket sessizce kullanılamaz.

### 2. Tam cache varsa ağ kullanılmaz

İçe aktarılan cache tekrar doğrulandıktan sonra kurulum `--offline` ile yapılır.
Çevrimiçi fallback yalnız cache paketi verilmemiş ve yerel cache eksikse mümkündür.
Verilmiş fakat geçersiz cache paketinde fallback yasaktır.

### 3. Kurulum betikleri kapalıdır

Temiz bağımlılık kapısı `--ignore-scripts` kullanır. Native/binary hazırlama veya
Windows installer üretimi ayrı ve açık doğrulama adımlarında yapılır.

### 4. Windows paketleme grafiği ayrıdır

`electron-builder`, `app-builder-lib`, `yargs` ve `yargs-parser` kök lockfile'dan
çıkarılmıştır. Paketleme toolchain'i `tools/windows-packager` altında ayrı kurulur.
Bu ayrım Linux/macOS kaynak doğrulamalarında Windows installer zincirinin gereksiz
paket ve kurulum betiklerini taşımayı engeller.

## Uçtan uca fixture sonucu

- Yerel fixture npm paketi üretildi.
- SHA-512 doğrulanmış npm cache kaydı oluşturuldu.
- Deterministik cache aktarım paketi üretildi.
- Paket yeni ve boş cache'e aktarıldı.
- `npm ci --offline --ignore-scripts` gerçekten çalıştı.
- Paket `node_modules` altına kuruldu.
- Değiştirilmiş lockfile aynı cache paketiyle denendi ve reddedildi.
- Sonuç: **PASS — 19/19**.

## Sınırlama

Gerçek proje için gerekli 117 tarball bu çalışma ortamında mevcut değildir ve
resmî npm DNS/paket hizmetine erişilememiştir. Mimari yol fixture üzerinde PASS
olsa da gerçek proje temiz kurulumu FAIL olarak korunur.
