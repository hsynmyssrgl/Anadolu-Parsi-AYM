# DEC-174 — Signed cutover-readiness evidence verifier public-key-only boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-M
- Predecessor: DEC-173 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE
- Primary requirement: DHA-001
- Related requirements: PPK-003, PPK-013, PPK-014

## Decision

Core Service receives a public-key-only Ed25519 verifier for DEC-172 readiness PASS claims. The verifier accepts only a Node `KeyObject` whose type is `public` and asymmetric key type is `ed25519`; it does not accept or parse PEM text and rejects private key objects. The verifier retains only that public key object and a constrained non-secret key identifier.

The signed canonical payload is versioned and domain-separated. It binds the Ed25519 algorithm, key identifier, exact epoch, gate identifier, `pass` state, and lowercase SHA-256 evidence digest. The verification binding must be canonical unpadded Base64URL that decodes to exactly 64 bytes and round-trips byte-for-byte. Claim objects with added fields, invalid epochs, unknown gates, invalid digests, non-canonical signatures, or modified signed fields return false without throwing.

31-M exports the verifier boundary but does not attach it to the readiness ledger or Core Service runtime. No production verification-key authority, key rotation, revocation, private signer, environment fallback, filesystem path, SQLite dependency, real data, or write-owner transition is introduced. Test-only ephemeral private keys prove verification behavior and are not production signing material.

## Cutover boundary

DEC-171, DEC-172, and DEC-173 are not replaced or weakened:

- production readiness PASS remains impossible without a separately governed trusted verifier attachment;
- the new verifier class alone grants neither evidence acceptance nor cutover authority;
- all-gates-PASS still leaves cutover `blocked` and requires a separate versioned explicit user decision;
- the Desktop vault and active SQLite session remain authoritative;
- no local-administration method exposes a key, signature, path, secret, token, or family data.

## Non-claims

- Public-key verification code is not a production signer or key-authority attachment.
- Unit tests are not production evidence or key-rotation proof.
- No readiness gate is marked PASS by 31-M.
- No Windows Service installation is performed.
- No requirement is declared COMPLETE and no new Build is issued.
