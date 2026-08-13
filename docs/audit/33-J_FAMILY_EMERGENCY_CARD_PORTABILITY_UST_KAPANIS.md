# 33-J upper closure — Governed offline emergency card portability

- Date: 13.08.2026
- Decision: DEC-221
- Requirements: B5-03, EXT-016
- Implementation status: COMPLETE; local validation and full-suite evidence PASS
- Persistence: Migration 88 (`b5_family_emergency_card_portability_ledger`)

## Implemented boundary

33-J provides explicit closed-field card configuration, print/PDF output, encrypted
document packs and manual battery-conscious mode on the independent private 33-I
emergency profile. Migration 88 is append-only and binds every row to exact profile,
family, owner, private scope, canonical time and durable policy receipt.

Local export is governed by an operation-bound strong-auth proof and exact
`share/file.share` authority. A unique internal share-receipt hash binds successful
completion to the same selection digest without reusing the globally unique receipt
correlation. The hash and sensitive selection content never enter renderer, audit or
outbox projections.

The three modes are `print`, `pdf`, and `encrypted_pack`. File modes require atomic
publication and verified byte/hash readback. Only encrypted packs may include at most
10 separately authorized high-sensitivity archive documents. The pack uses an
independent random DEK, password-derived scrypt KEK and AES-256-GCM; no plaintext
temporary file or vault-key reuse occurs.

Battery percentage and automatic low-battery detection remain explicitly
`not_measured` / `not_performed`; `lowBatteryClaimed=false`. No cloud, message,
emergency-service or other network delivery is performed.

## Evidence chain

- `artifacts/validation/33-J-family-emergency-card-portability-boundary.json`
- `artifacts/validation/33-J-family-emergency-card-portability-contract.json`
- `artifacts/validation/33-J-family-emergency-card-portability-runtime.json`
- `packages/application/tests/family-emergency-card-portability.test.ts`
- `packages/repositories/family-emergency-card-portability-repository-policy.test.ts`
- `packages/security/tests/emergency-portable-pack.test.ts`
- `apps/desktop/tests/b5-family-emergency-card-portability-ipc-integration.test.ts`
- `artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json`
- `docs/security/THREAT_MODEL_33_J_FAMILY_EMERGENCY_CARD_PORTABILITY.md`
- `config/33-j-family-emergency-card-portability-scope.json`
- `config/33-j-family-emergency-card-portability-inventory.json`

Current platform ratchets are PPK-021 554 exact allowlist / 281 use-case composition and
PPK-022 246 exact capability surfaces. Migration 88 checksum is
`8785551a6ce0facd609e374e7ba65c70d35b552e6f63a7f0b3d790bfbffa2b04`.

Local verification is PASS at 62/62 boundary, 16/16 contract and 12/12 runtime checks,
with 24/24 tests in four targeted files. The full Vitest run is PASS at 125/125 test
files and 1038/1038 tests in 213.10 seconds. All 18/18 production workspace builds are
PASS, including the Electron and Vite desktop production build. This source closure
does not replace the persistent Library receipt or the 33-J completion transition.
