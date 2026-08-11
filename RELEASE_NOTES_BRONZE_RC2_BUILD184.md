# Bronze RC2 Build 184 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.184`
- Package Version: `30.7.2026-184`
- Stage: **Bronze RC2 Active Development**
- Build: **184**

## Eklenenler ve düzeltmeler

- SQLite sonuçlandırma sorgusundaki 10 bağlayıcı / 9 değer kusuru düzeltildi.
- Migrasyon 30 ile kalıcı temiz yedek çalışma defteri eklendi.
- Politika ve çalışma defteri aynı unit-of-work içinde atomik sonuçlandırılıyor.
- Eski çalışma kimliği sonuçlandırma yapamıyor.
- Başarı, kısmi, hata, dikkat, erteleme ve kesinti geçmişi kullanıcıya gösteriliyor.
- Gerçek `node:sqlite` regresyon kapısı eklendi.

## Bağlayıcı kayıtlar

DEC-074, ADR-057 ve `docs/CLEAN_BACKUP_REWRITE_FINALIZATION_LEDGER_V1.md`.
