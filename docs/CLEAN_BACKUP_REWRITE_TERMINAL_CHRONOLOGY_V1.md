# Temiz Yedek Yeniden Yazım Terminal Kronolojisi V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Yayılım çalışması üretmeyen `deferred`, `attention` ve `failed` terminal yollarının tamamlanma ve yeniden deneme zamanlarını sistem duvar saati değişimlerinden bağımsız tutmak.

## Bağlayıcı kurallar

1. Güvenli claim duvar zamanı ile claim öncesi monotonik başlangıç birlikte alınır.
2. Yayılım üretmeyen terminal zaman `safeClaimAt + monotonicElapsed` biçiminde hesaplanır.
3. Geri çekilme veya erteleme zamanı bu terminal tamamlanma zamanına eklenir.
4. İleri ya da geri duvar saati sıçraması terminal zamanı değiştiremez.
5. NaN, sonsuz, negatif, okunamayan veya geriye giden monotonik saat fail-closed reddedilir.
6. Monotonik saat reddedilirse politika/defter `running` kalır ve mevcut kesinti kurtarma sözleşmesi sahipliği güvenli biçimde serbest bırakır.
7. `success` ve `partial` yollarında bağlı propagation `completedAt` değeri yetkili kalır.

## Kanıt

Build 190 davranış, gerçek SQLite ve kontrollü TypeScript/regresyon raporları Bronze kaynak kapılarıdır. Gerçek Windows saat değişimi Silver doğrulama kampanyasında NOT_RUN kalır.
