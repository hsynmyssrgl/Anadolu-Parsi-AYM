# ADR-102 — Build227 Windows Persistence and Closure Remediation

## Status

Accepted for Build227.

## Context

Exact Build226 real Windows diagnostics proved four independent defects: the sandboxed preload directly imported `node:crypto`; Electron 43.2.0 synchronous and asynchronous `safeStorage` ciphertext did not decrypt in a second process in the tested environment; installer validation depended on a deep path and immediate Unicode-literal file lookup; and OPEN-022 treated an unreported backend name as a failure despite successful cryptographic behavior.

## Decision

- The sandboxed preload uses `globalThis.crypto.randomUUID()` after an explicit availability check. Renderer sandbox, context isolation and disabled Node integration remain mandatory.
- Windows long-lived key envelopes use a synchronous `CurrentUser` DPAPI provider. Payloads travel to a constant encoded PowerShell helper through stdin; plaintext/ciphertext values are never command-line arguments or evidence fields.
- Provider mismatch, invalid ciphertext and undecryptable existing envelopes fail closed. No automatic deletion, rotation or key regeneration occurs.
- OPEN-022 relies on the Windows platform contract plus actual availability, same-process round-trip, two-process persistence, protected-container round-trips and plaintext-leakage checks. `selectedBackend` remains observational.
- Installer validation uses a short temporary root, bounded polling, dynamic executable/uninstaller discovery, dynamic uninstall-record discovery and residue verification.

## Consequences

The selected Windows provider has a real two-process persistence PASS. The previously attempted async Electron `safeStorage` path remains rejected because its two-process proof failed. OPEN-021 EFS, fresh-profile device identity, fatal startup evidence, PR-172 and exact-source binding remain unchanged.
