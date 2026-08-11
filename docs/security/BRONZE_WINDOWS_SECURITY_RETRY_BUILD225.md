# Build225 gerçek Windows OPEN-021/022 kapanış retry

- Application Version: `02.08.2026.225`
- Package Version: `2.8.2026-225`
- Runner: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD225.cmd`

## Zorunlu koşullar

Runner exact Build225 source integrity, dependency/bootstrap, workspace build, installer lifecycle, development ve installed probe'ları çalıştırır. OPEN-021 ve OPEN-022 ayrı değerlendirilir. Her zorunlu lifecycle satırı gerçek `PASS` olmalıdır; `NOT_RUN`, eksik dosya veya probe failure `READY_TO_CLOSE` değildir.

OPEN-021 staging directory, snapshot, görünür SQLite journal/WAL/SHM/temp ağacı, SQLite round-trip ve cleanup kanıtlarını ister. OPEN-022 Windows safeStorage availability + gerçek protect/unprotect, key envelope, `.pplog/.pptdiag/.pptreport`, plaintext leak, protected startup evidence ve volatil session/crash yollarını ister. Runtime backend string'i `dpapi` olmak zorunda değildir ve sahte backend değeri üretilmez.

Her Electron koşusunun tam stdout/stderr'i ayrı dosyada saklanır. Window öncesi fatal hata olursa early-startup JSON stage/name/message/stack/version/build/timestamp taşır. Fatal startup exit code 1'dir.

Bu kaynak doğrulamasında gerçek `DESKTOP-02GCVDE\Husey` interactive koşusu çalıştırılmadığından OPEN-021 ve OPEN-022 sonucu `NOT_READY` kalır.
