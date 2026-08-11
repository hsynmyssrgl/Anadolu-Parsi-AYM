# Bronze RC2 Build 142 Sürüm Notları

- Application Version: `28.07.2026.142`
- Package Version: `28.7.2026-142`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Ed25519 imzalı kanonik sağlayıcı iptal listesi.
- Benzersiz liste kimliği ve monoton sıra numarasıyla rollback/replay koruması.
- `thisUpdate` / `nextUpdate` tazelik penceresi ve 31 günlük üst sınır.
- Aynı kök güven zinciri, kendini iptal ve geçersiz imza kontrolleri.
- Liste, girdiler, kaynak URL metadata'sı ve payload SHA-256 çevrimdışı önbelleği.
- Sağlayıcı, imha kanıtı ve envanter güven durumunun atomik iptal yayılımı.
- Güvenlik ekranında imzalı liste uygulama ve geçmiş görünümü.

## Sınır

Gerçek HTTPS endpoint'inden otomatik liste indirme, TLS pinning, sağlayıcı API'si,
Windows paketli çalışma ve installer bu buildde uygulanmadı veya çalıştırılmadı.

## Hedefli kaynak doğrulaması

- Sözleşme: **PASS — 80/80**
- Runtime: **PASS — 28/28**
- Renderer/bridge: **PASS — 3/3**
- Kaynak preflight: **PASS — 45/45**
- Kaynak bütünlüğü: **PASS — 1.175/1.175; 1.176 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.177 giriş / byte-identical**
- Kaynak ZIP içerik doğrulaması: **PASS — 1.177 giriş**
- Ağır derleme, tam test, gerçek sağlayıcı ve Windows/installer kapıları: **NOT_RUN**
