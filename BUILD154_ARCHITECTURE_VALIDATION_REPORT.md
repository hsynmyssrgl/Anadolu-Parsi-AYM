# Build 154 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.154`
- Package Version: `29.7.2026-154`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 154, bağlantılı ve çevrimdışı makineler arasındaki bağımlılık teslimini üç
kimlik katmanıyla sınırlar:

1. Aktif lockfile, paket sürümü, edinme planı ve resmi npm politikasından türetilen
   içerik adresli talep kimliği.
2. Aynı kimliği taşıması zorunlu dönüş cache manifesti.
3. Talep kimliğini koruyan kabul makbuzu ve aktif kabul pointerı.

Talep ZIP'i içindeki her çalışma dosyası SHA-256 envanterine bağlıdır. Yanıt
içindeki 117 tarballın her biri lockfile SHA-512 değeriyle yeniden doğrulanır.
Talep kimliği uyuşmazlığında cache içe aktarımı başlamaz.

## Mimari sonuç

- Deterministik request kit: **PASS**
- Resmi npm-only politika: **PASS**
- Request-response identity binding: **PASS**
- Acceptance receipt/pointer continuity: **PASS**
- Wrong-request quarantine: **PASS**
- Active stage preservation: **PASS**
