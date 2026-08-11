import { describe, expect, it } from 'vitest';
import {
  SyntheticKeyLifecycleProofHarness,
  type SyntheticAttachProtectedHandleInput,
  type SyntheticKeyLifecycleEpochProofInput
} from '../src/synthetic-key-lifecycle-proof-harness.js';

const digest = (value: string): string => value.repeat(64);
const attachInput = (
  overrides: Partial<SyntheticAttachProtectedHandleInput> = {}
): SyntheticAttachProtectedHandleInput => ({
  expectedEpoch: 0,
  keyHandleId: 'opaque-handle-v1',
  protectorId: 'protected-provider-v1',
  proofDigest: digest('1'),
  ...overrides
});

const completeLifecycle = (): SyntheticKeyLifecycleProofHarness => {
  const harness = new SyntheticKeyLifecycleProofHarness();
  harness.attachProtectedHandle(attachInput());
  harness.openBoundedSession({ expectedEpoch: 1, proofDigest: digest('2') });
  harness.beginShutdownSeal({ expectedEpoch: 2, proofDigest: digest('3') });
  harness.completeShutdownSeal({ expectedEpoch: 3, proofDigest: digest('4') });
  return harness;
};

describe('31-O synthetic key lifecycle proof harness', () => {
  it('starts detached, immutable, synthetic, and without real key authority', () => {
    const snapshot = new SyntheticKeyLifecycleProofHarness().snapshot();
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      evidenceClass: 'synthetic-key-lifecycle-non-authoritative',
      epoch: 0,
      lifecycle: 'detached',
      plaintextLeaseCount: 0,
      acceptingNewLeases: false,
      keyMaterialExposed: false,
      syntheticOnly: true,
      realKeyMaterialAccessed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('allows exactly one bounded lease and releases it before sealing', () => {
    const harness = new SyntheticKeyLifecycleProofHarness();
    const protectedState = harness.attachProtectedHandle(attachInput());
    const open = harness.openBoundedSession({ expectedEpoch: 1, proofDigest: digest('2') });
    const sealing = harness.beginShutdownSeal({ expectedEpoch: 2, proofDigest: digest('3') });
    const sealed = harness.completeShutdownSeal({ expectedEpoch: 3, proofDigest: digest('4') });
    expect(protectedState).toMatchObject({ lifecycle: 'protected', plaintextLeaseCount: 0, acceptingNewLeases: true });
    expect(open).toMatchObject({ lifecycle: 'session-open', plaintextLeaseCount: 1, acceptingNewLeases: false });
    expect(sealing).toMatchObject({ lifecycle: 'sealing', plaintextLeaseCount: 1, acceptingNewLeases: false });
    expect(sealed).toMatchObject({ lifecycle: 'sealed', plaintextLeaseCount: 0, acceptingNewLeases: false });
  });

  it('produces only a non-submittable synthetic candidate after exact sealing', () => {
    const candidate = completeLifecycle().evidenceCandidate();
    expect(candidate).toMatchObject({
      schemaVersion: 1,
      evidenceClass: 'synthetic-key-lifecycle-non-authoritative',
      modeledGate: 'KEY_LIFECYCLE_PROOF',
      lifecycleEpoch: 4,
      syntheticOnly: true,
      realKeyMaterialAccessed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
    expect('gateId' in candidate).toBe(false);
    expect(Object.isFrozen(candidate)).toBe(true);
  });

  it('rejects candidate creation before sealing and invalid transition order', () => {
    const harness = new SyntheticKeyLifecycleProofHarness();
    expect(() => harness.evidenceCandidate()).toThrowError(expect.objectContaining({ code: 'LIFECYCLE_INCOMPLETE' }));
    expect(() => harness.openBoundedSession({ expectedEpoch: 0, proofDigest: digest('2') }))
      .toThrowError(expect.objectContaining({ code: 'STATE_INVALID' }));
    expect(harness.snapshot().lifecycle).toBe('detached');
  });

  it('rejects stale epochs, malformed shapes, and ambiguous identifiers without mutation', () => {
    const harness = new SyntheticKeyLifecycleProofHarness();
    const before = harness.snapshot();
    const extra = { ...attachInput(), unexpected: true };
    expect(() => harness.attachProtectedHandle(attachInput({ expectedEpoch: 1 })))
      .toThrowError(expect.objectContaining({ code: 'STALE_EPOCH' }));
    expect(() => harness.attachProtectedHandle(extra as SyntheticAttachProtectedHandleInput))
      .toThrowError(expect.objectContaining({ code: 'MALFORMED_INPUT' }));
    expect(() => harness.attachProtectedHandle(attachInput({ protectorId: 'opaque-handle-v1' })))
      .toThrowError(expect.objectContaining({ code: 'IDENTIFIER_INVALID' }));
    expect(harness.snapshot()).toBe(before);
  });

  it('rejects malformed, genesis, and reused proof digests without partial mutation', () => {
    const harness = new SyntheticKeyLifecycleProofHarness();
    expect(() => harness.attachProtectedHandle(attachInput({ proofDigest: 'invalid' })))
      .toThrowError(expect.objectContaining({ code: 'PROOF_INVALID' }));
    expect(() => harness.attachProtectedHandle(attachInput({ proofDigest: digest('0') })))
      .toThrowError(expect.objectContaining({ code: 'PROOF_INVALID' }));
    harness.attachProtectedHandle(attachInput());
    const before = harness.snapshot();
    expect(() => harness.openBoundedSession({ expectedEpoch: 1, proofDigest: digest('1') }))
      .toThrowError(expect.objectContaining({ code: 'PROOF_REUSED' }));
    expect(harness.snapshot()).toBe(before);
  });

  it('prevents a second lease and any transition after sealing', () => {
    const harness = new SyntheticKeyLifecycleProofHarness();
    harness.attachProtectedHandle(attachInput());
    harness.openBoundedSession({ expectedEpoch: 1, proofDigest: digest('2') });
    expect(() => harness.openBoundedSession({ expectedEpoch: 2, proofDigest: digest('5') }))
      .toThrowError(expect.objectContaining({ code: 'STATE_INVALID' }));
    harness.beginShutdownSeal({ expectedEpoch: 2, proofDigest: digest('3') });
    harness.completeShutdownSeal({ expectedEpoch: 3, proofDigest: digest('4') });
    const sealed = harness.snapshot();
    expect(() => harness.completeShutdownSeal({ expectedEpoch: 4, proofDigest: digest('5') }))
      .toThrowError(expect.objectContaining({ code: 'STATE_INVALID' }));
    expect(harness.snapshot()).toBe(sealed);
  });

  it('rejects extra fields on every epoch/proof transition', () => {
    const harness = new SyntheticKeyLifecycleProofHarness();
    harness.attachProtectedHandle(attachInput());
    const extra = { expectedEpoch: 1, proofDigest: digest('2'), unexpected: true };
    expect(() => harness.openBoundedSession(extra as SyntheticKeyLifecycleEpochProofInput))
      .toThrowError(expect.objectContaining({ code: 'MALFORMED_INPUT' }));
    expect(harness.snapshot().lifecycle).toBe('protected');
  });
});
