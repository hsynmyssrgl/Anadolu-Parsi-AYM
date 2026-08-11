const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENESIS_PROOF_DIGEST = '0'.repeat(64);
const TRANSFER_KEYS = Object.freeze([
  'expectedEpoch',
  'from',
  'to',
  'desktopWritable',
  'coreServiceWritable',
  'previousProofDigest',
  'proofDigest'
] as const);

export type SyntheticWriterOwner = 'desktop' | 'core-service';

export interface SyntheticSingleWriterSnapshot {
  readonly schemaVersion: 1;
  readonly evidenceClass: 'synthetic-single-writer-non-authoritative';
  readonly epoch: number;
  readonly owner: SyntheticWriterOwner;
  readonly desktopWritable: boolean;
  readonly coreServiceWritable: boolean;
  readonly previousProofDigest: string;
  readonly proofDigest: string;
  readonly syntheticOnly: true;
  readonly realGateSatisfied: false;
  readonly cutoverAuthorityAttached: false;
  readonly realDataAccessed: false;
}

export interface SyntheticSingleWriterTransfer {
  readonly expectedEpoch: number;
  readonly from: SyntheticWriterOwner;
  readonly to: SyntheticWriterOwner;
  readonly desktopWritable: boolean;
  readonly coreServiceWritable: boolean;
  readonly previousProofDigest: string;
  readonly proofDigest: string;
}

export type SyntheticSingleWriterProofErrorCode =
  | 'MALFORMED_TRANSFER'
  | 'STALE_EPOCH'
  | 'STALE_PROOF'
  | 'OWNER_MISMATCH'
  | 'DUAL_WRITER'
  | 'PROOF_INVALID';

export class SyntheticSingleWriterProofError extends Error {
  public readonly code: SyntheticSingleWriterProofErrorCode;

  public constructor(code: SyntheticSingleWriterProofErrorCode, message: string) {
    super(message);
    this.name = 'SyntheticSingleWriterProofError';
    this.code = code;
  }
}

const isOwner = (value: unknown): value is SyntheticWriterOwner =>
  value === 'desktop' || value === 'core-service';

const hasExactTransferKeys = (candidate: object): boolean => {
  const actual = Object.keys(candidate).sort();
  const expected = [...TRANSFER_KEYS].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const freezeSnapshot = (
  snapshot: SyntheticSingleWriterSnapshot
): SyntheticSingleWriterSnapshot => Object.freeze({ ...snapshot });

export class SyntheticSingleWriterProofHarness {
  #state: SyntheticSingleWriterSnapshot = freezeSnapshot({
    schemaVersion: 1,
    evidenceClass: 'synthetic-single-writer-non-authoritative',
    epoch: 0,
    owner: 'desktop',
    desktopWritable: true,
    coreServiceWritable: false,
    previousProofDigest: GENESIS_PROOF_DIGEST,
    proofDigest: GENESIS_PROOF_DIGEST,
    syntheticOnly: true,
    realGateSatisfied: false,
    cutoverAuthorityAttached: false,
    realDataAccessed: false
  });

  public snapshot(): SyntheticSingleWriterSnapshot {
    return this.#state;
  }

  public transfer(input: SyntheticSingleWriterTransfer): SyntheticSingleWriterSnapshot {
    const candidate: unknown = input;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !hasExactTransferKeys(candidate)) {
      throw new SyntheticSingleWriterProofError('MALFORMED_TRANSFER', 'Synthetic writer transfer shape is invalid');
    }
    const value = candidate as Record<string, unknown>;
    if (!Number.isSafeInteger(value.expectedEpoch) || (value.expectedEpoch as number) < 0) {
      throw new SyntheticSingleWriterProofError('MALFORMED_TRANSFER', 'Synthetic writer epoch is invalid');
    }
    if (value.expectedEpoch !== this.#state.epoch) {
      throw new SyntheticSingleWriterProofError('STALE_EPOCH', 'Synthetic writer epoch is stale');
    }
    if (!isOwner(value.from) || !isOwner(value.to) || value.from !== this.#state.owner || value.from === value.to) {
      throw new SyntheticSingleWriterProofError('OWNER_MISMATCH', 'Synthetic writer owner transition is invalid');
    }
    if (typeof value.desktopWritable !== 'boolean' || typeof value.coreServiceWritable !== 'boolean') {
      throw new SyntheticSingleWriterProofError('MALFORMED_TRANSFER', 'Synthetic writer flags are invalid');
    }
    if (value.desktopWritable === value.coreServiceWritable) {
      throw new SyntheticSingleWriterProofError('DUAL_WRITER', 'Exactly one synthetic writer must be active');
    }
    if (
      (value.to === 'desktop' && (!value.desktopWritable || value.coreServiceWritable))
      || (value.to === 'core-service' && (value.desktopWritable || !value.coreServiceWritable))
    ) {
      throw new SyntheticSingleWriterProofError('OWNER_MISMATCH', 'Synthetic writer flags do not match the proposed owner');
    }
    if (typeof value.previousProofDigest !== 'string' || !SHA256_PATTERN.test(value.previousProofDigest)) {
      throw new SyntheticSingleWriterProofError('PROOF_INVALID', 'Previous synthetic proof digest is invalid');
    }
    if (value.previousProofDigest !== this.#state.proofDigest) {
      throw new SyntheticSingleWriterProofError('STALE_PROOF', 'Previous synthetic proof digest is stale');
    }
    if (
      typeof value.proofDigest !== 'string'
      || !SHA256_PATTERN.test(value.proofDigest)
      || value.proofDigest === value.previousProofDigest
    ) {
      throw new SyntheticSingleWriterProofError('PROOF_INVALID', 'Synthetic writer proof digest is invalid or reused');
    }

    this.#state = freezeSnapshot({
      schemaVersion: 1,
      evidenceClass: 'synthetic-single-writer-non-authoritative',
      epoch: this.#state.epoch + 1,
      owner: value.to,
      desktopWritable: value.desktopWritable,
      coreServiceWritable: value.coreServiceWritable,
      previousProofDigest: value.previousProofDigest,
      proofDigest: value.proofDigest,
      syntheticOnly: true,
      realGateSatisfied: false,
      cutoverAuthorityAttached: false,
      realDataAccessed: false
    });
    return this.#state;
  }
}

