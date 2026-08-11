# DEC-175 — Synthetic single-writer proof harness detached non-authoritative boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-N
- Predecessor: DEC-174 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE and blocked
- Primary requirement: DHA-001
- Related requirements: PPK-003, PPK-013, PPK-014

## Decision

Core Service receives a pure synthetic state machine that models exactly one writable owner, initially Desktop as required by DEC-171. Every proposed transfer must provide the exact transfer key set, the current safe-integer epoch, the current synthetic proof-chain head, distinct recognized owners, owner-aligned writable flags, and a new lowercase SHA-256-format synthetic proof digest.

Dual-writer and zero-writer proposals fail closed. Stale epochs, stale proof heads, repeated proof digests, extra fields, invalid owners, invalid flags, and malformed digests are rejected. A rejected transition leaves the immutable current snapshot unchanged.

Every snapshot explicitly states `syntheticOnly: true`, `realGateSatisfied: false`, `cutoverAuthorityAttached: false`, and `realDataAccessed: false`. The harness output is non-authoritative test evidence and can never by itself satisfy the real `SINGLE_WRITER_PROOF` readiness gate.

## Production detachment

31-N exports the harness boundary but does not wire it into the Core Service runtime, Desktop startup, readiness ledger, protected journal, local administration API, IPC, filesystem, SQLite, environment, network, real vault, or family-data ownership path. No production writer lease, process-crash proof, restart proof, stale-lease recovery, rollback recovery, signer, verifier-key authority, or cutover authority is attached.

DEC-171, DEC-172, DEC-173, and DEC-174 are not replaced or weakened. The Desktop vault and active SQLite session remain authoritative. No production readiness gate is marked PASS, no requirement is declared COMPLETE, and no new Build is issued.
