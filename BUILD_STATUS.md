# Active Release Status

- Product: ParsYuva Aile Yaşam Merkezi
- Application Version: `22.08.2026.50`
- Package Version: `22.8.2026-50`
- Stage: **Bronze Active Development**
- Monthly Sequence: **50**
- Channel flow: **Bronze development → Silver validation/fixes → Gold production**
- Silver status: **BLOCKED**

## Current validation status

- Source preflight gate: **NOT_RUN**
- Source integrity: **NOT_RUN**
- Clean install gate: **NOT_RUN**
- Full root `tsc --noEmit`: **PASS (24.08.2026; UAT110 V3 kaynak turu)**
- UAT110 V3 bootstrap/continuation targeted contract tests: **PASS (12 dosya / 94 test)**
- Unit and integration tests: **FULL REGRESSION PENDING**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

These statuses are updated only after the corresponding check runs against the current source. `NOT_RUN` is never treated as `PASS`.

Bronze sequence 50 artık governed bootstrap olarak `previousPackageProvenance=null`, yok kanonik hedef ve `fresh-install + same-version maintenance` kanıtı ister. Sequence 51 ve üzeri exact immutable previous package + canlı installed N runtime ile `N→N+1 + maintenance` uygular. UAT110 makbuzu V3'tür; yeni installer henüz üretilmemiştir.

## Active authorities

- `config/release-ledger.json`
- `config/canonical-rule-registry.json`
- `docs/current/00_AKTIF_ANA_KAPSAM.md`
- `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`
- `docs/17_MASTER_BUILD_LEDGER.md`

Historical global-build documents remain immutable evidence and do not define the active monthly release.
