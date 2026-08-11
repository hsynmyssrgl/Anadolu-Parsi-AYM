# Bronze RC2 Build 185 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.185`
- Package Version: `30.7.2026-185`
- Stage: **Bronze RC2 Active Development**
- Build: **185**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Eklenenler ve düzeltmeler

- Yayılım `completedAt` değerinin işlem başında üretilmesi kaldırıldı.
- Başlangıç duvar saati, `performance.now()` monotonik başlangıcıyla eşlendi.
- Her hedef karantina zamanı gerçek karantina noktasında üretiliyor.
- Final zaman bütün hedef işlemlerinden sonra alınıyor.
- Tombstone güncellemesi ile kalıcı propagation run aynı final zamanı kullanıyor.
- Geriye giden, sonsuz veya geçersiz monotonik saat fail-closed reddediliyor.

## Bağlayıcı kayıtlar

DEC-075, ADR-058 ve `docs/MANAGED_BACKUP_PROPAGATION_CHRONOLOGY_V1.md`.
