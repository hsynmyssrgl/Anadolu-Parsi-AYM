# 31-N synthetic single-writer proof harness

Status: `LOCAL_PASS_AWAITING_LIBRARY_RECEIPT`

## Delivered boundary

- Pure synthetic state machine with Desktop-only initial writer.
- Exact transfer shape, safe epoch, previous proof-head binding, and distinct new SHA-256-format digest.
- Dual-writer, zero-writer, stale epoch, stale proof, invalid owner, invalid flags, repeated proof, and extra fields fail closed.
- Rejected transitions leave the immutable snapshot unchanged.
- Every snapshot remains synthetic, non-authoritative, real-gate false, cutover-authority false, and real-data false.
- Exported Core Service boundary with no readiness-ledger or runtime wiring.

## Clean validation

- Contract: 91/91 PASS.
- Root TypeScript: 0 diagnostics.
- Affected package builds: 2/2 PASS.
- Targeted Vitest: 34/34 in 9 files.
- Runtime gates: 8/8 PASS.
- Security and predecessor regressions: 20/20 PASS.
- Full Vitest: 207/207 in 41 files.
- Electron main and renderer production builds: PASS.
- Platform Policy: PASS; new bypass count 0.

## Open boundaries

No production writer lease, process crash/restart proof, stale-lease recovery, rollback recovery, real SINGLE_WRITER_PROOF PASS, runtime attachment, real family-data transfer, SQLite ownership transfer, or cutover authority is attached. DEC-171 remains active and blocked; DEC-172, DEC-173, and DEC-174 remain active. Requirements remain open and no new Build is issued.

Initial failed attempts are retained in `artifacts/checkpoints/31-N_INITIAL_VALIDATION_FAILURES.json` and are not counted as PASS.
