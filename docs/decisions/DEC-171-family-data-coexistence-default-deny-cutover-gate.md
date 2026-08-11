# DEC-171 — Family-data coexistence and default-deny cutover gate

- Date: 2026-08-10
- Status: ACTIVE
- Scope step: 31-J
- Primary requirement: DHA-001
- Related requirements: PPK-003, PPK-013, PPK-014

## Decision

The existing Desktop-owned encrypted user vault and active SQLite session remain the authoritative production data path. The new headless Core Service architecture may continue to be built and tested beside it, but it must not receive real family data, attach the protected family-data session, or acquire write ownership by default.

The Core Service therefore exposes a typed `family-data-cutover.status` control-plane method whose current contract is statically default-deny. The contract reports that the legacy Desktop data path is active, real-data transfer and write-ownership transfer are forbidden, automatic activation is forbidden, and no cutover authority is attached. It exposes neither a persistent path nor secret material.

The Core Service composition boundary also rejects protected family-data session attachment with `FAMILY_DATA_CUTOVER_BLOCKED`. The low-level ownership runtime remains available for isolated development and tests, but the production composition boundary cannot reach it while this decision is active.

Desktop startup verifies the cutover status independently and fails closed on any contradictory or permissive response. Architecture and cutover status must agree.

## Mandatory acceptance gates before a future cutover

All of the following must be independently PASS before a future, separately versioned decision may replace this block:

1. End-to-end security validation.
2. Device-secret and key-lifecycle proof, including bounded plaintext lifetime and shutdown sealing.
3. Single-writer proof preventing simultaneous Desktop/Core Service write ownership.
4. Tested rollback and recovery drill.
5. Explicit user cutover approval.

User approval alone does not bypass the technical gates. No API in 31-J can enable cutover.

## Non-claims

- No real vault or SQLite ownership transfer is performed.
- No family data, key, password, token, database path, or Google Drive path is added to the status protocol.
- No Windows Service installation is performed.
- No requirement is declared COMPLETE and no new Build is issued.
