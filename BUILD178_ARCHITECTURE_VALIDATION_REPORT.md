# Build 178 Mimari Doğrulama Raporu

## Karar

Build 178, Build 176'da oluşturulan ve Build 177'de menüye bağlanan Ed25519 güvenlik makbuzlarını kalıcı, hesap filtreli ve yeniden doğrulanabilir bir ana süreç arşivine taşır.

Akış:

`Güvenlik Merkezi → preload IPC → main/DataStore → SecurityEventReceiptStore → şema + SHA-256 + Ed25519 doğrulaması`

## Güvenlik sınırı

- Arşiv renderer dosya sisteminden erişilemeyen ana süreç veri dizinindedir.
- Ham hesap kimliği saklanmaz; hesap parmak izi kullanılır.
- Atomik `0600` yazım, 2 MiB dosya ve 256 kayıt sınırı vardır.
- Bozuk arşiv fail-closed boş geçmişe çevrilir.
- Haricî JSON doğrulaması ana süreçte yapılır.
- Parola, TOTP, kurtarma kodu veya oturum belirteci arşivlenmez.

## Hedefli kanıt

- Build 178 contract: **37/37 PASS**
- Build 178 runtime: **19/19 PASS**
- Build 178 syntax/controlled TypeScript: **11/11 PASS**
- Build 177 continuity: **31/31 + 13/13 + 10/10 PASS**

## Sınırlama

Yerel imzalı makbuz geçmişi merkezi şeffaflık servisi veya bağımsız zaman damgası değildir. Production Electron ve gerçek Windows kullanıcı akışı ayrı kapılardır.
