# Bronze RC2 Build 207 — Durum

- Application Version: `01.08.2026.207`
- Package Version: `1.8.2026-207`
- Stage: **Bronze RC2 Active Development**
- Karar: **DEC-097**
- ADR: **ADR-080**
- Politika: `PPT-BUILD-LEDGER-CONTINUITY-V3`
- Kural seti: `PROJECT-RULES-2026-08-01-V2`
- Kural sayısı: **111**

## Kapsam

Her tamamlanan build sonrası sohbet bağlamının tahmini kullanılan/kalan yüzdesi Ana Build Defteri'ne kaydedilir. %85–89 `WARNING`, %90+ `HARD_STOP` olarak değerlendirilir. HARD_STOP durumunda aynı sohbet içinde yeni build başlatılamaz ve yeni-sohbet devir promptu zorunlu üretilir.

## Doğrulama sınırı

Hedefli yönetişim/sözleşme kontrolleri Build 207 kapsamında çalıştırılır. Tam `npm ci`, tam workspace `tsc --noEmit`, tüm testler, Electron production build, blocking smoke ve gerçek Windows installer ayrı doğrulama kapılarıdır; çalıştırılmadıkça `NOT_RUN` kalır.
