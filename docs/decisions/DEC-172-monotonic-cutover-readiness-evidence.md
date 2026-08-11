# DEC-172 — Monotonic cutover-readiness evidence and tamper-evident acceptance state

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-K
- Predecessor: DEC-171 remains ACTIVE
- Primary requirement: DHA-001
- Related requirements: PPK-003, PPK-013, PPK-014

## Decision

The five mandatory family-data cutover gates receive an evidence-only control plane that is separate from the cutover decision. Accepted PASS claims advance by exactly one epoch, are independently keyed by gate identity, and are bound to the preceding record through a canonical SHA-256 chain.

A new PASS cannot be recorded unless a trusted evidence verifier is attached. A non-empty journal cannot be restored unless its exact epoch, entry count, and head hash match a separately trusted anchor. Replays, epoch gaps or regression, completed-gate replacement, record mutation, record deletion, unrecognized gates, and malformed evidence digests fail closed.

The local-administration API is read-only. It returns gate status, evidence digests, epochs, and chain hashes only. It does not return evidence verification bindings, persistent paths, keys, passwords, tokens, family data, or SQLite details.

Desktop startup recomputes the full chain and rejects structural contradictions, permissive authority fields, false aggregate PASS state, added fields, deleted records, and invalid head hashes with `ARCHITECTURE_MISMATCH`.

## Cutover boundary

DEC-171 is not replaced or weakened. Even when all five gates are independently PASS:

- the decision remains `blocked`;
- no cutover authority is attached;
- automatic activation remains forbidden;
- the Desktop vault and active SQLite session remain authoritative;
- a separate, versioned, explicit user decision is still mandatory.

The production evidence signer and durable protected readiness journal are not attached in this step. Their absence is default-deny and cannot be represented as PASS.

## Non-claims

- No real family data, vault, or SQLite ownership is transferred.
- No production gate is claimed PASS by 31-K itself.
- No Windows Service installation is performed.
- No requirement is declared COMPLETE and no new Build is issued.
