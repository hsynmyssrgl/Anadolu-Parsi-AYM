# 31-P synthetic rollback recovery drill

Status: `LOCAL_PASS_AWAITING_LIBRARY_RECEIPT`

## Delivered boundary

- Pure synthetic sequence: baseline sealed, read-only candidate, failure injected, rollback active, Desktop restored, and recovery verified.
- Desktop remains the only modeled writer; Core Service is never writable.
- Exact input shapes, safe epochs, and never-reused lowercase SHA-256-format proof digests.
- Candidate is read-only only through the failure window and detached when rollback starts.
- Invalid order, stale epoch, malformed input, invalid/reused proof, and post-recovery transitions fail closed without mutation.
- Candidate exposes modeledGate only, has no gateId, and remains non-submittable with every production flag false.
- Exported Core Service boundary with no readiness-ledger or runtime wiring.

## Clean validation

- Contract: 104/104 PASS.
- Root TypeScript: 0 diagnostics.
- Affected package builds: 2/2 PASS.
- Targeted Vitest: 50/50 in 11 files.
- Runtime gates: 8/8 PASS.
- Security and predecessor regressions: 24/24 PASS.
- Full Vitest: 223/223 in 43 files.
- Electron main and renderer production builds: PASS.
- Platform Policy: PASS; new bypass count 0.

## Open boundaries

Real process crash, restart, backup restore, backup integrity, recovery timing, protected-journal recovery, stale-lease recovery, operator receipt, production abort criteria, real ROLLBACK_DRILL PASS, runtime attachment, real family-data access, SQLite ownership transfer, and cutover authority remain absent or unproven. DEC-171 remains active and blocked; DEC-172 through DEC-176 remain active. Requirements remain open and no new Build is issued.

Initial failed attempts are retained in `artifacts/checkpoints/31-P_INITIAL_VALIDATION_FAILURES.json` and are not counted as PASS.
