# Build Status — Bronze RC2 Build227

- Application Version: `02.08.2026.227`
- Package Version: `2.8.2026-227`
- Stage: **Bronze RC2 Active Development**
- Scope: four proven Build226 Windows root causes only

## Source-side status

- Root-cause contract: PASS
- Windows CurrentUser DPAPI two-process persistence and fail-closed cases: PASS
- Package and desktop-main source typechecks: PASS
- OPEN-021 inherited contract/runtime: PASS
- Fatal-startup regression: PASS
- PR-172 regression: PASS
- Build226 fresh-profile/device-identity/maintenance persistence regressions: PASS

## Real Windows closure

The exact-source-bound `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD227.cmd` run completed under the signed-in Windows user. Development and installed OPEN-021/OPEN-022, EFS staging/snapshot, CurrentUser DPAPI cross-process persistence, protected side artifacts, installer discovery, uninstall registry discovery, uninstall cleanup, bundle integrity and the independent closure verifier are PASS. OPEN-021 and OPEN-022 are `READY_TO_CLOSE`; missing or `NOT_RUN` gates remain `NOT_READY` by contract.

The broader Silver gates remain independently reported: root `tsc --noEmit`, the full unit/integration suite and the data-store smoke chain are FAIL on inherited renderer optional-property and production-clean-data/test-fixture expectations. These results were not changed or promoted to PASS in Build227.
