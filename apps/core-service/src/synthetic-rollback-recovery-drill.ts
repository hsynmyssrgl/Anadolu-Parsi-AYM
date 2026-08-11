import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENESIS_HASH = '0'.repeat(64);
const TRANSITION_KEYS = Object.freeze(['expectedEpoch', 'proofDigest'] as const);

export type SyntheticRollbackStage =
  | 'idle'
  | 'baseline-sealed'
  | 'candidate-read-only'
  | 'failure-injected'
  | 'rollback-active'
  | 'desktop-restored'
  | 'recovery-verified';

export interface SyntheticRollbackSnapshot {
  readonly schemaVersion: 1;
  readonly evidenceClass: 'synthetic-rollback-recovery-non-authoritative';
  readonly epoch: number;
  readonly stage: SyntheticRollbackStage;
  readonly desktopWritable: true;
  readonly coreServiceWritable: false;
  readonly candidateReadOnly: boolean;
  readonly lastProofDigest: string;
  readonly eventChainHash: string;
  readonly syntheticOnly: true;
  readonly realDataTouched: false;
  readonly actualProcessCrashPerformed: false;
  readonly realBackupRestorePerformed: false;
  readonly productionGateSatisfied: false;
  readonly productionSubmissionAllowed: false;
  readonly cutoverAuthorityAttached: false;
}

export interface SyntheticRollbackEvidenceCandidate {
  readonly schemaVersion: 1;
  readonly evidenceClass: 'synthetic-rollback-recovery-non-authoritative';
  readonly modeledGate: 'ROLLBACK_DRILL';
  readonly evidenceDigest: string;
  readonly drillEpoch: 6;
  readonly recoveryHeadHash: string;
  readonly desktopWritable: true;
  readonly coreServiceWritable: false;
  readonly syntheticOnly: true;
  readonly realDataTouched: false;
  readonly actualProcessCrashPerformed: false;
  readonly realBackupRestorePerformed: false;
  readonly productionGateSatisfied: false;
  readonly productionSubmissionAllowed: false;
  readonly cutoverAuthorityAttached: false;
}

export interface SyntheticRollbackTransitionInput {
  readonly expectedEpoch: number;
  readonly proofDigest: string;
}

export type SyntheticRollbackDrillErrorCode =
  | 'MALFORMED_INPUT'
  | 'STALE_EPOCH'
  | 'STATE_INVALID'
  | 'PROOF_INVALID'
  | 'PROOF_REUSED'
  | 'INVARIANT_VIOLATION'
  | 'DRILL_INCOMPLETE';

export class SyntheticRollbackDrillError extends Error {
  public readonly code: SyntheticRollbackDrillErrorCode;

  public constructor(code: SyntheticRollbackDrillErrorCode, message: string) {
    super(message);
    this.name = 'SyntheticRollbackDrillError';
    this.code = code;
  }
}

const hasExactKeys = (candidate: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(candidate).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};

const freezeSnapshot = (snapshot: SyntheticRollbackSnapshot): SyntheticRollbackSnapshot => Object.freeze({ ...snapshot });

export class SyntheticRollbackRecoveryDrill {
  readonly #seenProofDigests = new Set<string>();
  #state: SyntheticRollbackSnapshot = freezeSnapshot({
    schemaVersion: 1,
    evidenceClass: 'synthetic-rollback-recovery-non-authoritative',
    epoch: 0,
    stage: 'idle',
    desktopWritable: true,
    coreServiceWritable: false,
    candidateReadOnly: false,
    lastProofDigest: GENESIS_HASH,
    eventChainHash: GENESIS_HASH,
    syntheticOnly: true,
    realDataTouched: false,
    actualProcessCrashPerformed: false,
    realBackupRestorePerformed: false,
    productionGateSatisfied: false,
    productionSubmissionAllowed: false,
    cutoverAuthorityAttached: false
  });

  public snapshot(): SyntheticRollbackSnapshot {
    return this.#state;
  }

  public sealBaseline(input: SyntheticRollbackTransitionInput): SyntheticRollbackSnapshot {
    return this.#advance(input, 'idle', 'baseline-sealed', false, 'seal-baseline');
  }

  public attachCandidateReadOnly(input: SyntheticRollbackTransitionInput): SyntheticRollbackSnapshot {
    return this.#advance(input, 'baseline-sealed', 'candidate-read-only', true, 'attach-candidate-read-only');
  }

  public injectFailure(input: SyntheticRollbackTransitionInput): SyntheticRollbackSnapshot {
    return this.#advance(input, 'candidate-read-only', 'failure-injected', true, 'inject-synthetic-failure');
  }

  public beginRollback(input: SyntheticRollbackTransitionInput): SyntheticRollbackSnapshot {
    return this.#advance(input, 'failure-injected', 'rollback-active', false, 'begin-synthetic-rollback');
  }

  public restoreDesktop(input: SyntheticRollbackTransitionInput): SyntheticRollbackSnapshot {
    return this.#advance(input, 'rollback-active', 'desktop-restored', false, 'confirm-desktop-writer');
  }

  public verifyRecovery(input: SyntheticRollbackTransitionInput): SyntheticRollbackSnapshot {
    return this.#advance(input, 'desktop-restored', 'recovery-verified', false, 'verify-synthetic-recovery');
  }

  public evidenceCandidate(): SyntheticRollbackEvidenceCandidate {
    if (this.#state.stage !== 'recovery-verified' || this.#state.epoch !== 6 || this.#state.candidateReadOnly) {
      throw new SyntheticRollbackDrillError('DRILL_INCOMPLETE', 'Synthetic rollback recovery drill is incomplete');
    }
    return Object.freeze({
      schemaVersion: 1,
      evidenceClass: 'synthetic-rollback-recovery-non-authoritative',
      modeledGate: 'ROLLBACK_DRILL',
      evidenceDigest: createHash('sha256')
        .update(JSON.stringify(['PPT-SYNTHETIC-ROLLBACK-RECOVERY-CANDIDATE-V1', this.#state.epoch, this.#state.eventChainHash]), 'utf8')
        .digest('hex'),
      drillEpoch: 6,
      recoveryHeadHash: this.#state.eventChainHash,
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
  }

  #advance(
    input: unknown,
    expectedStage: SyntheticRollbackStage,
    nextStage: SyntheticRollbackStage,
    candidateReadOnly: boolean,
    event: string
  ): SyntheticRollbackSnapshot {
    const value = this.#expectInput(input);
    if (this.#state.stage !== expectedStage) {
      throw new SyntheticRollbackDrillError('STATE_INVALID', 'Synthetic rollback recovery transition is invalid');
    }
    const epoch = this.#state.epoch + 1;
    const eventChainHash = createHash('sha256')
      .update(JSON.stringify(['PPT-SYNTHETIC-ROLLBACK-RECOVERY-EVENT-V1', this.#state.eventChainHash, epoch, event, value.proofDigest]), 'utf8')
      .digest('hex');
    const candidate = freezeSnapshot({
      schemaVersion: 1,
      evidenceClass: 'synthetic-rollback-recovery-non-authoritative',
      epoch,
      stage: nextStage,
      desktopWritable: true,
      coreServiceWritable: false,
      candidateReadOnly,
      lastProofDigest: value.proofDigest,
      eventChainHash,
      syntheticOnly: true,
      realDataTouched: false,
      actualProcessCrashPerformed: false,
      realBackupRestorePerformed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
    this.#assertInvariant(candidate);
    this.#seenProofDigests.add(value.proofDigest);
    this.#state = candidate;
    return this.#state;
  }

  #expectInput(input: unknown): SyntheticRollbackTransitionInput {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !hasExactKeys(input, TRANSITION_KEYS)) {
      throw new SyntheticRollbackDrillError('MALFORMED_INPUT', 'Synthetic rollback recovery input shape is invalid');
    }
    const value = input as Record<string, unknown>;
    if (!Number.isSafeInteger(value.expectedEpoch) || (value.expectedEpoch as number) < 0) {
      throw new SyntheticRollbackDrillError('MALFORMED_INPUT', 'Synthetic rollback recovery epoch is invalid');
    }
    if (value.expectedEpoch !== this.#state.epoch) {
      throw new SyntheticRollbackDrillError('STALE_EPOCH', 'Synthetic rollback recovery epoch is stale');
    }
    if (typeof value.proofDigest !== 'string' || !SHA256_PATTERN.test(value.proofDigest) || value.proofDigest === GENESIS_HASH) {
      throw new SyntheticRollbackDrillError('PROOF_INVALID', 'Synthetic rollback recovery proof digest is invalid');
    }
    if (this.#seenProofDigests.has(value.proofDigest)) {
      throw new SyntheticRollbackDrillError('PROOF_REUSED', 'Synthetic rollback recovery proof digest was already used');
    }
    return value as unknown as SyntheticRollbackTransitionInput;
  }

  #assertInvariant(candidate: SyntheticRollbackSnapshot): void {
    const readOnlyExpected = candidate.stage === 'candidate-read-only' || candidate.stage === 'failure-injected';
    if (
      candidate.desktopWritable !== true
      || candidate.coreServiceWritable !== false
      || candidate.candidateReadOnly !== readOnlyExpected
      || candidate.realDataTouched !== false
      || candidate.actualProcessCrashPerformed !== false
      || candidate.realBackupRestorePerformed !== false
      || candidate.productionGateSatisfied !== false
      || candidate.productionSubmissionAllowed !== false
      || candidate.cutoverAuthorityAttached !== false
    ) {
      throw new SyntheticRollbackDrillError('INVARIANT_VIOLATION', 'Synthetic rollback recovery invariant failed');
    }
  }
}
