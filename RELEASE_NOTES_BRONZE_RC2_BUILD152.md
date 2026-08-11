# Bronze RC2 Build 152 Sürüm Notları

- Uygulama sürümü: `29.07.2026.152`
- Paket sürümü: `29.7.2026-152`
- Aşama: **Bronze RC2 Active Development**

## Tek ana geliştirme konusu

Bağlantılı makinede üretilen doğrulanmış npm cache aktarım paketinin çevrimdışı
çalışma ortamında fail-closed kabulü, atomik cache aktarımı, makbuz bütünlüğü ve
karantina yönetimi.

## Eklenenler

- `npm-cache:accept-bundle` komutu.
- ZIP ve dosya adına bağlı SHA-256 yan dosyası doğrulaması.
- Aktif lockfile ve paket sürümüyle tam transfer bundle doğrulaması.
- Atomik kabul alanı ve npm cache importu.
- Kabul/red makbuzları, makbuz SHA-256 dosyası ve güncel kabul işaretçisi.
- Bozuk paketler için ayrı karantina.
- Windows PowerShell ve Linux/macOS kabul yardımcıları.
- Türkçe çevrimdışı kabul kılavuzu.

## Hedefli doğrulama

- Build 152 cache bundle acceptance contract: **PASS — 26/26**
- Fixture gerçek çevrimdışı `npm ci`: **PASS**

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
