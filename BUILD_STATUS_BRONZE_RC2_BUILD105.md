# Panthera pardus tulliana Aile — Bronze RC2 Build 105

- Application Version: `25.07.2026.105`
- Package Version: `25.7.2026-105`
- Durum: **Bronze RC2 Active Development**

## Tamamlanan mimari geliştirmeler

- `DatabaseStatement`, `DatabaseExecutor`, `DatabaseConnection`, `TransactionContext` ve `TransactionExecutor` sözleşmelerinin sahipliği `@ppt/contracts` katmanına taşındı.
- Transaction callback’lerinin native database executor taşıması kaldırıldı; nominal ve opak `RepositoryTransaction` belirteci kullanılmaya başladı.
- Application adapter’larının SQL çalıştırma yeteneği tip düzeyinde kaldırıldı.
- SQLite executor yalnızca database katmanında opak transaction belirteci üretir; belirtecin database executor’a açılması yalnızca `SqliteRepository` taban sınıfında yapılır.
- 26 repository implementasyonundaki doğrudan `context.transaction.prepare/exec` erişimleri kontrollü repository tabanına taşındı.
- Migration güvenli yedek yardımcılarının yanlış modül importu düzeltildi.
- Audit ve outbox repository port interface’lerindeki geçersiz varsayılan parametre tanımları düzeltildi.
- Audit giriş doğrulaması merkezi `AppError` ve `ERROR_CODES` sözleşmesine uygun hale getirildi.

## Gerçek doğrulama durumu

Kaynak, mimari, lockfile, dependency supply, sürüm, repository sınırı, sözdizimi ve hedefli persistence/adapter tip analizleri geçti. Hedefli tip analizleri tam workspace `tsc --noEmit` değildir.

Temiz `npm ci` HTTP 503 nedeniyle başarısız oldu. Bundan sonraki tam doğrulama adımları çalıştırılmadı.

Bronze RC2 Final aşamasına geçilmedi.
