# ADR-092 — OPEN-022 safeStorage/DPAPI ve Protected Side Artifact gerçek Windows kanıt mimarisi

**Build:** 218  
**Sürüm:** 01.08.2026.218

## Karar

OPEN-022 için ayrı `runWindowsOpen022SideArtifactEvidenceProbe` kullanılacaktır. Probe:

- yalnız gerçek `win32` üzerinde çalışır,
- Electron `safeStorage` backend'inin `dpapi` olduğunu doğrular,
- stabil key-envelope kimliğini `electron-safe-storage-v1` olarak doğrular,
- `side-artifact-key.json` içinde yalnız cihaz-korumalı `protectedDataKey` bulunduğunu ve açık `dataKey` bulunmadığını doğrular,
- `.pplog`, `.pptdiag`, `.pptreport` için plaintext marker sızıntısını reddeder ve decrypt round-trip doğrular,
- `startup-security-preflight.pptdiag` dosyasının diskte plaintext güvenlik alanları taşımadığını, korumalı store üzerinden açıldığında `windows-dpapi` provider ve PASS preflight içerdiğini doğrular,
- Electron `sessionData` ve `crashDumps` yollarının süreç-özel volatil runtime kökünün dışına çıkmadığını doğrular.

Development ve paketli/kurulu Electron aynı userData ile ayrı ayrı iki kez çalıştırılır. `READY_TO_CLOSE` yalnız bütün zorunlu kontroller PASS ise üretilir. Ana Build Defteri otomatik değiştirilmez.

OPEN-021 EFS kapanışı bu ADR'nin kapsamı dışındadır ve `UNCHANGED` kalır.
