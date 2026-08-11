# Build 181 Mimari Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.181`
- Package Version: `30.7.2026-181`
- Stage: **Bronze RC2 Active Development**
- Build: **181**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Mimari kararlar

Mimari kararlar DEC-071 ve ADR-054 altında kayıtlıdır. Ana süreç sahipliği, işletim sistemi koruması, atomik kalıcılık, sınırlı durum, kaynak profili parmak izi ve enjekte edilebilir ağ adaptörü korunur.

## Uygulanan sınırlar

- Bekleyen imzalı iptal listesi ana süreçte tutulur ve işletim sistemi koruması ile kalıcılaştırılır.
- Yazım atomiktir; bozuk veya koruma sağlayıcısı uyuşmayan durum karantinaya alınır.
- Kaynak profili, TLS pini veya etkinlik durumu değiştiğinde bekleyen liste güvenli biçimde geri çekilir.
- Ağ erişimi sağlayıcıdan bağımsız adaptör arkasındadır; ağsız test ikizi kullanılabilir.
- Renderer yalnız tipli görünüm modeli alır; korumalı ham durum renderer’a taşınmaz.
- Sağlık sınıfları `missing`, `fresh`, `expiring_soon` ve `expired` olarak merkezî biçimde hesaplanır.

## Doğrulama

- Contract: **29/29 PASS**
- Runtime: **19/19 PASS**
- Syntax/controlled TypeScript: **7/7 PASS**
- Build 179 devamlılığı: **36/36 + 24/24 + 5/5 PASS**
- Build 180 politika devamlılığı: **98/98 + 14/14 + 5/5 PASS**
- Kaynak preflight: **159/159 PASS**
