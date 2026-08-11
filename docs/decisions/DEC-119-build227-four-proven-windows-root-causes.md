# DEC-119 — Build227 Four Proven Windows Root Causes

## Decision

Build227 changes only the four root causes proven against exact Build226: sandbox preload UUID dependency, persistent Windows key-envelope provider, installer lifecycle discovery/path handling, and stale OPEN-022 backend-name contract.

## Evidence boundary

- Electron 43.2.0 async `safeStorage` process-1 encrypt to process-2 decrypt: **FAIL**; not selected.
- Windows `ProtectedData` with `DataProtectionScope.CurrentUser` across independent processes: **PASS**; selected for persistent envelopes.
- Existing protected envelope mismatch or decrypt failure: fail closed; no replacement.
- `selectedBackend=unknown`: allowed only when runtime-backend-reported is false and all required Windows DPAPI behavior/persistence/container checks pass.
- Build215/218/219/220/221, Build225 OPEN-022 and the version-pinned Build226 fresh-profile active-source contracts that require a superseded provider basis, `electron-safe-storage-v1`, `selectedBackend=dpapi`, or exact prior package version are retained as historical files but are not current Build227 preflight/attestation gates; compatible self-contained historical runtime/tamper evidence remains registered.
- Development and installed OPEN-021/OPEN-022, installer, uninstaller and cleanup remain independent real-Windows closure gates. `NOT_RUN` is never `PASS`.
- Exact Build227 real-Windows closure: development and installed OPEN-021/OPEN-022, install/uninstall lifecycle, zero-residue cleanup, evidence bundle integrity and independent verifier **PASS**; both OPEN items are `READY_TO_CLOSE`.

Build226 and earlier historical records are unchanged. Build228 is not started by this decision.
