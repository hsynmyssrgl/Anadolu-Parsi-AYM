# DEC-116 — Build224 Windows security root-cause remediation

- Build: 225
- Application Version: `02.08.2026.225`
- Status: Accepted

## Evidence

Exact Build224 Windows diagnostics proved two independent validation defects. OPEN-021 passed an EFS path after a PowerShell `-Command` script but consumed `$args[0]`; the value was null, and `cipher` exit code zero had not proved the staging directory or SQLite snapshot carried the NTFS `Encrypted` attribute. OPEN-022 required `safeStorage.getSelectedStorageBackend()` to equal `dpapi`, although Electron's Windows security contract is established by the Windows platform plus available `safeStorage` and a successful real encrypt/decrypt round trip; the backend-name API is not a portable Windows proof surface. Fatal `app.whenReady()` errors were then masked by `app.quit()` exit code zero.

## Decision

1. EFS paths are passed outside PowerShell command text through a process environment value, consumed with `Get-Item -LiteralPath`, and every protection operation is followed by an NTFS `Encrypted` attribute check.
2. Snapshot files are created empty, explicitly EFS-protected, and verified before SQLite writes plaintext into them; the resulting snapshot and every visible staging side file are reverified before use.
3. OPEN-022 ignores backend name as a gate. Windows platform, `safeStorage` availability, direct protect/unprotect, protected key envelope, ciphertext leak checks, at-rest startup evidence, and volatile paths are mandatory.
4. Fatal startup writes bounded early diagnostic evidence and terminates with exit code 1.
5. OPEN-021 and OPEN-022 remain independent and cannot close on NOT_RUN.

ADR-099 is the implementation authority.
