# Build227 Windows Root-Cause Remediation

Build227 / `02.08.2026.227` / `2.8.2026-227` is bound to the exact Build226 source archive SHA-256 `fc440f0f1c72a9b976dd262c5e0ecef0b50e3c172070add95cd6c705f7816543`.

## Security properties

1. The preload graph contains no direct `node:crypto` import and keeps `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`.
2. Persistent Windows envelopes are protected with CurrentUser DPAPI. Secret material is sent only through child-process stdin and is absent from commands and evidence.
3. Key-envelope and protected-container tampering, wrong provider and undecryptable existing ciphertext fail closed without replacement.
4. OPEN-022 does not infer DPAPI from `getSelectedStorageBackend()`. It requires platform, provider basis, availability, cryptographic round-trip, two-process persistence and protected-at-rest container evidence.
5. Installer lifecycle evidence requires a short root, discovered application/uninstaller paths, dynamic registry proof, installed probes, silent uninstall and zero residue.

The async Electron `safeStorage` alternative was tested and rejected after a real two-process failure. No secret/key bytes are included in validation reports.
