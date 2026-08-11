# Release Notes — Bronze RC2 Build225

Build225 yalnız exact Build224 gerçek Windows tanısında kanıtlanan kök nedenleri düzeltir.

## Security corrections

- Injection-safe/fail-closed Windows EFS attribute verification.
- Explicit pre-write EFS protection and post-write verification for SQLite snapshots.
- Recursive visible staging side-file EFS verification and expanded cleanup boundary.
- Windows safeStorage behavioral proof without a fabricated or mandatory backend string.
- Non-zero fatal Electron startup exit and early full-stack diagnostic evidence.
- Full stdout/stderr Windows harness capture.

## Governance

- Constitution V6 / PR-172: only platform-actual context usage at or above 90% triggers HARD_STOP and mandatory same-response handoff.
- Build224 and earlier source/evidence/ledger history remains immutable.

## Limitations

Real Windows development and installed/package closure probes are `NOT_RUN`; OPEN-021 and OPEN-022 remain independently `NOT_READY`.
