# ADR-075 — Propagation reference permanence

## Decision
SQLite BEFORE DELETE and BEFORE UPDATE OF id triggers protect `backup_propagation_runs` rows referenced by `backup_clean_rewrite_runs.propagation_run_id`.

## Consequence
Referenced propagation evidence remains resolvable. Unreferenced propagation rows remain maintainable.
