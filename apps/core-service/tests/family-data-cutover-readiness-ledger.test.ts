import { describe, expect, it } from 'vitest';
import type { CoreServiceFamilyDataCutoverReadinessEntryContract } from '@ppt/core-service-contracts';
import {
  CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES
} from '../src/family-data-cutover-guard.js';
import {
  CoreServiceCutoverReadinessError,
  CoreServiceFamilyDataCutoverReadinessLedger,
  type CoreServiceCutoverReadinessEvidenceClaim,
  type CoreServiceCutoverReadinessEvidenceVerifier
} from '../src/family-data-cutover-readiness-ledger.js';

const clock = (): string => '2026-08-10T21:00:00.000Z';
const digest = (index: number): string => index.toString(16).padStart(64, '0');
const claim = (index: number): CoreServiceCutoverReadinessEvidenceClaim => {
  const gateId = CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES[index - 1];
  const evidenceDigest = digest(index);
  return Object.freeze({
    epoch: index,
    gateId,
    status: 'pass',
    evidenceDigest,
    verificationBinding: `approved:${gateId}:${evidenceDigest}`
  });
};
const verifier: CoreServiceCutoverReadinessEvidenceVerifier = Object.freeze({
  verify: (input: CoreServiceCutoverReadinessEvidenceClaim) =>
    input.verificationBinding === `approved:${input.gateId}:${input.evidenceDigest}`
});

describe('31-K monotonic cutover-readiness evidence ledger', () => {
  it('starts default-deny and cannot accept a fake PASS without an attached verifier', () => {
    const ledger = new CoreServiceFamilyDataCutoverReadinessLedger({ clock });
    expect(ledger.status()).toMatchObject({
      mode: 'monotonic-evidence-no-cutover',
      decision: 'blocked',
      ledgerEpoch: 0,
      entryCount: 0,
      verifierAttached: false,
      allRequiredGatesPass: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false
    });
    expect(() => ledger.append(claim(1))).toThrowError(CoreServiceCutoverReadinessError);
    try {
      ledger.append(claim(1));
    } catch (error) {
      expect(error).toMatchObject({ code: 'EVIDENCE_VERIFIER_UNAVAILABLE' });
    }
    expect(ledger.status()).toMatchObject({ ledgerEpoch: 0, entryCount: 0 });
  });

  it('rejects failed verification, epoch regression, replay and completed-gate replacement', () => {
    const rejecting = new CoreServiceFamilyDataCutoverReadinessLedger({ clock, verifier: { verify: () => false } });
    expect(() => rejecting.append(claim(1))).toThrowError(expect.objectContaining({ code: 'EVIDENCE_REJECTED' }));

    const ledger = new CoreServiceFamilyDataCutoverReadinessLedger({ clock, verifier });
    ledger.append(claim(1));
    expect(() => ledger.append(claim(1))).toThrowError(expect.objectContaining({ code: 'EPOCH_INVALID' }));
    expect(() => ledger.append({ ...claim(2), gateId: claim(1).gateId })).toThrowError(expect.objectContaining({ code: 'STATE_REGRESSION' }));
    expect(ledger.status()).toMatchObject({ ledgerEpoch: 1, entryCount: 1 });
  });

  it('binds accepted evidence to an ordered SHA-256 chain without exposing verification bindings', () => {
    const ledger = new CoreServiceFamilyDataCutoverReadinessLedger({ clock, verifier });
    ledger.append(claim(1));
    const status = ledger.append(claim(2));
    expect(status.entries).toHaveLength(2);
    expect(status.entries[0]?.previousHash).toBe('0'.repeat(64));
    expect(status.entries[1]?.previousHash).toBe(status.entries[0]?.entryHash);
    expect(status.headHash).toBe(status.entries[1]?.entryHash);
    expect(status.requiredGates.slice(0, 2).every((gate) => gate.status === 'pass')).toBe(true);
    expect(status.requiredGates.slice(2).every((gate) => gate.status === 'pending')).toBe(true);
    expect(JSON.stringify(status)).not.toContain('verificationBinding');
    expect(Object.isFrozen(status)).toBe(true);
    expect(Object.isFrozen(status.entries)).toBe(true);
    expect(status.entries.every(Object.isFrozen)).toBe(true);
  });

  it('fails closed on journal deletion, mutation, missing anchors and anchor regression', () => {
    const ledger = new CoreServiceFamilyDataCutoverReadinessLedger({ clock, verifier });
    ledger.append(claim(1));
    const current = ledger.append(claim(2));
    const anchor = { epoch: current.ledgerEpoch, entryCount: current.entryCount, headHash: current.headHash };
    expect(new CoreServiceFamilyDataCutoverReadinessLedger({ clock, restoredEntries: current.entries, trustedAnchor: anchor }).status())
      .toMatchObject({ ledgerEpoch: 2, headHash: current.headHash, trustedAnchorAttached: true });
    expect(() => new CoreServiceFamilyDataCutoverReadinessLedger({ clock, restoredEntries: current.entries }))
      .toThrowError(expect.objectContaining({ code: 'TRUSTED_ANCHOR_REQUIRED' }));
    expect(() => new CoreServiceFamilyDataCutoverReadinessLedger({ clock, restoredEntries: current.entries.slice(0, 1), trustedAnchor: anchor }))
      .toThrowError(expect.objectContaining({ code: 'JOURNAL_TAMPERED' }));
    expect(() => new CoreServiceFamilyDataCutoverReadinessLedger({
      clock,
      restoredEntries: [{ ...current.entries[0]!, evidenceDigest: digest(5) }, current.entries[1]!],
      trustedAnchor: anchor
    })).toThrowError(expect.objectContaining({ code: 'JOURNAL_TAMPERED' }));
    expect(() => new CoreServiceFamilyDataCutoverReadinessLedger({
      clock,
      restoredEntries: current.entries,
      trustedAnchor: { ...anchor, epoch: 1 }
    })).toThrowError(expect.objectContaining({ code: 'JOURNAL_TAMPERED' }));
    const polluted = { ...current.entries[0]!, verificationBinding: 'must-never-reach-status' } as unknown as CoreServiceFamilyDataCutoverReadinessEntryContract;
    expect(() => new CoreServiceFamilyDataCutoverReadinessLedger({
      clock,
      restoredEntries: [polluted, current.entries[1]!],
      trustedAnchor: anchor
    })).toThrowError(expect.objectContaining({ code: 'JOURNAL_TAMPERED' }));
  });

  it('keeps DEC-171 blocked even after all five independent gates pass', () => {
    const ledger = new CoreServiceFamilyDataCutoverReadinessLedger({ clock, verifier });
    let status = ledger.status();
    for (let index = 1; index <= CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.length; index += 1) {
      status = ledger.append(claim(index));
    }
    expect(status).toMatchObject({
      ledgerEpoch: 5,
      entryCount: 5,
      allRequiredGatesPass: true,
      acceptanceState: 'all-gates-pass-cutover-still-blocked',
      decision: 'blocked',
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false
    });
    expect(status.reasons).toContain('SEPARATE_VERSIONED_USER_DECISION_REQUIRED');
  });
});
