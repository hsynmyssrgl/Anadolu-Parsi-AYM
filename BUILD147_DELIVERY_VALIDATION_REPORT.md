# Build 147 Teslim Doğrulama Raporu

- Ürün: **Anadolu Parsı Aile Yaşam Merkezi**
- Aşama: **Bronze RC2 Active Development**
- Application Version: `29.07.2026.147`
- Package Version: `29.7.2026-147`
- Ana konu: **Büyük soy ağacı, zaman tüneli ve arşiv performansı**

## Hedefli doğrulamalar

- Büyük veri performans sözleşmesi: **PASS — 42/42**
- Servis runtime: **PASS — 15/15**
- SQLite runtime/query-plan: **PASS — 14/14**
- Renderer/preload/global/main sözdizimi: **PASS — 4/4**
- Kontrollü package-source TypeScript: **PASS**
- Kontrollü desktop-main TypeScript: **PASS**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace / Build 147**

## Kaynak teslimi

- `manifest.json`: **1.221 kaynak dosyası**
- `SHA256SUMS.txt`: **1.222 giriş**

Deterministik ZIP giriş sayısı, yol emniyeti, CRC, manifest eşleşmesi ve dış ZIP
SHA-256 değeri teslim paketleme adımında gerçekten çalıştırılacaktır.

## Çalıştırılmayan geniş kapılar

Temiz `npm ci`, tam root `tsc --noEmit`, bütün birim/entegrasyon testleri,
Electron production build, blocking smoke, render edilmiş UAT ve Windows installer
yaşam döngüsü bu ara derlemede çalıştırılmamıştır.
