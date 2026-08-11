# Bronze RC2 Build 135 Sürüm Notları

- Application Version: `28.07.2026.135`
- Package Version: `28.7.2026-135`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Dijital arşiv kasa anahtarı için OS korumalı sürüm 2 zarfı.
- Electron `safeStorage`/Windows DPAPI sağlayıcı kimliği ve SHA-256 bütünlük doğrulaması.
- Legacy açık 32 bayt anahtar için atomik migration ve geri alma kopyası.
- Yarım migration işleminde sonraki açılış kurtarması.
- Koruma kullanılamaması, sağlayıcı uyuşmazlığı ve zarf bozulmasında fail-closed davranış.
- Arşiv okuma/yazma adaptörünün korumalı anahtar sağlayıcısına bağlanması.
- Tam yedek oluştururken ham anahtarın yalnız AES-256-GCM şifreli payload içinde kullanılması.
- Geri yükleme staging aşamasında anahtarın hedef cihaz OS korumasıyla yeniden sarılması.
- Kasa anahtarı dosya yolu ve sağlayıcı yolu uyuşmazlığının reddedilmesi.

## Aşama notu

Bu artırım kaynak düzeyi kasa anahtarı güvenliğini geliştirir. Gerçek Windows
DPAPI migration, farklı cihazda restore, production build ve installer kanıtları
ayrıca çalıştırılmadan PASS sayılmaz.

## Kaynak doğrulaması

- Build 135 sözleşmesi: **PASS — 52/52**
- Kasa anahtarı migration/portable rewrap runtime: **PASS — 21/21**
- Kaynak preflight: **PASS — 25/25**
- Kaynak bütünlüğü: **PASS — 1.097 kaynak / 1.098 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.099 giriş / byte-identical**
- Ağır derleme, tam test ve Windows/installer kapıları: **NOT_RUN**
