# Sürüm Notları — Bronze RC2 Build 175

## Yeni

- Hesap ve güvenilir cihaz kayıtlarına güvenlik dönemi eklendi.
- Veritabanı migration 27 ile `accounts.security_epoch` ve `trusted_devices.security_epoch` alanları oluşturuldu.
- Bakım kurtarması sonrasında güvenlik dönemini transaction içinde ilerleten uygulama use-case'i eklendi.
- Aynı transaction içinde tüm aktif güvenilir cihazlar iptal ediliyor ve denetim kaydı yazılıyor.
- Giriş ve auth-state değerlendirmesi, eski döneme ait cihazı güvenilir kabul etmiyor.
- Cihaz yeniden yetkilendirildiğinde güncel hesap güvenlik dönemi cihaza bağlanıyor.
- Kurtarma sonucu yeni dönem ve iptal edilen güvenilir cihaz sayısını gösteriyor.

## Korunan davranışlar

- Build 174 zorunlu oturum sonlandırma ve 15 dakikalık kalıcı soğuma süresi korunur.
- Build 173 güçlü doğrulama, açık onay ve ayrı kurtarma deneme sayacı korunur.
- Parola, TOTP, kurtarma kodu ve oturum belirteçleri log, telemetri veya tanı paketine yazılmaz.
- Aile verileri, arşiv ve adaptif bütçe değiştirilmez.
