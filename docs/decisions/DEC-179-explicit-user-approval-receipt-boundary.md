# DEC-179 — Explicit user approval receipt detached no-cutover boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-R
- Predecessor: DEC-178 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE and blocked

## Decision

Core Service receives a pure receipt-intake boundary for a future explicit family-data cutover approval. The instruction that applies 31-R authorizes only this code and governance boundary; it is not user consent to transfer family data, change the writable owner, activate Core Service, or perform cutover.

The boundary requires exactly four distinct technical gates to have exact-shape PASS states before it evaluates any receipt: end-to-end security validation, key-lifecycle proof, single-writer proof, and rollback drill. User approval cannot bypass a missing, pending, duplicated, unknown, or polluted technical gate. Test PASS objects are synthetic inputs and are not production gate evidence.

The default composition has no approval verifier and rejects every receipt. A candidate receipt must use the exact plain-data key set, a versioned decision identity, the explicit `approve-family-data-cutover` action, a pseudonymous approval subject, non-genesis lowercase SHA-256 bindings for both the authoritative source and readiness-ledger head, canonical UTC timestamps, and a bounded verification binding. It must match both expected hashes exactly, be live at evaluation time, and have a lifetime of no more than fifteen minutes. Accessor-backed or extra-field objects, verifier rejection or exception, non-boolean verifier success, and clock failure all fail closed.

Successful evaluation means only that the receipt evidence is eligible for a future readiness-ledger submission. The evaluation remains `decision: blocked`, exposes only `modeledGate: EXPLICIT_USER_CUTOVER_APPROVAL`, and performs no ledger submission or receipt consumption. The evidence digest binds every receipt field, including the verification binding, while the raw receipt and binding are not returned. No production-like `gateId`, cutover authority, automatic activation, runtime attachment, data access, or successor cutover decision is provided.

## Production detachment

31-R exports the intake boundary but does not attach it to Core Service runtime, family-data runtime, device-secret runtime, readiness ledger, protected journal, local administration, IPC, filesystem, SQLite, environment, network, vault, protected provider, approval UI, identity provider, production verifier, or any real data path. It creates no approval receipt and records no real user consent.

DEC-171 through DEC-178 are not replaced or weakened. The Desktop vault and active SQLite session remain authoritative. No readiness gate is marked PASS, no requirement is declared COMPLETE, no new Build is issued, and a separate explicit versioned successor decision remains mandatory before any future cutover.
