# Sürüm Notları — Bronze RC2 Build 178

## Yeni

- Kurtarma sonrası cihaz yeniden yetkilendirme makbuzları kalıcı yerel geçmişte saklanır.
- Güvenlik Merkezi son 20 makbuzu hesap bazında listeler.
- Her geçmiş kaydı açılışta SHA-256 ve Ed25519 ile yeniden doğrulanır.
- Kullanıcı haricî bir makbuz JSON'unu yapıştırarak ana süreçte doğrulayabilir.
- Geçerli, imzası bozuk ve şeması bozuk makbuzlar ayrı durumlarla gösterilir.
- Eski güvenlik dönemine ait oturum için Güvenlik Merkezi içinde açık uyarı gösterilir.

## Güvenlik ve dayanıklılık

- Makbuz arşivi `0600`, geçici `wx` dosya, `fsync` ve atomik yeniden adlandırmayla yazılır.
- Dosya 2 MiB, geçmiş 256 kayıtla sınırlandırılır.
- Ham hesap kimliği yerine SHA-256 hesap parmak izi kullanılır.
- Bozuk arşiv uygulamayı durdurmaz; boş geçmiş olarak izole edilir ve yeni geçerli kayıtla yeniden oluşturulur.
- Parola, TOTP sırrı, kurtarma kodu ve oturum belirteci arşive yazılmaz.

## Menü bağlantısı

Bu işlevler sol menüdeki **Güvenlik Merkezi** ekranında, “Güvenlik makbuzları” bölümünden kullanılır.
