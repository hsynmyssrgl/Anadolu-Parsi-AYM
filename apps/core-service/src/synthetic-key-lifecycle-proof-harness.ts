import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENESIS_HASH = '0'.repeat(64);
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/u;
const ATTACH_KEYS = Object.freeze(['expectedEpoch', 'keyHandleId', 'protectorId', 'proofDigest'] as const);
const EPOCH_PROOF_KEYS = Object.freeze(['expectedEpoch', 'proofDigest'] as const);

export type SyntheticKeyLifecycle = 'detached' | 'protected' | 'session-open' | 'sealing' | 'sealed';

export interface SyntheticKeyLifecycleSnapshot {
  readonly schemaVersion: 1;
  readonly evidenceClass: 'synthetic-key-lifecycle-non-authoritative';
  readonly epoch: number;
  readonly lifecycle: SyntheticKeyLifecycle;
  readonly keyHandleId: string | null;
  readonly protectorId: string | null;
  readonly plaintextLeaseCount: 0 | 1;
  readonly acceptingNewLeases: boolean;
  readonly lastProofDigest: string;
  readonly eventChainHash: string;
  readonly keyMaterialExposed: false;
  readonly syntheticOnly: true;
  readonly realKeyMaterialAccessed: false;
  readonly productionGateSatisfied: false;
  readonly productionSubmissionAllowed: false;
  readonly cutoverAuthorityAttached: false;
}

export interface SyntheticKeyLifecycleEvidenceCandidate {
  readonly schemaVersion: 1;
  readonly evidenceClass: 'synthetic-key-lifecycle-non-authoritative';
  readonly modeledGate: 'KEY_LIFECYCLE_PROOF';
  readonly evidenceDigest: string;
  readonly lifecycleEpoch: 4;
  readonly lifecycleHeadHash: string;
  readonly syntheticOnly: true;
  readonly realKeyMaterialAccessed: false;
  readonly productionGateSatisfied: false;
  readonly productionSubmissionAllowed: false;
  readonly cutoverAuthorityAttached: false;
}

export interface SyntheticAttachProtectedHandleInput {
  readonly expectedEpoch: number;
  readonly keyHandleId: string;
  readonly protectorId: string;
  readonly proofDigest: string;
}

export interface SyntheticKeyLifecycleEpochProofInput {
  readonly expectedEpoch: number;
  readonly proofDigest: string;
}

export type SyntheticKeyLifecycleErrorCode =
  | 'MALFORMED_INPUT'
  | 'STALE_EPOCH'
  | 'STATE_INVALID'
  | 'IDENTIFIER_INVALID'
  | 'PROOF_INVALID'
  | 'PROOF_REUSED'
  | 'INVARIANT_VIOLATION'
  | 'LIFECYCLE_INCOMPLETE';

export class SyntheticKeyLifecycleProofError extends Error {
  public readonly code: SyntheticKeyLifecycleErrorCode;

  public constructor(code: SyntheticKeyLifecycleErrorCode, message: string) {
    super(message);
    this.name = 'SyntheticKeyLifecycleProofError';
    this.code = code;
  }
}

const hasExactKeys = (candidate: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(candidate).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};

const freezeSnapshot = (snapshot: SyntheticKeyLifecycleSnapshot): SyntheticKeyLifecycleSnapshot =>
  Object.freeze({ ...snapshot });

export class SyntheticKeyLifecycleProofHarness {
  readonly #seenProofDigests = new Set<string>();
  #state: SyntheticKeyLifecycleSnapshot = freezeSnapshot({
    schemaVersion: 1,
    evidenceClass: 'synthetic-key-lifecycle-non-authoritative',
    epoch: 0,
    lifecycle: 'detached',
    keyHandleId: null,
    protectorId: null,
    plaintextLeaseCount: 0,
    acceptingNewLeases: false,
    lastProofDigest: GENESIS_HASH,
    eventChainHash: GENESIS_HASH,
    keyMaterialExposed: false,
    syntheticOnly: true,
    realKeyMaterialAccessed: false,
    productionGateSatisfied: false,
    productionSubmissionAllowed: false,
    cutoverAuthorityAttached: false
  });

  public snapshot(): SyntheticKeyLifecycleSnapshot {
    return this.#state;
  }

  public attachProtectedHandle(input: SyntheticAttachProtectedHandleInput): SyntheticKeyLifecycleSnapshot {
    const value = this.#expectInput(input, ATTACH_KEYS, 'detached');
    if (
      typeof value.keyHandleId !== 'string'
      || typeof value.protectorId !== 'string'
      || !ID_PATTERN.test(value.keyHandleId)
      || !ID_PATTERN.test(value.protectorId)
      || value.keyHandleId === value.protectorId
    ) {
      throw new SyntheticKeyLifecycleProofError('IDENTIFIER_INVALID', 'Synthetic key lifecycle identifier is invalid or ambiguous');
    }
    return this.#advance('attach-protected-handle', value.proofDigest, {
      lifecycle: 'protected',
      keyHandleId: value.keyHandleId,
      protectorId: value.protectorId,
      plaintextLeaseCount: 0,
      acceptingNewLeases: true
    });
  }

  public openBoundedSession(input: SyntheticKeyLifecycleEpochProofInput): SyntheticKeyLifecycleSnapshot {
    const value = this.#expectInput(input, EPOCH_PROOF_KEYS, 'protected');
    return this.#advance('open-bounded-session', value.proofDigest, {
      lifecycle: 'session-open',
      keyHandleId: this.#state.keyHandleId,
      protectorId: this.#state.protectorId,
      plaintextLeaseCount: 1,
      acceptingNewLeases: false
    });
  }

  public beginShutdownSeal(input: SyntheticKeyLifecycleEpochProofInput): SyntheticKeyLifecycleSnapshot {
    const value = this.#expectInput(input, EPOCH_PROOF_KEYS, 'session-open');
    return this.#advance('begin-shutdown-seal', value.proofDigest, {
      lifecycle: 'sealing',
      keyHandleId: this.#state.keyHandleId,
      protectorId: this.#state.protectorId,
      plaintextLeaseCount: 1,
      acceptingNewLeases: false
    });
  }

  public completeShutdownSeal(input: SyntheticKeyLifecycleEpochProofInput): SyntheticKeyLifecycleSnapshot {
    const value = this.#expectInput(input, EPOCH_PROOF_KEYS, 'sealing');
    return this.#advance('complete-shutdown-seal', value.proofDigest, {
      lifecycle: 'sealed',
      keyHandleId: this.#state.keyHandleId,
      protectorId: this.#state.protectorId,
      plaintextLeaseCount: 0,
      acceptingNewLeases: false
    });
  }

  public evidenceCandidate(): SyntheticKeyLifecycleEvidenceCandidate {
    if (this.#state.lifecycle !== 'sealed' || this.#state.epoch !== 4 || this.#state.plaintextLeaseCount !== 0) {
      throw new SyntheticKeyLifecycleProofError('LIFECYCLE_INCOMPLETE', 'Synthetic key lifecycle is not fully sealed');
    }
    return Object.freeze({
      schemaVersion: 1,
      evidenceClass: 'synthetic-key-lifecycle-non-authoritative',
      modeledGate: 'KEY_LIFECYCLE_PROOF',
      evidenceDigest: createHash('sha256')
        .update(JSON.stringify(['PPT-SYNTHETIC-KEY-LIFECYCLE-CANDIDATE-V1', this.#state.epoch, this.#state.eventChainHash]), 'utf8')
        .digest('hex'),
      lifecycleEpoch: 4,
      lifecycleHeadHash: this.#state.eventChainHash,
      syntheticOnly: true,
      realKeyMaterialAccessed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
  }

  #expectInput(
    input: unknown,
    expectedKeys: readonly string[],
    expectedLifecycle: SyntheticKeyLifecycle
  ): Record<string, unknown> & { readonly expectedEpoch: number; readonly proofDigest: string } {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !hasExactKeys(input, expectedKeys)) {
      throw new SyntheticKeyLifecycleProofError('MALFORMED_INPUT', 'Synthetic key lifecycle input shape is invalid');
    }
    const value = input as Record<string, unknown>;
    if (!Number.isSafeInteger(value.expectedEpoch) || (value.expectedEpoch as number) < 0) {
      throw new SyntheticKeyLifecycleProofError('MALFORMED_INPUT', 'Synthetic key lifecycle epoch is invalid');
    }
    if (value.expectedEpoch !== this.#state.epoch) {
      throw new SyntheticKeyLifecycleProofError('STALE_EPOCH', 'Synthetic key lifecycle epoch is stale');
    }
    if (this.#state.lifecycle !== expectedLifecycle) {
      throw new SyntheticKeyLifecycleProofError('STATE_INVALID', 'Synthetic key lifecycle transition is invalid');
    }
    if (typeof value.proofDigest !== 'string' || !SHA256_PATTERN.test(value.proofDigest) || value.proofDigest === GENESIS_HASH) {
      throw new SyntheticKeyLifecycleProofError('PROOF_INVALID', 'Synthetic key lifecycle proof digest is invalid');
    }
    if (this.#seenProofDigests.has(value.proofDigest)) {
      throw new SyntheticKeyLifecycleProofError('PROOF_REUSED', 'Synthetic key lifecycle proof digest was already used');
    }
    return value as Record<string, unknown> & { readonly expectedEpoch: number; readonly proofDigest: string };
  }

  #advance(
    event: string,
    proofDigest: string,
    next: Pick<SyntheticKeyLifecycleSnapshot, 'lifecycle' | 'keyHandleId' | 'protectorId' | 'plaintextLeaseCount' | 'acceptingNewLeases'>
  ): SyntheticKeyLifecycleSnapshot {
    const epoch = this.#state.epoch + 1;
    const eventChainHash = createHash('sha256')
      .update(JSON.stringify(['PPT-SYNTHETIC-KEY-LIFECYCLE-EVENT-V1', this.#state.eventChainHash, epoch, event, proofDigest]), 'utf8')
      .digest('hex');
    const candidate = freezeSnapshot({
      schemaVersion: 1,
      evidenceClass: 'synthetic-key-lifecycle-non-authoritative',
      epoch,
      ...next,
      lastProofDigest: proofDigest,
      eventChainHash,
      keyMaterialExposed: false,
      syntheticOnly: true,
      realKeyMaterialAccessed: false,
      productionGateSatisfied: false,
      productionSubmissionAllowed: false,
      cutoverAuthorityAttached: false
    });
    this.#assertInvariant(candidate);
    this.#seenProofDigests.add(proofDigest);
    this.#state = candidate;
    return this.#state;
  }

  #assertInvariant(candidate: SyntheticKeyLifecycleSnapshot): void {
    const detached = candidate.lifecycle === 'detached';
    const leaseExpected = candidate.lifecycle === 'session-open' || candidate.lifecycle === 'sealing';
    const acceptingExpected = candidate.lifecycle === 'protected';
    if (
      (detached !== (candidate.keyHandleId === null || candidate.protectorId === null))
      || (!detached && (candidate.keyHandleId === null || candidate.protectorId === null))
      || candidate.plaintextLeaseCount !== (leaseExpected ? 1 : 0)
      || candidate.acceptingNewLeases !== acceptingExpected
      || candidate.keyMaterialExposed !== false
      || candidate.productionGateSatisfied !== false
      || candidate.productionSubmissionAllowed !== false
    ) {
      throw new SyntheticKeyLifecycleProofError('INVARIANT_VIOLATION', 'Synthetic key lifecycle invariant failed');
    }
  }
}
