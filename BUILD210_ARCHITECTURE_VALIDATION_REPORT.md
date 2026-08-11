# Build 210 Mimari Doğrulama Raporu

## Değişiklik

Terminal `backup_clean_rewrite_runs` satırları SQLite düzeyinde değişmez tarihsel kanıt haline getirildi. REPLACE kaçışı doğrudan `BEFORE INSERT` korumasıyla kapatıldı.

## Mimari kararlar

- DEC-100
- ADR-083
- Migrasyon 49
- `CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1`

## Doğrulama

- Build210 sözleşme testi: **PASS — 21/21**
- Gerçek `node:sqlite` regresyonu: **PASS — 19/19**
- Package source TypeScript: **PASS**
- Desktop-main source TypeScript: **PASS**
- No-op UPDATE: **korundu**
- `running → terminal`: **korundu**
- Terminal UPDATE/DELETE/INSERT OR REPLACE: **fail-closed reddedildi**

## Sınır

Clean npm ci dış bağımlılık servisi erişilememe/zaman aşımı nedeniyle **FAIL**. Tam root/workspace TypeScript, bütün test paketi, Electron production build, blocking smoke ve gerçek Windows installer **NOT_RUN**; çalıştırılmadan PASS sayılamaz.

## Build210 kapanış yönetişim düzeltmesi

V4 Anayasa Build209’da yürürlüğe girdiği için provenance doğrulayıcısındaki `effectiveBuild === currentBuild` varsayımı `effectiveBuild <= currentBuild` olarak düzeltildi. Kural seti, kural sayısı, SHA-256 ve Build209 yürürlük başlangıcı değiştirilmedi; yalnız sonraki buildlerde aynı yürürlükteki Anayasanın doğru biçimde kabul edilmesi sağlandı.
