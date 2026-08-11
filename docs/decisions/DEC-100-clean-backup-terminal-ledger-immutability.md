# DEC-100 — Terminal temiz-yedek çalışma defteri değişmezliği

## Karar

Build 210 ile `backup_clean_rewrite_runs` tablosunda `running` dışındaki tüm terminal çalışma satırları kalıcı kanıt kabul edilir. Terminal satırda gerçek veri değişikliği yapan `UPDATE`, `DELETE` ve aynı kimliği yeniden oluşturmaya çalışan `INSERT OR REPLACE` yolları SQLite düzeyinde fail-closed reddedilir.

## Korunan meşru davranış

- `running → terminal` sonuçlandırma Build 197 atomik terminal geçiş sözleşmesi üzerinden çalışmaya devam eder.
- Terminal satıra yapılan ve hiçbir alanı değiştirmeyen gerçek no-op `UPDATE` engellenmez.
- Yeni `running` çalışma sahiplenmesi mevcut claim/policy kurallarına göre devam eder.

## Güvenlik gerekçesi

Terminal çalışma kaydı; sonuç, kronoloji, propagation bağlantısı, retry bilgisi ve hata kanıtının tarihsel kaydıdır. Sonradan değiştirilmesi veya aynı primary-key üzerinde SQLite `REPLACE` ile yeniden kurulması audit ve yedek bütünlüğünü bozar. `BEFORE INSERT` koruması, `recursive_triggers=0` durumunda REPLACE'in iç DELETE davranışına güvenmez.

## Uygulama

- Migrasyon 49: `clean_backup_rewrite_terminal_ledger_immutability`
- ADR-083
- `docs/CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1.md`
- Hedefli sözleşme ve gerçek SQLite runtime regresyonu
