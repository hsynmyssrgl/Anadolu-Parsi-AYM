# DEC-142 — PPK-002 journal proof and rollback anchor

## Decision

30-Q continues the started PPK-002 work with the two highest-impact journal integrity boundaries left open by 30-P:

1. A journal projection cannot be acknowledged from a void return value. The protected sink must return an HMAC-authenticated proof bound to the exact canonical record, receipt identity, entry sequence, entry hash and read-back journal head.
2. SQLite persists that proof on the outbox row and advances a monotonic journal-head anchor in the same acknowledgement transaction.
3. Before projection recovery or a new archive authorization, the production runtime verifies the persisted anchor against the current protected journal. An older but internally valid complete tail therefore fails closed.

## Deliberate boundary

The SQLite anchor is independent of the journal file and detects journal-only rollback. It is not an external monotonic service and does not claim protection when an attacker rolls back the database and journal together. Universal direct-SQL archive enforcement, new-correlation operation idempotency, replay pruning, obligations, secure file deletion/database atomicity, and installed Core Service evidence remain open.

## Authority

DEC-137 permits full-auto priority selection after a persistent predecessor receipt. 30-P is completed with a PASS Library receipt and readback chain.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
