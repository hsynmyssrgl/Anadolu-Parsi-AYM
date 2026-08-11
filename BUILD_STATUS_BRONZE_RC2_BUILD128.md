# Bronze RC2 Build 128 Durum Kaydı

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.128`
- Package Version: `27.7.2026-128`
- Stage: **Bronze RC2 Active Development**
- Next: **Build 129 Active Development**

## Tamamlanan geliştirme

- Ed25519 cihaz kimliği özel anahtarı için işletim sistemi korumalı sır portu eklendi.
- Electron `safeStorage` adaptörü oluşturuldu; Windows/paketli uygulamada koruma zorunlu kılındı.
- Güvensiz Linux `basic_text` arka ucu güvenli koruma olarak kabul edilmedi.
- Cihaz kimliği sürüm 2 şifreli zarf biçimine taşındı.
- Eski açık JSON cihaz kimliği atomik migration ile şifreli zarfa dönüştürülür.
- Yarım kalan migration için geri alma dosyası ve açılış kurtarma yolu eklendi.
- Şifreli kayıt yüklenirken özel/açık anahtar eşleşmesi imzalı challenge ile doğrulanır.
- Koruma zorunlu olduğu hâlde kullanılamıyorsa açık depolamaya düşmek yerine fail-closed hata üretilir.
- DEC-042, ADR-013, güvenlik standardı ve gereksinim izlenebilirliği güncellendi.

## Gerçek doğrulama durumu

- Build 128 cihaz kimliği koruma sözleşmesi: **PASS — 49 assertion**.
- SafeStorage adaptörü hedefli çalışma zamanı testi: **PASS — 7 assertion**.
- Kontrollü Electron-main kaynak TypeScript doğrulaması: **PASS**.
- Sürüm sıra sözleşmesi: **PASS — 27.07.2026.128**.
- Kaynak preflight zinciri: **PASS — 14/14 kontrol**.
- Aktif teslim belge sözleşmesi: **PASS — 121 assertion / 5 belge**.
- Kaynak bütünlüğü: **PASS — 1040 kaynak / 1041 SHA-256 girdisi**.
- Deterministik arşiv yeniden üretimi: **PASS — 1042 giriş / byte-identical**.
- Kaynak ZIP içerik ve metadata doğrulaması: **PASS — 1042 giriş**.

Temiz `npm ci`, tam root TypeScript, tüm testler, production build, gerçek Windows
DPAPI açılışı ve installer bu artırımda çalıştırılmadıkça `NOT_RUN` kalacaktır.

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
