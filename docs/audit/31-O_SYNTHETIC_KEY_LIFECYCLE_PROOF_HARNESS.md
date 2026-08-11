# 31-O synthetic key lifecycle proof harness

Status: `LOCAL_PASS_AWAITING_LIBRARY_RECEIPT`

## Delivered boundary

- Pure synthetic lifecycle: detached, protected, session-open, sealing, and sealed.
- Exact input shapes, safe epochs, distinct opaque identifiers, and never-reused lowercase SHA-256-format proof digests.
- At most one bounded synthetic plaintext lease; it is released before the sealed candidate is produced.
- Invalid order, stale epoch, malformed input, ambiguous identifiers, invalid/reused proof, second lease, and post-seal transition fail closed without mutation.
- Candidate exposes modeledGate only, has no gateId, and remains non-submittable with every production flag false.
- Exported Core Service boundary with no readiness-ledger or runtime wiring.

## Clean validation

- Contract: 98/98 PASS.
- Root TypeScript: 0 diagnostics.
- Affected package builds: 2/2 PASS.
- Targeted Vitest: 42/42 in 10 files.
- Runtime gates: 8/8 PASS.
- Security and predecessor regressions: 22/22 PASS.
- Full Vitest: 215/215 in 42 files.
- Electron main and renderer production builds: PASS.
- Platform Policy: PASS; new bypass count 0.

## Open boundaries

Real key material and real family data are not accessed. No production protected provider, process crash/restart proof, memory-clearing proof, stale-lease recovery, rollback recovery, real KEY_LIFECYCLE_PROOF PASS, runtime attachment, SQLite ownership transfer, or cutover authority is attached. DEC-171 remains active and blocked; DEC-172 through DEC-175 remain active. Requirements remain open and no new Build is issued.

Initial failed attempts are retained in `artifacts/checkpoints/31-O_INITIAL_VALIDATION_FAILURES.json` and are not counted as PASS.
