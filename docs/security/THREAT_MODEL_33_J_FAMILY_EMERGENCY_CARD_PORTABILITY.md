# 33-J threat model — Offline emergency card portability

## Sensitive assets and trust roots

33-J exports a user-selected subset of a fixed-private 33-I emergency profile. Health
facts, contact details, assistance instructions and archive documents are
`highly_sensitive`. The emergency plan link does not grant visibility. The only policy
root is the independently authorized emergency profile.

## Confused deputy and field overreach

Renderer input cannot supply arbitrary keys, paths or content. Application and SQLite
enforce a closed source-item/field-code matrix, current non-superseded sources, the same
profile/family/owner/private scope, at most 64 fields and at most 10 documents. Archive
links additionally require same-family, undestroyed, exact `high` sensitivity and a
separate authorized in-memory read. Print and plain PDF reject documents.

## Share-to-completion replay

Preparation requires exact `share/file.share/life_record/profileId` authority with
purpose `emergency-offline-portability` and a canonical selection digest. Completion
uses a fresh update receipt and stores the prior durable share receipt hash only in the
internal row. The database verifies exact family, owner, actor, profile, purpose and
selection, permits at most five minutes, and consumes the share hash once. Correlation
ids are not reused. Cross-selection, stale proof, replay and cross-ledger receipt/ID
reuse fail closed.

## Strong-auth replay and renderer compromise

Strong authentication is bound to the renderer session, profile, operation and
selection. The proof is short-lived and single-operation; a generic boolean grant is
never accepted. Paths, passphrases, TOTP values, selected health content, policy receipt
material and `shareReceiptHash` are not persisted in the public view or returned to the
renderer.

## Plaintext and cryptographic failure

Encrypted packs use an independent random DEK, scrypt password-derived KEK and
AES-256-GCM. Device/archive vault keys are not reused. No plaintext temporary file is
created. Atomic publish plus parse/decrypt/hash readback must complete before the
append-only `export_event` is recorded. Artifact size is capped at 64 MiB. Authentication
failure, truncation, hash drift or publish collision produces no success event.

## Filesystem race and partial publication

Main-process publication owns dialog, exclusive staging, fsync, hard-link publication,
readback and cleanup. Existing targets are never overwritten. A crash may leave only a
bounded staging artifact; it cannot produce a success event without verified readback.

## Battery and external-service truth

The product observes only `battery`, `ac`, or `unknown`. It does not measure battery
percentage and does not automatically detect a low threshold. Therefore
`batteryLevel=not_measured`, `automaticLowBatteryDetection=not_performed`, and
`lowBatteryClaimed=false` are immutable truth fields. Production activation is manual;
the battery-prompt enum is reserved and not exposed. No upload, message, emergency
service or other network egress is added.

## Append-only integrity

Migration 88 rejects updates and deletes. Profile, configuration, selected source,
archive, canonical time, receipt, selection digest, counts, output-mode truth and power
truth are checked at insertion. Reverse fences prevent future writes in existing
ledgers from reusing a portability receipt or ID.
