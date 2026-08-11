# Sürüm Notları — Bronze RC2 Build 176

## Yeni

- Uygulama oturumları hesap `security_epoch` değerine bağlandı.
- Eski güvenlik dönemine ait oturumlar korunan işlemlerden önce iptal ediliyor.
- Bakım kurtarması sonrası cihaz için özel yeniden yetkilendirme use-case'i eklendi.
- Yeniden yetkilendirme; güncel oturum dönemi, parola, etkinse TOTP/kurtarma kodu, cihaz özel anahtar kanıtı ve `GÜVENLİ CİHAZI YENİDEN YETKİLENDİR` onayını birlikte gerektiriyor.
- Başarılı işlem için Ed25519 imzalı güvenlik olayı makbuzu oluşturuluyor.
- Makbuz; ham hesap kimliği yerine ad alanlı SHA-256 hesap parmak izi, cihaz kanıtı, güvenlik dönemi, denetim kimliği ve zaman içeriyor.
- Renderer'da güvenlik dönemi farkı, yeniden yetkilendirme gereksinimi ve imzalı makbuz görüntülenebiliyor/kopyalanabiliyor.

## Düzeltme

- Güvenilir cihaz repository INSERT sorgusundaki sütun/yer tutucu sayısı düzeltildi. Build 175'te `security_epoch` değerinin yanlış sütuna kayma ihtimali kapatıldı.

## Korunan davranışlar

- Build 175 güvenlik dönemi ilerletme ve eski cihaz iptali korunur.
- Build 174 zorunlu oturum sonlandırma ve 15 dakikalık kalıcı soğuma süresi korunur.
- Build 173 güçlü doğrulama, açık onay ve ayrı kurtarma deneme sayacı korunur.
- Parola, TOTP, kurtarma kodu, oturum belirteci ve cihaz özel anahtarı makbuza, loga veya telemetriye yazılmaz.
- Aile verileri, arşiv ve adaptif bütçe değiştirilmez.
