# ADR-091 — OPEN-021 EFS-only gerçek Windows kanıt mimarisi

**Build:** 217  
**Sürüm:** 01.08.2026.217

## Karar

OPEN-021 için ayrı `runWindowsOpen021EfsEvidenceProbe` kullanılacaktır. Probe:

- yalnız gerçek `win32` üzerinde çalışır,
- aktif SQLite veritabanının `memory-only` olduğunu doğrular,
- staging alanını `requireWindowsEfs=true` ile açar,
- staging dizini ve SQLite snapshot üzerinde gerçek Windows `Encrypted` attribute kontrolü yapar,
- snapshot'ın geçerli SQLite imajı olduğunu doğrular,
- staging cleanup sonrasında `.db/.sqlite` kalıntısı bırakılmadığını kontrol eder.

Development ve paketli/kurulu Electron ayrı ayrı iki kez çalıştırılır. `READY_TO_CLOSE` yalnız bütün zorunlu kontroller PASS ise üretilir. Ana Build Defteri otomatik değiştirilmez.

OPEN-022 yan-artifact/DPAPI kapanışı bu ADR'nin kapsamı dışındadır ve `UNCHANGED` kalır.

