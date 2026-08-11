# Bronze RC2 Build 187 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.187`
- Package Version: `30.7.2026-187`
- Stage: **Bronze RC2 Active Development**
- Build: **187**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Eklenenler ve düzeltmeler

- Kesinti kurtarma zamanı kalıcı çalışma başlangıcından önce olamayacak biçimde
  repository içinde üretilir.
- Sistem saati geri alınmışsa kayıtlı başlangıç güvenli zaman tabanı olur.
- 360 dakikalık otomatik geri çekilme güvenli kurtarma tamamlanmasından başlar.
- Çalışma defteri `started_at` değeri politika başlangıcına göre önceliklidir.
- Yeni çalışma sahiplenilirken eski `next_attempt_at` temizlenir.
- Politika sahipliği, durum ve sonraki deneme tutarlılığı SQLite tetikleyicileriyle
  korunur.
- Kesilmiş/başarısız/kısmi/ertelenmiş/dikkat çalışmaları için tamamlanma ve
  sonraki deneme sırası fail-closed doğrulanır.
- Saat düzeltmesi kullanıcıya görünür, gizlilik güvenli tanı koduyla kaydedilir.

## Bağlayıcı kayıtlar

DEC-077, ADR-060 ve `docs/CLEAN_BACKUP_REWRITE_RECOVERY_CHRONOLOGY_V1.md`.
