# Clean Backup Rewrite Terminal Ledger Immutability V1

**Build:** 210  
**Sürüm:** 01.08.2026.210  
**Karar:** DEC-100  
**ADR:** ADR-083

## Amaç

`backup_clean_rewrite_runs` terminal satırlarını tamamlandıktan sonra değiştirilemez tarihsel kanıt olarak korumak.

## Durum modeli

`running` tek aktif durumdur. Aşağıdaki durumlar terminal kabul edilir:

- `success`
- `partial`
- `failed`
- `attention`
- `deferred`
- `interrupted`

## Zorunlu SQLite davranışı

| İşlem | Terminal satır | Running satır |
|---|---|---|
| Gerçek veri değiştiren UPDATE | RED | Mevcut sahiplik/terminal kurallarına göre |
| No-op UPDATE | İZİNLİ | Mevcut kurallara göre |
| DELETE | RED | Build 193 aktif sahiplik korumasına göre |
| Aynı ID için INSERT OR REPLACE | RED | Bu sözleşmenin kapsamı dışında, mevcut sahiplik kurallarına göre |
| running → terminal UPDATE | Uygulanamaz | İZİNLİ; Build 197+ doğrulamaları zorunlu |

## REPLACE güvenlik sınırı

Koruma yalnız DELETE trigger'ına dayanmaz. Aynı kimlikle terminal satır bulunduğu anda `BEFORE INSERT` tetikleyicisi işlemi durdurur. Bu nedenle SQLite `PRAGMA recursive_triggers=0` olsa da REPLACE terminal kanıtını silemez ve yeniden yazamaz.

## Kabul kriterleri

1. Her terminal statüde en az bir alan değişikliği reddedilir.
2. Terminal DELETE reddedilir.
3. `INSERT OR REPLACE` reddedilir ve eski satır byte/anlamsal olarak korunur.
4. Terminal no-op UPDATE başarıyla tamamlanır.
5. `running → terminal` normal geçiş yeni koruma tarafından engellenmez.
6. Migrasyon 49 ve üç tetikleyici kayıtlıdır.
7. Schema generation `REVISION-210-CLEAN-BACKUP-TERMINAL-LEDGER-IMMUTABILITY` olur.
