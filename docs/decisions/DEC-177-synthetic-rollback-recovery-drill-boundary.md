# DEC-177 — Synthetic rollback and recovery drill detached non-submittable boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-P
- Predecessor: DEC-176 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE and blocked

## Decision

Core Service receives a pure synthetic rollback and recovery state machine. It models baseline sealing, a read-only candidate, synthetic failure injection, rollback activation, Desktop writer confirmation, and synthetic recovery verification. Desktop remains the only modeled writer throughout; Core Service never becomes writable.

Every transition requires the exact `expectedEpoch` and `proofDigest` key set, the current safe-integer epoch, valid stage order, and a lowercase non-genesis SHA-256-format proof digest that has never been used. Invalid or rejected transitions leave the immutable current snapshot unchanged.

The read-only candidate exists only during the candidate and synthetic-failure stages and is detached when rollback begins. Failure injection does not crash a process. Recovery verification does not restore a real backup, replay a production journal, touch a vault, access family data, or transfer SQLite ownership.

The evidence candidate does not expose production-like `gateId`. It carries only `modeledGate: ROLLBACK_DRILL`, `syntheticOnly: true`, `productionGateSatisfied: false`, `productionSubmissionAllowed: false`, and `cutoverAuthorityAttached: false`. It cannot be submitted as real readiness evidence.

## Production detachment

31-P exports the drill boundary but does not attach it to family-data runtime, device-secret runtime, readiness ledger, protected journal, local administration, IPC, filesystem, SQLite, environment, network, vault, protected provider, backup system, or any real data path. Real crash/restart, backup integrity, recovery timing, protected-journal recovery, stale-lease recovery, operator receipt, and production abort criteria remain unproven or detached.

DEC-171 through DEC-176 are not replaced or weakened. The Desktop vault and active SQLite session remain authoritative. No production readiness gate is marked PASS, no requirement is declared COMPLETE, and no new Build is issued.
