# Build 172 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.172`
- Package Version: `29.7.2026-172`
- Stage: **Bronze RC2 Active Development**

## Kaynak doğrulaması

- Build 172 sözleşme: **PASS — 69/69**
- Build 172 runtime: **PASS — 33/33**
- Build 172 sözdizimi: **PASS — 12/12**
- Build 171–167 güvenlik devamlılığı: **PASS**
- Controlled TypeScript: **PASS**
- Source preflight: **PASS — 133/133**
- Source integrity: **PASS**
- Deterministic source archive: **PASS**
- Detached delivery attestation: **PASS — 79 kanıt / 8 kapı iddiası**

## Doğrulama sınırı

- Source preflight gate: **PASS**
- Source integrity: **PASS**
- Clean install gate: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

Bağlı npm bağımlılık yanıtı dönmediği ve Windows doğrulama ortamı bulunmadığı için geniş kapılar çalıştırılmış sayılmaz. Teslim Bronze RC2 Active Development kaynak teslimidir.
