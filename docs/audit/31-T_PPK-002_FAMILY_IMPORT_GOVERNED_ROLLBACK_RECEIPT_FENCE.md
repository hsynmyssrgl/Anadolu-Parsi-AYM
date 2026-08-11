# 31-T PPK-002 family import governed rollback receipt fence

Status: `LOCAL_PASS_AWAITING_LIBRARY_RECEIPT`

## Teslim edilen sınır

- Import batch ile yaratılmış governed event ve location satırları için satır başına taze, exact delete policy receipt zorunludur.
- Create receipt, batch/family/owner, canlı policy fence ve journal projection bağları veritabanında doğrulanır.
- Yetki, tombstone, iş satırı silme, batch durumu ve audit tek SQLite transaction içinde yürür.
- Tombstone değiştirilemez, silinemez ve tek kullanımlıdır; completion fence bütün satırların yokluğunu ve bütün governed tombstone'ların tüketimini ister.
- Eski NULL-receipt import satırlarının kontrollü rollback uyumluluğu korunur.

## Temiz doğrulama

- Contract: 72/72 PASS.
- Root TypeScript: 0 diagnostic.
- Targeted Vitest: 15/15, 4 dosya.
- Migration 68, Platform Policy ve DEC-181 ledger: PASS.
- Full Vitest: 259/259, 48 dosya.
- Affected package, Electron ve renderer production build: PASS.

## Açık sınırlar

PPK-002 halen PARTIAL'dır. Universal repository enforcement, obligation execution ve external monotonic rollback authority bu dilimde tamamlanmamıştır. Yeni Build verilmemiştir. İlk başarısız deneme `artifacts/checkpoints/31-T_INITIAL_VALIDATION_FAILURES.json` içinde PASS sayılmadan saklanır.
