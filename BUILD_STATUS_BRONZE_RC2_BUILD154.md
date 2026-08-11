# Bronze RC2 Build 154 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `29.07.2026.154`
- Package Version: `29.7.2026-154`
- Stage: **Bronze RC2 Active Development**
- Build: **154**

## Tek ana konu

Deterministik npm bağımlılık talep kiti ile geri dönen cache paketinin aynı talep
kimliğine bağlı olduğunun doğrulanması.

## Hedefli sonuçlar

- Dependency handoff contract: **PASS — 28/28**
- Gerçek talep kiti: **PASS — 117 tarball planı**
- Talep kimliği: `24882babc495494a5e5169a0c4854a83340fcf40b04c8fd0ab374bb1210944f0`
- Dönüş durumu: **WAITING — BOUND_RESPONSE_NOT_PRESENT**
- Yanlış talep kimliğinde yanıt kabulü: **FAIL-CLOSED / karantina**

## Geniş kapılar

- Source preflight gate: **PASS** — 78/78
- Source integrity: **PASS** — manifest 1.297 / kaynak 1.297 / SHA256SUMS 1.298
- Clean install gate: **NOT_RUN** — bağlı yanıt paketi henüz mevcut değil
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**
- Validation boundary: **INCOMPLETE — 2 PASS / 0 FAIL / 6 NOT_RUN**

Proje **Bronze RC2 Active Development** aşamasında kalır. Geniş kapılar PASS
olmadan final sorusu sorulamaz.
