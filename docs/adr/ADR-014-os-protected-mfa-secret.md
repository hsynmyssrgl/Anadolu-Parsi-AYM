# ADR-014 — İşletim Sistemi Korumalı MFA Sırrı

- Durum: Kabul edildi
- Tarih: 27.07.2026
- Build: 129

## Bağlam

TOTP doğrulaması için kullanılan paylaşılan sır, önceki sürümlerde `accounts`
tablosunun `totp_secret` ve `pending_totp_secret` alanlarında açık Base32 metin
olarak tutuluyordu. Veritabanı dosyasına erişen bir saldırgan bu sırla geçerli
ikinci faktör kodları üretebilirdi.

## Karar

Yeni ve bekleyen TOTP sırları Electron `safeStorage` aracılığıyla işletim sistemi
korumasına alınmış sürüm 1 zarfı olarak saklanır. Windows ve paketli uygulamada
koruma zorunludur ve Windows tarafında DPAPI kullanılır.

Legacy açık TOTP sırları hesap okunduğu transaction içinde:

1. biçim doğrulamasından geçirilir,
2. işletim sistemi korumasıyla şifrelenir,
3. beklenen eski değer koşuluyla atomik `UPDATE` yapılır,
4. uygulama katmanına yalnız bellekte çözülmüş sır verilir.

Koruma sağlayıcısı zorunlu olduğu hâlde kullanılamıyorsa giriş veya MFA işlemi
açık sırla devam etmez. Kurtarma kodları yalnız hash olarak saklanmaya devam eder.

## Sonuçlar

- Veritabanı kopyası tek başına TOTP kodu üretmeye yetmez.
- Eski kullanıcıların MFA kurulumu ve cihaz güveni bozulmadan güvenli geçiş yapılır.
- Farklı koruma sağlayıcısına ait, bozuk veya çözülemeyen zarf fail-closed reddedilir.
- Gerçek Windows DPAPI migration kanıtı Bronze Final öncesi açık kapıdır.
