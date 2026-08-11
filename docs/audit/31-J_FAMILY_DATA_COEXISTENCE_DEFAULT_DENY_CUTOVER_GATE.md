# 31-J Family-data coexistence and default-deny cutover gate

## Outcome

31-J strengthens the new Core Service architecture without moving the existing production data path. The Desktop-owned encrypted vault and active SQLite session remain authoritative.

The new control plane is default-deny in three independent places:

1. The typed protocol can only report a blocked cutover in this version.
2. The Core Service composition boundary throws `FAMILY_DATA_CUTOVER_BLOCKED` before a protected family-data session can be attached.
3. Desktop startup rejects permissive, contradictory, path-exposing, secret-exposing, automatic, or pre-authorized cutover status.

## Security properties delivered

- No API exists to enable the cutover.
- Real family-data transfer is false.
- Write-ownership transfer is false.
- Automatic activation is false.
- Cutover authority attachment is false.
- Persistent path and secret material exposure are false.
- Five future acceptance gates remain pending and exact-order verified.
- An enable-shaped local-admin payload is rejected as invalid.

## Boundaries that remain open

- Real vault transfer and SQLite ownership transfer are not performed and remain blocked.
- Core Service unlock, family application APIs, backup and sync remain incomplete.
- Windows Service installation remains approval-bound and is not run or claimed PASS.
- Requirements remain open; no new Build is issued.

## Validation evidence

The machine-readable validation, regression, production-build, and persistent-receipt evidence is recorded under `artifacts/validation`, `artifacts/checkpoints`, and the D: external Library checkpoint for 31-J.
