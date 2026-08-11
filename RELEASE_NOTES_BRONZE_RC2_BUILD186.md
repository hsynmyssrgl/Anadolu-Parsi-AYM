# Bronze RC2 Build 186 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.186`
- Package Version: `30.7.2026-186`
- Stage: **Bronze RC2 Active Development**
- Build: **186**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Eklenenler ve düzeltmeler

- Başarı ve kısmi temiz-yedek çalışma sonucu propagation `completedAt` değerine bağlandı.
- Başarı/kısmi sonuç için `propagationRunId` zorunlu hale getirildi.
- Bağlı propagation kaydı bulunmuyorsa sonuçlandırma reddedilir.
- Temiz-yedek tamamlanması propagation tamamlanmasından önceyse SQLite reddeder.
- Geçersiz veya çalışma başlangıcından önce tamamlanma zamanı reddedilir.
- Dış hata yolunda geriye giden duvar saati çalışma başlangıç tabanına çekilir.
- Build 186 veritabanı migrasyonu ve bağlı kronoloji indeks/tetikleyicileri eklendi.

## Bağlayıcı kayıtlar

DEC-076, ADR-059 ve `docs/CLEAN_BACKUP_REWRITE_LINKED_CHRONOLOGY_V1.md`.
