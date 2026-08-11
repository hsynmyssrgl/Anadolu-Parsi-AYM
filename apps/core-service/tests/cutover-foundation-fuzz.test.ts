import { describe, expect, it } from 'vitest';
import {
  ExplicitUserApprovalReceiptIntake,
  type ExplicitUserCutoverApprovalVerifier
} from '../src/explicit-user-cutover-approval-receipt.js';
import {
  VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES,
  VersionedCutoverDecisionPreflightError,
  evaluateVersionedCutoverDecisionPreflight
} from '../src/versioned-cutover-decision-preflight.js';

const SOURCE_HASH = '1'.repeat(64);
const LEDGER_HASH = '2'.repeat(64);

const randomGenerator = (initialSeed: number): (() => number) => {
  let seed = initialSeed >>> 0;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  };
};

const randomText = (next: () => number): string => {
  const length = next() % 40;
  let value = '';
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(32 + (next() % 95));
  return value;
};

const randomJsonLike = (next: () => number, depth = 0): unknown => {
  const kind = next() % (depth >= 3 ? 7 : 10);
  if (kind === 0) return null;
  if (kind === 1) return (next() & 1) === 1;
  if (kind === 2) return next() | 0;
  if (kind === 3) return Number.NaN;
  if (kind === 4) return Number.POSITIVE_INFINITY;
  if (kind === 5) return randomText(next);
  if (kind === 6) return `${next().toString(16).padStart(8, '0')}${randomText(next)}`;
  if (kind === 7) return Array.from({ length: next() % 8 }, () => randomJsonLike(next, depth + 1));
  const value: Record<string, unknown> = {};
  for (let index = 0; index < next() % 8; index += 1) value[`k${next() % 17}`] = randomJsonLike(next, depth + 1);
  return value;
};

const assertNoCutoverAuthority = (result: ReturnType<typeof evaluateVersionedCutoverDecisionPreflight>): void => {
  expect(result).toMatchObject({
    currentDecision: 'DEC-171',
    decision: 'blocked',
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
};

describe('31-L..31-S deterministic malformed-input fuzz boundary', () => {
  it('never grants cutover authority for 1024 deterministic arbitrary preflight inputs', () => {
    const next = randomGenerator(0x31_5a_2026);
    for (let index = 0; index < 1_024; index += 1) {
      try {
        assertNoCutoverAuthority(evaluateVersionedCutoverDecisionPreflight(randomJsonLike(next)));
      } catch (error) {
        expect(error).toBeInstanceOf(VersionedCutoverDecisionPreflightError);
      }
    }
  });

  it('never grants approval or cutover authority for randomized receipt and gate values', () => {
    const next = randomGenerator(0x31_5b_2026);
    const verifier: ExplicitUserCutoverApprovalVerifier = { verify: () => true };
    const intake = new ExplicitUserApprovalReceiptIntake({
      verifier,
      clock: () => '2026-08-11T09:00:00.000Z'
    });
    for (let index = 0; index < 1_024; index += 1) {
      const result = intake.evaluate({
        receipt: randomJsonLike(next),
        technicalGates: randomJsonLike(next),
        expectedAuthoritativeSourceSha256: SOURCE_HASH,
        expectedReadinessLedgerHeadHash: LEDGER_HASH
      });
      expect(result).toMatchObject({
        decision: 'blocked',
        readinessLedgerSubmissionPerformed: false,
        receiptConsumed: false,
        productionRuntimeWiring: false,
        realDataAccessed: false,
        cutoverAuthorityAttached: false,
        automaticActivationAllowed: false
      });
    }
  });

  it('rejects inherited input state and accessor-backed values without invoking getters', () => {
    const inherited = Object.assign(Object.create({ polluted: true }) as Record<string, unknown>, {
      expectedAuthoritativeSourceSha256: SOURCE_HASH,
      observedAuthoritativeSourceSha256: SOURCE_HASH,
      readinessLedgerEpoch: 5,
      readinessLedgerEntryCount: 5,
      readinessLedgerHeadHash: LEDGER_HASH,
      readinessLedgerIntegrityVerified: true,
      readinessLedgerTrustedAnchorAttached: true,
      gates: []
    });
    expect(() => evaluateVersionedCutoverDecisionPreflight(inherited))
      .toThrowError(expect.objectContaining({ code: 'INPUT_MALFORMED' }));

    let getterCalls = 0;
    const accessorInput: Record<string, unknown> = {
      expectedAuthoritativeSourceSha256: SOURCE_HASH,
      observedAuthoritativeSourceSha256: SOURCE_HASH,
      readinessLedgerEpoch: 5,
      readinessLedgerEntryCount: 5,
      readinessLedgerHeadHash: LEDGER_HASH,
      readinessLedgerIntegrityVerified: true,
      readinessLedgerTrustedAnchorAttached: true
    };
    Object.defineProperty(accessorInput, 'gates', {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return [];
      }
    });
    expect(() => evaluateVersionedCutoverDecisionPreflight(accessorInput))
      .toThrowError(expect.objectContaining({ code: 'INPUT_MALFORMED' }));
    expect(getterCalls).toBe(0);
  });

  it('rejects accessor-backed gate evidence without evaluating the accessor', () => {
    let getterCalls = 0;
    const gates = VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.map((id, index) => {
      const gate: Record<string, unknown> = { id, status: 'pass' };
      if (index === 0) {
        Object.defineProperty(gate, 'evidenceDigest', {
          enumerable: true,
          get: () => {
            getterCalls += 1;
            return '3'.repeat(64);
          }
        });
      } else {
        gate.evidenceDigest = (index + 3).toString(16).padStart(64, '0');
      }
      return gate;
    });
    expect(() => evaluateVersionedCutoverDecisionPreflight({
      expectedAuthoritativeSourceSha256: SOURCE_HASH,
      observedAuthoritativeSourceSha256: SOURCE_HASH,
      readinessLedgerEpoch: 5,
      readinessLedgerEntryCount: 5,
      readinessLedgerHeadHash: LEDGER_HASH,
      readinessLedgerIntegrityVerified: true,
      readinessLedgerTrustedAnchorAttached: true,
      gates
    })).toThrowError(expect.objectContaining({ code: 'GATE_SET_INVALID' }));
    expect(getterCalls).toBe(0);
  });
});
