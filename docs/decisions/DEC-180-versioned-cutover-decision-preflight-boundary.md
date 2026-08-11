# DEC-180 — Versioned cutover decision preflight detached no-authority boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-S
- Predecessor: DEC-179 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE and blocked

## Decision

Core Service receives a pure read-only preflight for assessing whether a future, separately versioned successor cutover decision could be considered. The instruction that applies 31-S authorizes only this code and governance boundary; it does not create a successor decision, grant family-data cutover consent, replace DEC-171, or permit activation.

The preflight requires exactly five canonical readiness gates: end-to-end security validation, key-lifecycle proof, single-writer proof, rollback drill, and explicit user cutover approval. The top-level input and every gate require exact plain-data key sets. Missing, unknown, duplicated, accessor-backed, or extra-field values fail closed. PASS gates require globally unique, non-genesis lowercase SHA-256 evidence; pending gates require null evidence.

The readiness-ledger epoch and entry count must be safe integers, equal to one another, and equal to the exact PASS gate count. The authoritative-source and readiness-ledger-head seals must be non-genesis lowercase SHA-256 values. The expected and observed source seals must match exactly. Both readiness-ledger integrity and a trusted anchor are independently mandatory before successor-decision eligibility can be true.

The preflight digest is calculated in fixed canonical gate order and is independent of input order. The result does not expose raw gate evidence, source seals, or ledger head. Even when eligible, the result remains `currentDecision: DEC-171`, `decision: blocked`, `successorDecisionRequired: true`, `successorDecisionCreated: false`, and `versionedDecisionSubmissionPerformed: false`. Eligibility is informational only and is not cutover authority.

## Production detachment

31-S exports the preflight boundary but does not attach it to Core Service runtime, family-data runtime, device-secret runtime, readiness ledger, protected journal, local administration, IPC, filesystem, SQLite, environment, network, vault, protected provider, approval UI, identity authority, production verifier, or any real data path. It performs no independent evidence verification and creates no user consent, successor decision, data transfer, writer transfer, activation, or cutover command.

DEC-171 through DEC-179 are not replaced or weakened. The Desktop vault and active SQLite session remain authoritative. No readiness gate is marked PASS, no requirement is declared COMPLETE, no new Build is issued, and a separate explicit versioned user decision remains mandatory before any future cutover.
