# ADR-099 — Fail-closed Windows EFS, safeStorage and startup evidence

- Build: 225
- Status: Accepted

## Context

Build224 real-Windows evidence reached the OPEN-021 probe but failed before output because the PowerShell verifier received a null path. Separate inspection proved the staging directory and snapshot lacked EFS while a journal inherited EFS. The Electron promise catch logged the exception and called `app.quit()`, yielding exit code zero. OPEN-022 independently relied on a backend-name equality that Electron need not report on Windows.

## Architecture

- `windows-efs-protection.ts` is the single EFS protection/attribute authority.
- PowerShell receives the resolved path via a child-process-only environment variable and an encoded constant script; input is never interpolated into executable text.
- `cipher.exe /E /A /B /H` is executed with a fixed executable, fixed switches, controlled working directory and basename. Exit zero is necessary but never sufficient.
- Hydration and snapshot files receive explicit EFS protection; directory, snapshot, and any visible journal/WAL/SHM/temp files must carry `Encrypted` before consumption.
- Windows safeStorage proof is behavioral: availability plus opaque protect/unprotect round trip. `windows-dpapi` metadata is recorded with the basis `electron-safe-storage-windows-platform-contract`; it is not claimed as a runtime-reported backend.
- Early startup failure evidence contains stage, error name/message/stack, version/build and timestamp only. Fatal startup uses `app.exit(1)`.

## Closure boundary

Source contracts and tamper tests do not close either OPEN item. OPEN-021 needs exact Build225 development and installed EFS PASS. OPEN-022 needs exact Build225 development and installed safeStorage/artifact PASS. NOT_RUN is not PASS.
