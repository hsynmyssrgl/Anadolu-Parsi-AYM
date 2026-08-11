# Build 171 Teslim Doğrulama Raporu

- Application Version: `29.07.2026.171`
- Package Version: `29.7.2026-171`
- Stage: **Bronze RC2 Active Development**

## Kaynak doğrulaması

- Build 171 sözleşme: **PASS — 66/66**
- Build 171 runtime: **PASS — 31/31**
- Build 171 sözdizimi: **PASS — 12/12**
- Build 170–167 güvenlik devamlılığı: **PASS**
- Controlled TypeScript: **PASS**
- Source preflight: **PASS — 130/130**
- Source integrity: **PASS**
- Deterministic source archive: **PASS**
- Detached delivery attestation: **PASS — 76 kanıt / 8 kapı iddiası**

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
