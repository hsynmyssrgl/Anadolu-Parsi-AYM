# Build 175 Mimari Doğrulama Raporu

## Karar

Build 175, bakım kilidi kurtarmasını hesap kimliği ve güvenilir cihaz altyapısına bağlayan kalıcı bir güvenlik dönemi uygular. Katman yönü korunur:

`Electron main → DataStore application façade → application use-case → repository contracts → SQLite repositories`

Renderer doğrudan veritabanına erişmez ve yalnız sonuç görünümündeki gizlilik açısından güvenli dönem/sayaç alanlarını alır.

## Güvenlik özellikleri

- Dönem artışı ve güvenilir cihaz iptali aynı repository transaction'ındadır.
- Dönem, güvenilir cihaz bypass'ını önleyen ek bir eşleşme şartıdır.
- Dönem tamsayı ve üst sınır doğrulaması fail-closed çalışır.
- Legacy kayıtlar migration varsayılanı `0` ile geriye uyumludur.
- Başarılı kurtarma sonrasında açık bakım oturumları temizlenir ve kullanıcı oturumu kapatılır.

## Kanıt

- Build 175 contract: **PASS**
- Build 175 runtime: **PASS**
- Build 175 syntax: **PASS**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**

## Sınırlama

Kontrollü TypeScript kapıları gerçek source uyumunu denetler; temiz lockfile-pinned `npm ci`, production Electron runtime ve Windows installer uyumluluğunun yerine geçmez.
