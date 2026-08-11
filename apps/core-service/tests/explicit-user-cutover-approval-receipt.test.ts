import { describe, expect, it, vi } from 'vitest';
import {
  EXPLICIT_USER_APPROVAL_MAX_LIFETIME_MS,
  ExplicitUserApprovalReceiptIntake,
  TECHNICAL_CUTOVER_GATES,
  type ExplicitUserCutoverApprovalReceipt
} from '../src/explicit-user-cutover-approval-receipt.js';

const SOURCE_HASH = '1'.repeat(64);
const LEDGER_HEAD_HASH = '2'.repeat(64);
const NOW = '2026-08-11T08:00:00.000Z';
const technicalGates = TECHNICAL_CUTOVER_GATES.map((id) => Object.freeze({ id, status: 'pass' as const }));
const receipt: ExplicitUserCutoverApprovalReceipt = Object.freeze({
  schemaVersion: 1,
  decisionId: 'DEC-TEST-ONLY',
  decisionVersion: 1,
  action: 'approve-family-data-cutover',
  approvalSubjectId: 'synthetic-test-subject',
  authoritativeSourceSha256: SOURCE_HASH,
  readinessLedgerHeadHash: LEDGER_HEAD_HASH,
  approvedAt: '2026-08-11T07:59:00.000Z',
  expiresAt: '2026-08-11T08:05:00.000Z',
  verificationBinding: 'synthetic_test_verification_binding_0001'
});

const evaluate = (
  intake: ExplicitUserApprovalReceiptIntake,
  overrides: Partial<{
    receipt: unknown;
    technicalGates: unknown;
    expectedAuthoritativeSourceSha256: string;
    expectedReadinessLedgerHeadHash: string;
  }> = {}
) => intake.evaluate({
  receipt,
  technicalGates,
  expectedAuthoritativeSourceSha256: SOURCE_HASH,
  expectedReadinessLedgerHeadHash: LEDGER_HEAD_HASH,
  ...overrides
});

describe('31-R prepared explicit user approval receipt boundary', () => {
  it('is default-deny when no verifier is attached', () => {
    const result = evaluate(new ExplicitUserApprovalReceiptIntake({ clock: () => NOW }));
    expect(result).toMatchObject({
      mode: 'explicit-user-approval-evidence-intake-no-cutover',
      modeledGate: 'EXPLICIT_USER_CUTOVER_APPROVAL',
      decision: 'blocked',
      technicalGatesSatisfied: true,
      verifierAttached: false,
      approvalEvidenceAccepted: false,
      eligibleForReadinessLedgerSubmission: false,
      approvalReceiptCreatedByBoundary: false,
      readinessLedgerSubmissionPerformed: false,
      receiptConsumed: false,
      productionRuntimeWiring: false,
      realDataAccessed: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false
    });
    expect(result.reasons).toContain('EXPLICIT_USER_APPROVAL_VERIFIER_UNAVAILABLE');
  });

  it('accepts only synthetic verified evidence as ledger-eligible while cutover stays blocked', () => {
    const verifier = { verify: vi.fn(() => true) };
    const result = evaluate(new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW }));
    expect(result).toMatchObject({
      decision: 'blocked',
      technicalGatesSatisfied: true,
      verifierAttached: true,
      approvalEvidenceAccepted: true,
      eligibleForReadinessLedgerSubmission: true,
      approvalReceiptCreatedByBoundary: false,
      readinessLedgerSubmissionPerformed: false,
      receiptConsumed: false,
      productionRuntimeWiring: false,
      realDataAccessed: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false
    });
    expect(result.approvalEvidenceDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.reasons).toContain('DEC_171_CUTOVER_REMAINS_BLOCKED');
    expect('gateId' in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain(receipt.verificationBinding);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasons)).toBe(true);
    expect(verifier.verify).toHaveBeenCalledOnce();
    expect(Object.isFrozen(verifier.verify.mock.calls[0]?.[0])).toBe(true);
  });

  it('refuses incomplete, duplicate, unknown, or polluted technical gates before verifier execution', () => {
    const verifier = { verify: vi.fn(() => true) };
    const intake = new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW });
    const pending = technicalGates.map((gate) => gate.id === 'ROLLBACK_DRILL' ? { ...gate, status: 'pending' as const } : gate);
    const duplicate = technicalGates.map((gate, index) => index === 3 ? technicalGates[0] : gate);
    const unknown = technicalGates.map((gate, index) => index === 3 ? { id: 'UNKNOWN', status: 'pass' } : gate);
    const polluted = technicalGates.map((gate, index) => index === 3 ? { ...gate, trusted: true } : gate);
    for (const candidate of [pending, duplicate, unknown, polluted, null]) {
      expect(evaluate(intake, { technicalGates: candidate })).toMatchObject({
        technicalGatesSatisfied: false,
        approvalEvidenceAccepted: false,
        eligibleForReadinessLedgerSubmission: false,
        automaticActivationAllowed: false
      });
    }
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('requires a receipt after all four technical gates pass', () => {
    const verifier = { verify: vi.fn(() => true) };
    const result = evaluate(new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW }), { receipt: null });
    expect(result).toMatchObject({ approvalEvidenceAccepted: false, eligibleForReadinessLedgerSubmission: false });
    expect(result.reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_REQUIRED');
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('rejects extra receipt fields and accessor-backed receipt properties', () => {
    const verifier = { verify: vi.fn(() => true) };
    const intake = new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW });
    expect(evaluate(intake, { receipt: { ...receipt, extra: true } }).reasons)
      .toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    const accessorReceipt = { ...receipt } as Record<string, unknown>;
    Object.defineProperty(accessorReceipt, 'decisionId', { enumerable: true, get: () => receipt.decisionId });
    expect(evaluate(intake, { receipt: accessorReceipt }).reasons)
      .toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('binds the receipt to non-genesis authoritative-source and readiness-ledger hashes', () => {
    const verifier = { verify: vi.fn(() => true) };
    const intake = new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW });
    const cases = [
      { expectedAuthoritativeSourceSha256: '3'.repeat(64) },
      { expectedReadinessLedgerHeadHash: '3'.repeat(64) },
      { expectedAuthoritativeSourceSha256: '0'.repeat(64) },
      { expectedReadinessLedgerHeadHash: '0'.repeat(64) },
      { receipt: { ...receipt, authoritativeSourceSha256: '0'.repeat(64) } },
      { receipt: { ...receipt, readinessLedgerHeadHash: 'INVALID' } }
    ];
    for (const candidate of cases) {
      expect(evaluate(intake, candidate).reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    }
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('requires canonical timestamps, a live interval, and a bounded lifetime', () => {
    const verifier = { verify: vi.fn(() => true) };
    const intake = new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW });
    const overlongExpiresAt = new Date(Date.parse(receipt.approvedAt) + EXPLICIT_USER_APPROVAL_MAX_LIFETIME_MS + 1).toISOString();
    const cases = [
      { ...receipt, approvedAt: '2026-08-11T08:00:01.000Z' },
      { ...receipt, expiresAt: NOW },
      { ...receipt, expiresAt: overlongExpiresAt },
      { ...receipt, approvedAt: '2026-08-11 07:59:00Z' },
      { ...receipt, expiresAt: receipt.approvedAt }
    ];
    for (const candidate of cases) {
      expect(evaluate(intake, { receipt: candidate }).reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    }
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('fails closed when the clock is invalid or throws', () => {
    const verifier = { verify: vi.fn(() => true) };
    const invalid = evaluate(new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => 'invalid' }));
    const throwing = evaluate(new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => { throw new Error('clock failed'); } }));
    expect(invalid.reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    expect(throwing.reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('fails closed when verification rejects, throws, or returns a non-boolean truthy value', () => {
    const verifiers = [
      { verify: () => false },
      { verify: () => { throw new Error('rejected'); } },
      { verify: () => 'yes' as unknown as boolean }
    ];
    for (const verifier of verifiers) {
      const result = evaluate(new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW }));
      expect(result.reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_REJECTED');
      expect(result).toMatchObject({ approvalEvidenceAccepted: false, eligibleForReadinessLedgerSubmission: false });
    }
  });

  it('rejects malformed decision identity, version, action, subject, and verification binding', () => {
    const verifier = { verify: vi.fn(() => true) };
    const intake = new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW });
    const cases = [
      { ...receipt, decisionId: 'x' },
      { ...receipt, decisionVersion: 0 },
      { ...receipt, decisionVersion: 1.5 },
      { ...receipt, action: 'activate-now' },
      { ...receipt, approvalSubjectId: 'INVALID SUBJECT' },
      { ...receipt, verificationBinding: 'short' }
    ];
    for (const candidate of cases) {
      expect(evaluate(intake, { receipt: candidate }).reasons).toContain('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID');
    }
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('produces a deterministic digest that changes with any verification binding change', () => {
    const verifier = { verify: () => true };
    const intake = new ExplicitUserApprovalReceiptIntake({ verifier, clock: () => NOW });
    const first = evaluate(intake);
    const second = evaluate(intake);
    const changed = evaluate(intake, {
      receipt: { ...receipt, verificationBinding: 'synthetic_test_verification_binding_0002' }
    });
    expect(first.approvalEvidenceDigest).toBe(second.approvalEvidenceDigest);
    expect(changed.approvalEvidenceDigest).not.toBe(first.approvalEvidenceDigest);
  });
});
