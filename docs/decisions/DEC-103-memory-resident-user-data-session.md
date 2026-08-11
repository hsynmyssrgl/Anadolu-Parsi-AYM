# DEC-103 — Bellek-içi aktif kullanıcı verisi oturumu

**Build:** 213  
**Tarih:** 01.08.2026  
**Durum:** KABUL EDİLDİ

## Karar

Kimliği doğrulanmış oturum sırasında aile veritabanı kalıcı veya normal geçici düz SQLite dosyası olarak çalıştırılmaz. Aktif SQLite veritabanı süreç belleğinde `:memory:` bağlantısında tutulur. Kalıcı ana veri yalnız AES-256-GCM kullanıcı kasasıdır.

SQLite görüntüsünün dosya biçiminde kısa süreli gerekli olduğu hydration, snapshot, yedek ve restore sınırları ayrı staging dizininde yürütülür. Windows production çalışma zamanında bu dizin, dosya oluşturulmadan önce `cipher.exe /E /B /H` ile EFS korumasına alınır; EFS etkinleştirilemezse işlem fail-closed durur. İşlem sonrası staging dosyaları kaldırılır.

Aktif oturum en geç 30 saniyelik aralıkla AES-256-GCM kasaya checkpoint edilir; logout, oturum süresi dolumu ve uygulama kapanışında son snapshot kasaya mühürlenir ve bellek/staging oturumu kapatılır.

## Güvenlik sınırı

Bu mimari diskte okunabilir aktif `.db/.sqlite` dosyası bırakmama hedefini sağlar. Aynı Windows kullanıcı bağlamındaki malware, süreç belleği okuma yeteneği olan saldırgan veya yöneticiye karşı mutlak izolasyon iddia edilmez. Windows EFS ve paketlenmiş uygulama doğrulaması gerçek Windows ortamında ayrıca kanıtlanmadan OPEN-021 tamamen kapatılmaz.

## Etkilenen alanlar

- `apps/desktop/src/main/volatile-sqlite-session.ts`
- `apps/desktop/src/main/user-data-vault.ts`
- `apps/desktop/src/main/main.ts`
- `apps/desktop/src/main/data-store.ts`
- `apps/desktop/src/main/family-database-runtime.ts`
- `packages/database/src/family-database-migrations.ts`
- `docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md`
- `config/in-use-user-data-protection.json`

## Kanıt

- `scripts/verify-build213-in-use-data-protection-contract.mjs`
- `scripts/verify-build213-volatile-user-data-runtime.mjs`
- gerçek Windows EFS/paketli çalışma kanıtı: **PENDING / NOT_RUN**
