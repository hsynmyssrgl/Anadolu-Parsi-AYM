# 31-S versioned cutover decision preflight

Status: `LOCAL_PASS_AWAITING_LIBRARY_RECEIPT`

## Delivered boundary

- A detached read-only preflight boundary for a future separately versioned successor decision; it is not a successor cutover decision.
- Exact plain-data input and exactly five canonical readiness gates; accessors and extra fields are rejected.
- PASS gates require unique non-genesis evidence digests; pending gates require null evidence.
- Ledger epoch, entry count, and PASS count must match; integrity and a trusted anchor are both required.
- Expected and observed authoritative-source seals must match and all source and ledger-head seals must be non-genesis.
- The preflight digest is canonical and insertion-order-independent; raw evidence, source seals, and ledger head are redacted.
- Even an eligible result keeps `currentDecision: DEC-171` and `decision: blocked`; no successor decision or submission is created.
- The exported Core Service boundary has no runtime, ledger, activation, or cutover wiring.

## Clean validation

- Contract: 130/130 PASS.
- Root TypeScript: 0 diagnostics.
- Targeted Vitest: 81/81 in 14 files.
- Runtime gates: 8/8 PASS.
- Security and predecessor regressions: 30/30 PASS.
- Full Vitest: 254/254 in 46 files.
- Production builds and Platform Policy: PASS.

## Open boundaries

Real evidence authority, trusted-anchor runtime, real approval, a separately governed successor decision, versioned decision submission, automatic activation, runtime attachment, real data, SQLite ownership transfer, and cutover authority remain absent or unproven. The 31-S application instruction is not a successor decision or cutover consent. DEC-171 remains active and blocked; DEC-172 through DEC-179 remain active. Requirements remain open and no new Build is issued.

Initial failed attempts are retained in `artifacts/checkpoints/31-S_INITIAL_VALIDATION_FAILURES.json` and are not counted as PASS.
