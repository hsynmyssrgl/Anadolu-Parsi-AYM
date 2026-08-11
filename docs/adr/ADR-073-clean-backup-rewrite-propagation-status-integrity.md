# ADR-073 — Clean backup rewrite propagation status integrity

Build 200 requires the terminal clean-rewrite outcome to match the linked propagation outcome. `success` may link only to a `success` propagation and `partial` only to a `partial` propagation. Repository and SQLite checks are both fail-closed.
