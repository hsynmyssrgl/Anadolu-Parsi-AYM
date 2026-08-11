# Build 213 — Bronze RC2 Active Development

- Application Version: `01.08.2026.213`
- Package Version: `1.8.2026-213`
- Stage: **Bronze RC2 Active Development**
- Scope: Aktif oturumda kullanıcı verisini düz SQLite disk dosyasından süreç belleğine taşıma ve Windows EFS korumalı bounded staging
- Project Rules: `PROJECT-RULES-2026-08-01-V4` / `6259d2c757caf865aedfe99a7bcea0a1a333551415b0912a856ac571876274f9`

## Durum

Aktif aile SQLite veritabanı artık yalnız süreç belleğinde (`:memory:`) çalışır. Kalıcı ana veri AES-256-GCM kullanıcı kasasıdır. Hydration/snapshot/backup/restore sırasında dosya görüntüsü gerekirse yalnız kısa ömürlü staging alanı kullanılır; Windows production'da bu alan EFS ile önceden korunamazsa işlem fail-closed durur. Aktif oturum en fazla 30 saniyede bir şifreli kasaya checkpoint edilir.

## OPEN-021

**IN_PROGRESS.** Kaynak sözleşmesi ve non-Windows gerçek SQLite runtime doğrulaması PASS'tir; fakat gerçek Windows `cipher.exe`/EFS ve paketlenmiş uygulama kanıtı **NOT_RUN** olduğundan OPEN-021 tamamen kapatılmaz.

## Doğrulama sınırı

- Build213 in-use protection contract: PASS (27/27)
- Build213 volatile SQLite runtime: PASS (13/13)
- Package source TypeScript: PASS
- Desktop-main controlled TypeScript: PASS
- Windows EFS runtime: NOT_RUN
- Clean npm ci: OPEN-002 nedeniyle PASS değildir
- Full root tsc / all tests / Electron production build / blocking smoke / real Windows installer: NOT_RUN
