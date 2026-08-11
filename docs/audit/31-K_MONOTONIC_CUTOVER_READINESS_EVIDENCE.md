# 31-K Monotonic cutover-readiness evidence

## Outcome

31-K adds an evidence-only readiness control plane beside the immutable 31-J cutover block. It does not move, open, attach, read, or write the Desktop vault or SQLite database.

Accepted evidence is constrained by four independent fail-closed boundaries:

1. No PASS can be appended without an injected trusted verifier.
2. Epoch advances by exactly one and each gate may transition from pending to PASS only once.
3. Every accepted record binds the preceding hash through a canonical SHA-256 chain.
4. A non-empty restored chain requires an exact separately trusted epoch, entry-count, and head-hash anchor.

Desktop startup independently verifies the exact response shape, gate order, epoch sequence, unique gate identity, evidence digests, prior hashes, recomputed entry hashes, head hash, aggregate state, privacy flags, and continued blocked decision.

## Safety properties

- Readiness is not cutover authority.
- All five gates PASS still yields `all-gates-pass-cutover-still-blocked`.
- DEC-171 remains ACTIVE.
- Automatic activation and authority attachment remain false.
- The API has no readiness mutation method.
- Verification bindings, paths, keys, passwords, tokens, family data, and SQLite details are not returned.
- Restored records with added fields are rejected rather than copied to status output.

## Open boundaries

- A production evidence verifier is not attached; default runtime cannot accept PASS evidence.
- A durable protected readiness journal and its protected trusted anchor are not attached.
- No production gate is claimed PASS by this step.
- Real vault transfer, Core Service unlock, and SQLite ownership transfer remain blocked or incomplete.
- Windows Service installation is not run and is not PASS.
- No requirement is declared COMPLETE and no new Build is issued.

## Validation truth

Only checks actually executed and recorded under `artifacts/validation` count as PASS. Initial EPERM, stale `dist`, and strip-only TypeScript compatibility failures remain classified as failed attempts until corrected reruns pass; they are not converted into successful executions.
