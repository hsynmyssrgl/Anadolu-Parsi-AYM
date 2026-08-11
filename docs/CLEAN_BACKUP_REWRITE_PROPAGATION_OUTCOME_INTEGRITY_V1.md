# Clean Backup Rewrite Propagation Outcome Integrity V1

Build 199 binds `propagation_run_id` to the terminal result semantics.

- `success` and `partial` require a propagation run identifier.
- `running`, `failed`, `attention`, `deferred`, and `interrupted` prohibit a propagation run identifier.
- Repository validation rejects mismatched input before persistence.
- SQLite migration 43 enforces the same rule for direct writes.
