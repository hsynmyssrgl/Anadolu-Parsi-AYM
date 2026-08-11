# Build 177 Mimari Doğrulama Raporu

## Karar

Build 177, Build 176'da gerçek IPC hattına bağlanan güvenlik özelliklerini kullanıcı tarafından bulunabilir ayrı bir menü hedefine taşır:

`Sol menü / Profil menüsü / Komut paleti → security route → SettingsSecurity → window.pardus → preload allowlist → main IPC → DataStore / use-case`

Sistem ve Bakım ekranı güvenlik bileşenini artık iç içe çalıştırmaz.

## Renderer güvenlik özellikleri

- Ayrı `security` route ve **Güvenlik Merkezi** etiketi
- Güvenlik dönemi uyuşmazlığında dikkat işareti
- Parola + 2FA kodu + tam onay olmadan yeniden yetkilendirme IPC çağrısını engelleyen hazır olma kapısı
- Erişilebilirlik durumunun açık prop sınırı
- Profil menüsü ve komut paleti üzerinden doğrudan erişim
- Build 176 main/preload/IPC hattının korunması

## Hedefli kanıt

- Build 177 menu contract: **31/31 PASS**
- Build 177 menu runtime: **13/13 PASS**
- Build 177 renderer syntax/controlled TypeScript: **10/10 PASS**
- Build 176 continuity: **52/52 + 23/23 + 14/14 PASS**

## Sınırlama

Kaynak, saf runtime ve kontrollü TypeScript kanıtları production Electron/React derlemesi ile gerçek Windows görsel kullanıcı akışının yerine geçmez.
