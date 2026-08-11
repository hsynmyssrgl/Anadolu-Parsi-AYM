# Bronze MVP-5 — 21.07.2026.5

## Eklenenler
- Beş başarısız girişten sonra 15 dakikalık hesap kilidi.
- Başarısız giriş ve hesap kilidi denetim kayıtları.
- RFC 6238 uyumlu 6 haneli TOTP doğrulama.
- Microsoft Authenticator ve Google Authenticator ile kullanılabilen `otpauth://` kurulum URI'si.
- Sekiz adet tek kullanımlık kurtarma kodu; kodlar veritabanında yalnızca SHA-256 özetiyle tutulur.
- TOTP etkinleştirme ve kapatma işlemleri.
- Giriş ekranında doğrulama/kurtarma kodu desteği.
- Ayarlar ekranında iki aşamalı doğrulama kurulumu.
- Güvenlik davranışıyla uyumlu güncellenmiş veri deposu testleri.

## Doğrulama
- TypeScript: başarılı.
- Otomatik test: 11/11 başarılı.
- Electron ana süreç derlemesi: başarılı.
- React/Vite üretim derlemesi: başarılı.

## Sonraki güvenlik adımı
- `.pptbackup` tam yedek geri yükleme ve geri yükleme öncesi otomatik güvenlik kopyası.
