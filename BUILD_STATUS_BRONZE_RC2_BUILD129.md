# Bronze RC2 Build 129 Durum Kaydı

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.129`
- Package Version: `27.7.2026-129`
- Stage: **Bronze RC2 Active Development**
- Next: **Build 130 Active Development**

## Tamamlanan geliştirme

- Aktif ve bekleyen TOTP MFA sırları için sürüm 1 korumalı zarf eklendi.
- Yeni TOTP sırları Electron `safeStorage` üzerinden işletim sistemi korumasıyla saklanır.
- Windows ve paketli uygulamada koruma zorunludur; koruma yoksa işlem fail-closed reddedilir.
- Legacy açık Base32 TOTP kayıtları hesap okuma transaction'ı içinde atomik olarak dönüştürülür.
- Migration beklenen eski değer koşulu kullanır; eşzamanlı değişiklikte güvenli biçimde reddedilir.
- Farklı sağlayıcıya ait, bozuk veya çözülemeyen zarf kabul edilmez.
- Kurtarma kodlarının yalnız hash olarak saklanması ve atomik tüketimi korunur.
- DEC-043, ADR-014, güvenlik standardı, açık maddeler ve izlenebilirlik matrisi güncellendi.

## Gerçek doğrulama durumu

- Build 129 MFA sırrı koruma sözleşmesi: **PASS — 58 assertion**.
- MFA sırrı zarfı çalışma zamanı testi: **PASS — 11 assertion**.
- Legacy SQLite TOTP migration testi: **PASS — 11 assertion**.
- MFA/güvenilir cihaz entegrasyon paketi: **PASS — 16 kontrol**.
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**.
- Kontrollü Electron-main kaynak TypeScript: **PASS**.
- Lockfile bütünlüğü: **PASS — 973 assertion / 14 workspace**.
- Bağımlılık tedarik sözleşmesi: **PASS — 1.147 assertion / 371 tarball**.
- Workspace bağımlılık sözleşmesi: **PASS — 360 assertion / 14 workspace**.
- Kaynak preflight: **PASS — 14/14 kontrol**.
- Aktif teslim belge sözleşmesi: **PASS — 121 assertion / 5 belge**.
- Kaynak bütünlüğü: **PASS — 1049 kaynak / 1050 SHA-256 girdisi**.
- Deterministik kaynak arşivi: **PASS — 1051 giriş / byte-identical**.

Temiz `npm ci`, tam root `tsc --noEmit`, tüm test paketi, Electron production
build, gerçek Windows DPAPI açılış/migration ve installer bu artırımda yeniden
çalıştırılmadıkça `NOT_RUN` kalır.

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
