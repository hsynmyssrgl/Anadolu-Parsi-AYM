# DEC-173 — Protected cutover-readiness journal port and detached default-deny boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-L
- Predecessor: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE
- Primary requirement: DHA-001
- Related requirements: PPK-003, PPK-013, PPK-014

## Decision

Core Service receives a typed asynchronous persistence port for the cutover-readiness journal and its trusted anchor. The boundary can load an exact snapshot, compare-and-swap an expected anchor to a next snapshot, and seal the persistence provider. An anchor is limited to the exact journal epoch, entry count, and head hash already required by DEC-172.

The production composition remains detached. Its `available` value is false, its `protectionId` is null, and every operational method rejects with `JOURNAL_UNAVAILABLE`. In particular, an unavailable load cannot masquerade as an empty successful journal, and an unavailable seal cannot masquerade as successful persistence.

31-L exports the boundary but does not wire it into the readiness ledger or Core Service runtime. It introduces no filesystem, SQLite, Electron, environment-secret, storage-path, protection-key, or real-data dependency. A future durable adapter must separately prove protected-anchor binding, crash consistency, compare-and-swap correctness, and shutdown sealing before it can be attached.

## Cutover boundary

DEC-171 and DEC-172 are not replaced or weakened:

- the Desktop vault and active SQLite session remain authoritative;
- the readiness ledger remains evidence-only and cutover remains `blocked`;
- no production evidence signer or durable journal adapter is attached;
- no real data or write ownership moves;
- no status or local-administration API exposes a path, key, token, secret, or family data;
- a separate versioned explicit user decision is still required even after all five gates pass.

## Non-claims

- Port availability is not durable persistence proof.
- Unit tests are not crash-consistency or recovery evidence.
- No production gate is marked PASS by 31-L.
- No Windows Service installation is performed.
- No requirement is declared COMPLETE and no new Build is issued.
