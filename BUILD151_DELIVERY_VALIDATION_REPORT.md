# Build 151 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.151`
- Package Version: `29.7.2026-151`
- Stage: **Bronze RC2 Active Development**

## Tek ana konu

Kilit dosyasına bağlı resmî npm bağımlılık edinme kiti ve doğrulama kurtarma akışı.

## Zorunlu kapılar

- Source preflight gate: **PASS — 69/69**
- Source integrity: **PASS — manifest 1.260 / kaynak 1.260 / SHA256SUMS 1.261**
- Clean install gate: **FAIL — EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE**
- Full root `tsc --noEmit`: **FAIL — bağımlılık tipleri kurulamadı**
- Unit and integration tests: **FAIL — `vitest` kurulamadı**
- Electron production build: **FAIL — eksik Node tiplerinde durdu**
- Blocking smoke chain: **FAIL — eksik Node tiplerinde durdu**
- Windows launch / installer: **NOT_RUN — Linux ortamı**

## Hedefli sonuçlar

- Dependency acquisition contract: **PASS — 35/35**
- Acquisition plan: **PASS — 117 resmî tarball**
- Gerçek acquisition attempt: **FAIL — EAI_AGAIN**
- Clean npm ci cache readiness: **0/117**

- Validation boundary: **INCOMPLETE — 2 PASS / 5 FAIL / 1 NOT_RUN**

Çalıştırılmayan veya geçmeyen kapılar PASS olarak raporlanmamıştır.
