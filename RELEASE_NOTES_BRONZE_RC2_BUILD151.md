# Bronze RC2 Build 151 Sürüm Notları

## Eklenenler

- Kilit dosyasına bağlı npm bağımlılık edinme planı.
- Bütünlük adresli ve sürdürülebilir tarball staging alanı.
- Resmî npm kaynağından retry/backoff ile bundle üretimi.
- PowerShell ve Bash bağlantılı makine yardımcıları.
- Türkçe edinme ve çevrimdışı kurulum yönergesi.

## Güvenlik

- Yalnız resmî npm HTTPS origin'i kabul edilir.
- Başka origin'e yönlendirme reddedilir.
- Her tarball kilit dosyasındaki SHA-512 ile doğrulanır.
- Plan package-lock SHA-256 ve paket sürümüne bağlıdır.
- Bozuk, sembolik bağlantı veya yarım dosya geçerli sayılmaz.
- Çıktı deterministik ZIP olarak tekrar doğrulanır.

## Doğrulama

Hedefli edinme fixture'ı **35/35 PASS** vermiştir. Gerçek proje temiz kurulumu ve
bağımlılığa bağlı geniş kapılar, çalışma ortamının DNS erişimi olmadığı için FAIL
olarak korunmuştur.
