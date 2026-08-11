import { describe, expect, it } from 'vitest';
import { CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES } from '../../core-service/src/family-data-cutover-guard.js';
import {
  CoreServiceFamilyDataCutoverReadinessLedger,
  type CoreServiceCutoverReadinessEvidenceClaim
} from '../../core-service/src/family-data-cutover-readiness-ledger.js';
import { isSafeCoreServiceCutoverReadinessStatus } from '../src/main/core-service-startup-connection.js';

const clock = (): string => '2026-08-11T00:00:00.000Z';
const claim = (index: number): CoreServiceCutoverReadinessEvidenceClaim => {
  const gateId = CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES[index];
  const evidenceDigest = (index + 1).toString(16).padStart(64, '0');
  return { epoch: index + 1, gateId, status: 'pass', evidenceDigest, verificationBinding: `${gateId}:${evidenceDigest}` };
};
const ledger = (): CoreServiceFamilyDataCutoverReadinessLedger => new CoreServiceFamilyDataCutoverReadinessLedger({
  clock,
  verifier: { verify: (value) => value.verificationBinding === `${value.gateId}:${value.evidenceDigest}` }
});

describe('31-K Desktop cutover-readiness fail-closed validation', () => {
  it('accepts exact empty and complete chains while preserving the blocked decision', () => {
    const value = ledger();
    expect(isSafeCoreServiceCutoverReadinessStatus(value.status())).toBe(true);
    let complete = value.status();
    for (let index = 0; index < CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.length; index += 1) complete = value.append(claim(index));
    expect(isSafeCoreServiceCutoverReadinessStatus(complete)).toBe(true);
    expect(complete).toMatchObject({ allRequiredGatesPass: true, decision: 'blocked', cutoverAuthorityAttached: false });
  });

  it('rejects deleted records, hash mutation, epoch regression and false aggregate PASS', () => {
    const value = ledger();
    const accepted = value.append(claim(0));
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...accepted, entries: [] })).toBe(false);
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...accepted, headHash: 'f'.repeat(64) })).toBe(false);
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...accepted, ledgerEpoch: 0 })).toBe(false);
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...accepted, allRequiredGatesPass: true })).toBe(false);
  });

  it('rejects authority, reordered gates and any undeclared response field', () => {
    const status = ledger().status();
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...status, cutoverAuthorityAttached: true })).toBe(false);
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...status, requiredGates: [...status.requiredGates].reverse() })).toBe(false);
    expect(isSafeCoreServiceCutoverReadinessStatus({ ...status, databasePath: 'forbidden' } as typeof status)).toBe(false);
  });
});
