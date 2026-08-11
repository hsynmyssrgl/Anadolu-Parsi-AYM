# Build 146 Teslim Doğrulama Raporu

- Ürün: **Anadolu Parsı Aile Yaşam Merkezi**
- Aşama: **Bronze RC2 Active Development**
- Application Version: `28.07.2026.146`
- Package Version: `28.7.2026-146`
- Ana konu: **Gerçek aile verisi içe aktarma, doğrulama, ön izleme ve rollback**

## Kaynak envanteri

- `manifest.json`: **1.208 kaynak dosyası**
- `SHA256SUMS.txt`: **1.209 giriş**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**

Kaynak ZIP yalnız manifestle uyumlu son çalışma ağacından üretilecektir. Arşiv yol
güvenliği, CRC, manifest envanter eşleşmesi ve dış SHA-256 değeri paketleme
sırasında doğrulanacaktır.

## Çalıştırılmayan geniş kapılar

Temiz `npm ci`, tam root `tsc --noEmit`, tüm testler, Electron production build,
blocking smoke, render edilmiş UAT ve Windows installer yaşam döngüsü bu ara
derlemede çalıştırılmamıştır.
