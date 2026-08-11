# DEC-105 — Uzun işler bağımsız doğrulanabilir adımlara bölünür

**Build:** 214  
**Tarih:** 01.08.2026  
**Durum:** KABUL EDİLDİ

## Karar

PR-171 kabul edilmiştir: uzun veya zaman aşımı riski taşıyan geliştirme, doğrulama, belge üretimi, paketleme ve teslim işleri mümkün olan en küçük mantıksal ve bağımsız adımlara bölünür. Her adım uygulanır, doğrulanır, sonucu kalıcı kaydedilir, kısa durum verilir ve ancak sonra sonraki adıma geçilir. Teknik olarak atomik olmak zorunda olmayan dev işlem zincirleri tek seferde çalıştırılmaz.

## Uygulama etkisi

Build214 kurtarma ve kapanış akışı da bu kurala göre yürütülür: kaynak yeniden inşa → runtime/contract doğrulama → belge/kural kapanışı → version sweep/preflight/integrity → deterministik arşiv/reproducibility/attestation → Library teslimi.

## Kanıt

- `PROJECT-RULES-2026-08-01-V5`
- `docs/18_PROJECT_CONSTITUTION_V5.md`
- `docs/adr/ADR-088-pr171-stepwise-validation-persistence.md`
- `artifacts/validation/build214-v5-rule-hash-recovery.json`
