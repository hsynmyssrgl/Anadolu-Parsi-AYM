# Bronze RC2 Build 210 Sürüm Notları

Build 210, terminal temiz-yedek çalışma defterini kalıcı tarihsel kanıt olarak değişmez kılar.

- Migrasyon 49 eklendi: `clean_backup_rewrite_terminal_ledger_immutability`.
- Terminal satırda gerçek veri değiştiren `UPDATE` fail-closed reddedilir.
- Terminal satır `DELETE` işlemi fail-closed reddedilir.
- Aynı terminal `id` için `INSERT OR REPLACE`, SQLite çatışma çözümünden önce `BEFORE INSERT` ile reddedilir.
- Terminal no-op UPDATE izinli kalır.
- Normal `running → terminal` sonuçlandırma mevcut atomik terminal geçiş sözleşmesiyle korunur.
- DEC-100, ADR-083 ve terminal ledger immutability teknik sözleşmesi eklendi.

Tam Silver doğrulama zinciri ve gerçek Windows installer bu Build'in kapsamı değildir; çalıştırılmayan kapılar NOT_RUN olarak kalır.

## Build210 kapanış yönetişim düzeltmesi

V4 Anayasa Build209’da yürürlüğe girdiği için provenance doğrulayıcısındaki `effectiveBuild === currentBuild` varsayımı `effectiveBuild <= currentBuild` olarak düzeltildi. Kural seti, kural sayısı, SHA-256 ve Build209 yürürlük başlangıcı değiştirilmedi; yalnız sonraki buildlerde aynı yürürlükteki Anayasanın doğru biçimde kabul edilmesi sağlandı.
