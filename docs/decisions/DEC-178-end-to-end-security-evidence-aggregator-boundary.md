# DEC-178 — End-to-end security evidence aggregator detached non-submittable boundary

- Date: 2026-08-11
- Status: ACTIVE
- Scope step: 31-Q
- Predecessor: DEC-177 remains ACTIVE
- Readiness decision: DEC-172 remains ACTIVE
- Cutover decision: DEC-171 remains ACTIVE and blocked

## Decision

Core Service receives a pure synthetic end-to-end security evidence aggregator for exactly seven canonical controls: local-admin authentication, protocol default-deny, replay rejection, journal-tamper rejection, secret redaction, persistent-path redaction, and shutdown sealing.

Every observation requires the exact `controlId`, `outcome`, `evidenceDigest`, and `verifierBound` key set. The control must be recognized, `verifierBound` must be true, and the digest must be lowercase non-genesis SHA-256 format and globally unique across all controls. Each control is monotonic and non-replaceable; a failed observation cannot later be upgraded to PASS.

The candidate is available only when all seven controls have immutable PASS observations. Its digest is calculated in fixed canonical control order and is independent of insertion order. The aggregator does not run any security exercise and does not independently verify process-level evidence.

The evidence candidate does not expose production-like `gateId`. It carries only `modeledGate: END_TO_END_SECURITY_VALIDATION`, `syntheticOnly: true`, `productionGateSatisfied: false`, `productionSubmissionAllowed: false`, `automaticActivationAllowed: false`, and `cutoverAuthorityAttached: false`. It cannot be submitted as real readiness evidence.

## Production detachment

31-Q exports the aggregator boundary but does not attach it to family-data runtime, device-secret runtime, readiness ledger, protected journal, local administration, IPC, filesystem, SQLite, environment, network, vault, protected provider, security runner, or any real data path. Real executions of all seven controls, production signing and verification authority, operator receipts, and real rollback recovery remain unproven or detached.

DEC-171 through DEC-177 are not replaced or weakened. The Desktop vault and active SQLite session remain authoritative. No production readiness gate is marked PASS, no automatic activation is allowed, no requirement is declared COMPLETE, and no new Build is issued.
