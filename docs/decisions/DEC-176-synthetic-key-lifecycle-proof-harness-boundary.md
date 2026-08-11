# DEC-176 — Synthetic key lifecycle proof harness detached non-submittable boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-O
- Predecessor: DEC-175 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE and blocked

## Decision

Core Service receives a pure synthetic key-lifecycle state machine. It models detached, protected, session-open, sealing, and sealed states using only opaque identifiers and SHA-256-format synthetic proof digests. It never generates, loads, accepts, exports, or stores real key material.

Every transition requires an exact input shape, current safe-integer epoch, valid lifecycle order, and a lowercase non-genesis proof digest that has never been used before. Opaque handle and protector identifiers must be valid and distinct. Invalid or rejected transitions leave the immutable current snapshot unchanged.

At most one synthetic plaintext lease is modeled. New lease admission closes when the session opens, the lease remains bounded through sealing, and it is released before the sealed candidate can be produced. State invariants bind lifecycle, identifiers, lease count, lease admission, and permanent non-production flags.

The candidate does not expose production-like `gateId`. It carries only `modeledGate: KEY_LIFECYCLE_PROOF`, `syntheticOnly: true`, `realKeyMaterialAccessed: false`, `productionGateSatisfied: false`, `productionSubmissionAllowed: false`, and `cutoverAuthorityAttached: false`. It cannot be submitted as real readiness evidence.

## Production detachment

31-O exports the harness boundary but does not attach it to device-secret runtime, family-data runtime, readiness ledger, protected journal, local administration, IPC, filesystem, SQLite, environment, network, vault, protected provider, or any real data path. Process crash, restart, memory clearing, stale-lease recovery, rollback recovery, production signing, and production verifier-key authority remain unproven or detached.

DEC-171 through DEC-175 are not replaced or weakened. The Desktop vault and active SQLite session remain authoritative. No production readiness gate is marked PASS, no requirement is declared COMPLETE, and no new Build is issued.
