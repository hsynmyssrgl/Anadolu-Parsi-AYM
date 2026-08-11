# Build 150 Teslim Doğrulama Raporu

- Uygulama sürümü: `29.07.2026.150`
- Paket sürümü: `29.7.2026-150`
- Aşama: **Bronze RC2 Active Development**

## Zorunlu kapılar

- Source preflight gate: **PASS** — 67/67
- Source integrity: **PASS** — manifest 1.246 / kaynak 1.246 / SHA256SUMS 1.247
- Clean install gate: **FAIL — EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE**
- Full root `tsc --noEmit`: **FAIL**
- Unit and integration tests: **FAIL**
- Electron production build: **FAIL**
- Blocking smoke chain: **FAIL**
- Windows launch / installer: **NOT_RUN**

## Hedefli doğrulamalar

- Reproducible dependency bootstrap: **PASS — 19/19**
- Windows packager split: **PASS — 15/15**
- Build toolchain security: **PASS — 71 assertion**
- Lockfile integrity: **PASS — 438 assertion / 14 workspace**
- Dependency supply: **PASS — 376 assertion / 117 tarball**
- Workspace dependency graph: **PASS — 360 assertion / 14 workspace**
- Build 149 continuity: **PASS — 44/44**
- Build 150 clean validation: **PASS — 45/45**
- Package-source controlled TypeScript: **PASS — TypeScript 5.8.3**
- Desktop-main controlled TypeScript: **PASS**
- Active version contract: **PASS — 178 assertion / 14 workspace**
- Active delivery documents: **PASS — 122 assertion / 5 document**
- Delivery attestation contract: **PASS — 14 evidence / 8 gate claim**
- Validation boundary: **INCOMPLETE — 2 PASS / 5 FAIL / 1 NOT_RUN**
- Deterministic source archive inventory: **PASS — 1.248 entry**

## Teslim ilkesi

Kaynak ZIP ve SHA-256 dosyası final kaynak manifesti, preflight ve arşiv
doğrulamaları tamamlandıktan sonra üretilecektir. Başarısız tam kapılar teslim
kanıtında FAIL olarak korunacaktır.
