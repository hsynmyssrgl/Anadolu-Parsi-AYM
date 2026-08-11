# Build 148 Teslim Doğrulama Raporu

- Ürün: **Anadolu Parsı Aile Yaşam Merkezi**
- Aşama: **Bronze RC2 Active Development**
- Application Version: `29.07.2026.148`
- Package Version: `29.7.2026-148`
- Ana konu: **Kalan kod açıkları ve entegrasyon sertleştirmesi**

## Hedefli doğrulamalar

- Entegrasyon sertleştirme sözleşmesi: **PASS — 43/43**
- IPC politika runtime: **PASS — 22/22**
- İptal senkronizasyon runtime: **PASS — 17/17**
- Aile içe aktarma runtime: **PASS — 25/25**
- Aile içe aktarma SQLite runtime: **PASS — 11/11**
- Büyük veri runtime: **PASS — 16/16**
- Büyük veri SQLite/query-plan runtime: **PASS — 14/14**
- Renderer/preload/global/main/politika sözdizimi: **PASS — 5/5**
- Kontrollü package-source TypeScript: **PASS**
- Kontrollü desktop-main TypeScript: **PASS**
- Main/preload IPC kanal eşleşmesi: **PASS — 179/179**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace / Build 148**
- Kaynak bütünlüğü: **PASS — 1.230 kaynak dosyası / 1.231 SHA256SUMS girdisi**

## Kaynak teslimi

- `manifest.json`: **1.230 kaynak dosyası**
- `SHA256SUMS.txt`: **1.231 giriş**

Deterministik ZIP giriş sayısı, yol emniyeti, CRC, manifest eşleşmesi ve dış ZIP
SHA-256 değeri paketleme adımında gerçekten çalıştırılacak ve bu rapor gerçekleşen
sonuçlarla güncellenecektir.

## Çalıştırılmayan geniş kapılar

Temiz `npm ci`, tam root `tsc --noEmit`, bütün birim/entegrasyon testleri,
Electron production build, blocking smoke, gerçek internet/TLS testi, render
edilmiş UAT ve Windows installer yaşam döngüsü bu ara derlemede çalıştırılmamıştır.
