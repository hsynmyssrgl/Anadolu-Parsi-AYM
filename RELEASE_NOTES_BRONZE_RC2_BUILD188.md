# Bronze RC2 Build 188 Sürüm Notları

## Yeni

- `DEC-078` ve `ADR-061`: geri alma güvenli temiz-yedek çalışma sahiplenmesi.
- Güvenli claim zamanı; gözlenen saat, politika güncellemesi, son deneme, son
  başarı ve varsa devam eden başlangıcın en ileri değeridir.
- Saat düzeltmesinde durum ve saklama kesimi güvenli zamanda yeniden hesaplanır.
- `backup.clean_rewrite_claim_clock_adjusted` görünür ve gizlilik güvenli tanısı.
- Migrasyon 33 ile politika/defter zaman gerilemesi, değiştirilen başlangıç ve
  saklama kesimi ile ikinci eşzamanlı `running` kayıt koruması.

## Güvenlik

- Gelecekteki `nextAttemptAt` güvenli saat tabanına katılmaz; backoff erkenden
  aşılamaz.
- Repository güvenli başlangıç, sayaçlar ve saklama kesimi eşleşmesini yeniden
  doğrular.
- Bozuk veya geriye giden doğrudan SQLite yazımı fail-closed reddedilir.

## Doğrulama sınırı

Bronze kaynak kanıtları çalıştırılır. Temiz kurulum, tam test, production build,
smoke ve gerçek Windows/installer kapıları Silver için NOT_RUN kalır.
