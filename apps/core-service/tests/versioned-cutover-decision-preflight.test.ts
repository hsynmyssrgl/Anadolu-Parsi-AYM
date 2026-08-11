import { describe, expect, it } from 'vitest';
import {
  VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES,
  evaluateVersionedCutoverDecisionPreflight,
  type VersionedCutoverDecisionPreflightInput,
  type VersionedCutoverPreflightGateId
} from '../src/versioned-cutover-decision-preflight.js';

const SOURCE_HASH = '1'.repeat(64);
const LEDGER_HEAD_HASH = '2'.repeat(64);
const digest = (index: number): string => index.toString(16).padStart(64, '0');
const passGates = (order: readonly VersionedCutoverPreflightGateId[] = VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES) =>
  order.map((id) => ({
    id,
    status: 'pass' as const,
    evidenceDigest: digest(VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.indexOf(id) + 3)
  }));
const validInput = (): VersionedCutoverDecisionPreflightInput => ({
  expectedAuthoritativeSourceSha256: SOURCE_HASH,
  observedAuthoritativeSourceSha256: SOURCE_HASH,
  readinessLedgerEpoch: 5,
  readinessLedgerEntryCount: 5,
  readinessLedgerHeadHash: LEDGER_HEAD_HASH,
  readinessLedgerIntegrityVerified: true,
  readinessLedgerTrustedAnchorAttached: true,
  gates: passGates()
});

describe('31-S prepared versioned cutover decision preflight', () => {
  it('remains blocked and non-authoritative even when successor-decision eligible', () => {
    const result = evaluateVersionedCutoverDecisionPreflight(validInput());
    expect(result).toMatchObject({
      schemaVersion: 1,
      preflightClass: 'read-only-successor-decision-preflight-non-authoritative',
      currentDecision: 'DEC-171',
      decision: 'blocked',
      allRequiredGatesPass: true,
      authoritativeSourceSealVerified: true,
      readinessLedgerIntegrityVerified: true,
      readinessLedgerTrustedAnchorAttached: true,
      readinessLedgerEvidenceReady: true,
      eligibleForSuccessorDecision: true,
      successorDecisionRequired: true,
      successorDecisionCreated: false,
      versionedDecisionSubmissionPerformed: false,
      productionRuntimeWiring: false,
      independentEvidenceVerificationPerformed: false,
      userConsentCreatedByBoundary: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false,
      realDataTransferAllowed: false,
      writeOwnershipTransferAllowed: false
    });
    expect(result.preflightDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.reasons).toContain('SEPARATE_VERSIONED_SUCCESSOR_DECISION_REQUIRED');
    expect('gateId' in result).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
  });

  it('uses canonical gate order so the digest is insertion-order independent', () => {
    const forward = evaluateVersionedCutoverDecisionPreflight(validInput());
    const reverse = evaluateVersionedCutoverDecisionPreflight({
      ...validInput(),
      gates: passGates([...VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES].reverse())
    });
    expect(reverse.preflightDigest).toBe(forward.preflightDigest);
  });

  it('is ineligible when one gate is pending without granting any authority', () => {
    const gates = passGates().map((gate) => gate.id === 'EXPLICIT_USER_CUTOVER_APPROVAL'
      ? { ...gate, status: 'pending' as const, evidenceDigest: null }
      : gate);
    const result = evaluateVersionedCutoverDecisionPreflight({
      ...validInput(),
      readinessLedgerEpoch: 4,
      readinessLedgerEntryCount: 4,
      gates
    });
    expect(result).toMatchObject({
      decision: 'blocked',
      allRequiredGatesPass: false,
      eligibleForSuccessorDecision: false,
      successorDecisionCreated: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false
    });
    expect(result.reasons).toContain('ALL_INDEPENDENT_GATES_MUST_PASS');
  });

  it('reports source-seal, integrity, and trusted-anchor blockers independently', () => {
    const sourceMismatch = evaluateVersionedCutoverDecisionPreflight({ ...validInput(), observedAuthoritativeSourceSha256: '9'.repeat(64) });
    const integrityMissing = evaluateVersionedCutoverDecisionPreflight({ ...validInput(), readinessLedgerIntegrityVerified: false });
    const anchorMissing = evaluateVersionedCutoverDecisionPreflight({ ...validInput(), readinessLedgerTrustedAnchorAttached: false });
    expect(sourceMismatch.reasons).toContain('AUTHORITATIVE_SOURCE_SEAL_MISMATCH');
    expect(integrityMissing.reasons).toContain('READINESS_LEDGER_INTEGRITY_REQUIRED');
    expect(anchorMissing.reasons).toContain('READINESS_LEDGER_TRUSTED_ANCHOR_REQUIRED');
    expect([sourceMismatch, integrityMissing, anchorMissing].every((result) => !result.eligibleForSuccessorDecision)).toBe(true);
  });

  it('rejects extra input fields and accessor-backed input before evaluation', () => {
    expect(() => evaluateVersionedCutoverDecisionPreflight({ ...validInput(), extra: true }))
      .toThrowError(expect.objectContaining({ code: 'INPUT_MALFORMED' }));
    const accessor = { ...validInput() } as Record<string, unknown>;
    Object.defineProperty(accessor, 'readinessLedgerHeadHash', { enumerable: true, get: () => LEDGER_HEAD_HASH });
    expect(() => evaluateVersionedCutoverDecisionPreflight(accessor))
      .toThrowError(expect.objectContaining({ code: 'INPUT_MALFORMED' }));
  });

  it('rejects missing, duplicate, unknown, and polluted gate sets', () => {
    const valid = passGates();
    const cases = [
      valid.slice(0, 4),
      valid.map((gate, index) => index === 4 ? { ...valid[0]! } : gate),
      valid.map((gate, index) => index === 4 ? { ...gate, id: 'UNKNOWN' } : gate),
      valid.map((gate, index) => index === 4 ? { ...gate, extra: true } : gate)
    ];
    for (const gates of cases) {
      expect(() => evaluateVersionedCutoverDecisionPreflight({ ...validInput(), gates }))
        .toThrowError(expect.objectContaining({ code: expect.stringMatching(/GATE_SET_INVALID|GATE_DUPLICATE/u) }));
    }
  });

  it('rejects contradictory pending and PASS gate evidence states', () => {
    const pendingWithEvidence = passGates().map((gate, index) => index === 0 ? { ...gate, status: 'pending' as const } : gate);
    const passWithoutEvidence = passGates().map((gate, index) => index === 0 ? { ...gate, evidenceDigest: null } : gate);
    expect(() => evaluateVersionedCutoverDecisionPreflight({ ...validInput(), gates: pendingWithEvidence }))
      .toThrowError(expect.objectContaining({ code: 'GATE_STATE_INVALID' }));
    expect(() => evaluateVersionedCutoverDecisionPreflight({ ...validInput(), gates: passWithoutEvidence }))
      .toThrowError(expect.objectContaining({ code: 'DIGEST_INVALID' }));
  });

  it('rejects malformed or genesis source, ledger-head, and evidence digests', () => {
    const cases = [
      { ...validInput(), expectedAuthoritativeSourceSha256: '0'.repeat(64) },
      { ...validInput(), observedAuthoritativeSourceSha256: 'INVALID' },
      { ...validInput(), readinessLedgerHeadHash: '0'.repeat(64) },
      { ...validInput(), gates: passGates().map((gate, index) => index === 0 ? { ...gate, evidenceDigest: '0'.repeat(64) } : gate) }
    ];
    for (const input of cases) {
      expect(() => evaluateVersionedCutoverDecisionPreflight(input))
        .toThrowError(expect.objectContaining({ code: 'DIGEST_INVALID' }));
    }
  });

  it('rejects evidence digest reuse across distinct gates', () => {
    const gates = passGates().map((gate, index) => index === 1 ? { ...gate, evidenceDigest: digest(3) } : gate);
    expect(() => evaluateVersionedCutoverDecisionPreflight({ ...validInput(), gates }))
      .toThrowError(expect.objectContaining({ code: 'EVIDENCE_REUSED' }));
  });

  it('rejects unsafe or inconsistent ledger epoch and entry counters', () => {
    const cases = [
      { ...validInput(), readinessLedgerEpoch: 4 },
      { ...validInput(), readinessLedgerEntryCount: 4 },
      { ...validInput(), readinessLedgerEpoch: -1 },
      { ...validInput(), readinessLedgerEntryCount: 1.5 },
      { ...validInput(), readinessLedgerEpoch: 6, readinessLedgerEntryCount: 6 }
    ];
    for (const input of cases) {
      expect(() => evaluateVersionedCutoverDecisionPreflight(input))
        .toThrowError(expect.objectContaining({ code: 'LEDGER_SNAPSHOT_INVALID' }));
    }
  });

  it('does not expose gate evidence digests, source seals, or the ledger head', () => {
    const serialized = JSON.stringify(evaluateVersionedCutoverDecisionPreflight(validInput()));
    expect(serialized).not.toContain(SOURCE_HASH);
    expect(serialized).not.toContain(LEDGER_HEAD_HASH);
    for (let index = 3; index <= 7; index += 1) expect(serialized).not.toContain(digest(index));
  });

  it('does not mutate caller input or create a successor decision', () => {
    const input = validInput();
    const before = JSON.stringify(input);
    const result = evaluateVersionedCutoverDecisionPreflight(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result).toMatchObject({ currentDecision: 'DEC-171', decision: 'blocked', successorDecisionCreated: false });
  });
});
