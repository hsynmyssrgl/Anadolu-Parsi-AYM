# 31-M signed cutover-readiness evidence verifier boundary

Status: `LOCAL_PASS_AWAITING_LIBRARY_RECEIPT`

## Delivered boundary

- Ed25519 verification-only implementation accepting only a public Node `KeyObject`.
- Versioned canonical payload binds algorithm, key identifier, epoch, gate, status, and evidence digest.
- Exact claim keys and canonical unpadded Base64URL with an exact 64-byte signature.
- PEM strings, private keys, unsupported algorithms, malformed claims, and extra fields fail closed.
- Exported Core Service boundary with no readiness-ledger or runtime wiring.

## Clean validation

- Contract: 83/83 PASS.
- Root TypeScript: 0 diagnostics.
- Affected package builds: 2/2 PASS.
- Targeted Vitest: 28/28 in 8 files.
- Runtime gates: 8/8 PASS.
- Security and predecessor regressions: 18/18 PASS.
- Full Vitest: 201/201 in 40 files.
- Electron main and renderer production builds: PASS.
- Platform Policy: PASS; new bypass count 0.

## Open boundaries

No production verification-key authority, signer, private material, key rotation/revocation, runtime attachment, durable journal adapter, real family-data transfer, SQLite ownership transfer, or cutover authority is attached. DEC-171 remains active and blocked; DEC-172 and DEC-173 remain active. Requirements remain open and no new Build is issued.

Initial failed attempts are retained in `artifacts/checkpoints/31-M_INITIAL_VALIDATION_FAILURES.json` and are not counted as PASS.
