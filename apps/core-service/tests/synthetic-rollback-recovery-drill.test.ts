import { describe, expect, it } from 'vitest';
import {
  SyntheticRollbackRecoveryDrill,
  type SyntheticRollbackTransitionInput
} from '../src/synthetic-rollback-recovery-drill.js';

const digest = (value: string): string => value.repeat(64);
const completeDrill = (): SyntheticRollbackRecoveryDrill => {
  const drill = new SyntheticRollbackRecoveryDrill();
  drill.sealBaseline({ expectedEpoch: 0, proofDigest: digest('1') });
  drill.attachCandidateReadOnly({ expectedEpoch: 1, proofDigest: digest('2') });
  drill.injectFailure({ expectedEpoch: 2, proofDigest: digest('3') });
  drill.beginRollback({ expectedEpoch: 3, proofDigest: digest('4') });
  drill.restoreDesktop({ expectedEpoch: 4, proofDigest: digest('5') });
  drill.verifyRecovery({ expectedEpoch: 5, proofDigest: digest('6') });
  return drill;
};

describe('31-P synthetic rollback recovery drill', () => {
  it('starts immutable, Desktop-only, synthetic, and without real recovery authority', () => {
    const snapshot = new SyntheticRollbackRecoveryDrill().snapshot();
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      evidenceClass: 'synthetic-rollback-recovery-non-authoritative',
      epoch: 0,
      stage: 'idle',
      desktopWritable: true,
      coreServiceWritable: false,
      candidateReadOnly: false,
      syntheticOnly: true,
      realDataTouched: false,
      actualProcessCrashPerformed: false,
      realBackupRestorePerformed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('runs the exact synthetic drill while Desktop remains the only writer', () => {
    const drill = new SyntheticRollbackRecoveryDrill();
    const baseline = drill.sealBaseline({ expectedEpoch: 0, proofDigest: digest('1') });
    const attached = drill.attachCandidateReadOnly({ expectedEpoch: 1, proofDigest: digest('2') });
    const failed = drill.injectFailure({ expectedEpoch: 2, proofDigest: digest('3') });
    const rollback = drill.beginRollback({ expectedEpoch: 3, proofDigest: digest('4') });
    const restored = drill.restoreDesktop({ expectedEpoch: 4, proofDigest: digest('5') });
    const recovered = drill.verifyRecovery({ expectedEpoch: 5, proofDigest: digest('6') });
    for (const snapshot of [baseline, attached, failed, rollback, restored, recovered]) {
      expect(snapshot).toMatchObject({ desktopWritable: true, coreServiceWritable: false, realDataTouched: false });
    }
    expect(attached.candidateReadOnly).toBe(true);
    expect(failed.candidateReadOnly).toBe(true);
    expect(rollback.candidateReadOnly).toBe(false);
    expect(recovered.stage).toBe('recovery-verified');
  });

  it('produces only a non-submittable modeled candidate with no gateId', () => {
    const candidate = completeDrill().evidenceCandidate();
    expect(candidate).toMatchObject({
      schemaVersion: 1,
      evidenceClass: 'synthetic-rollback-recovery-non-authoritative',
      modeledGate: 'ROLLBACK_DRILL',
      drillEpoch: 6,
      desktopWritable: true,
      coreServiceWritable: false,
      syntheticOnly: true,
      realDataTouched: false,
      actualProcessCrashPerformed: false,
      realBackupRestorePerformed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
    expect('gateId' in candidate).toBe(false);
    expect(Object.isFrozen(candidate)).toBe(true);
  });

  it('rejects candidate creation before recovery and out-of-order transitions', () => {
    const drill = new SyntheticRollbackRecoveryDrill();
    expect(() => drill.evidenceCandidate()).toThrowError(expect.objectContaining({ code: 'DRILL_INCOMPLETE' }));
    expect(() => drill.restoreDesktop({ expectedEpoch: 0, proofDigest: digest('1') }))
      .toThrowError(expect.objectContaining({ code: 'STATE_INVALID' }));
    expect(drill.snapshot().stage).toBe('idle');
  });

  it('rejects stale epochs and extra fields without mutation', () => {
    const drill = new SyntheticRollbackRecoveryDrill();
    const before = drill.snapshot();
    expect(() => drill.sealBaseline({ expectedEpoch: 1, proofDigest: digest('1') }))
      .toThrowError(expect.objectContaining({ code: 'STALE_EPOCH' }));
    const extra = { expectedEpoch: 0, proofDigest: digest('1'), unexpected: true };
    expect(() => drill.sealBaseline(extra as SyntheticRollbackTransitionInput))
      .toThrowError(expect.objectContaining({ code: 'MALFORMED_INPUT' }));
    expect(drill.snapshot()).toBe(before);
  });

  it('rejects malformed and genesis proof digests without partial mutation', () => {
    const drill = new SyntheticRollbackRecoveryDrill();
    const before = drill.snapshot();
    expect(() => drill.sealBaseline({ expectedEpoch: 0, proofDigest: 'invalid' }))
      .toThrowError(expect.objectContaining({ code: 'PROOF_INVALID' }));
    expect(() => drill.sealBaseline({ expectedEpoch: 0, proofDigest: digest('0') }))
      .toThrowError(expect.objectContaining({ code: 'PROOF_INVALID' }));
    expect(drill.snapshot()).toBe(before);
  });

  it('rejects proof reuse and keeps the accepted snapshot unchanged', () => {
    const drill = new SyntheticRollbackRecoveryDrill();
    drill.sealBaseline({ expectedEpoch: 0, proofDigest: digest('1') });
    const before = drill.snapshot();
    expect(() => drill.attachCandidateReadOnly({ expectedEpoch: 1, proofDigest: digest('1') }))
      .toThrowError(expect.objectContaining({ code: 'PROOF_REUSED' }));
    expect(drill.snapshot()).toBe(before);
  });

  it('closes the drill after recovery and rejects every post-recovery transition', () => {
    const drill = completeDrill();
    const recovered = drill.snapshot();
    expect(() => drill.verifyRecovery({ expectedEpoch: 6, proofDigest: digest('7') }))
      .toThrowError(expect.objectContaining({ code: 'STATE_INVALID' }));
    expect(drill.snapshot()).toBe(recovered);
    expect(recovered).toMatchObject({ stage: 'recovery-verified', candidateReadOnly: false, epoch: 6 });
  });
});
