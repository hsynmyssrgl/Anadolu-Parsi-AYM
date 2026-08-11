import { createHash } from 'node:crypto';
import {
  CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH,
  canonicalizeCoreServiceCutoverReadinessEntry,
  type CoreServiceFamilyDataCutoverGateId,
  type CoreServiceFamilyDataCutoverReadinessEntryContract,
  type CoreServiceFamilyDataCutoverReadinessStatusContract
} from '@ppt/core-service-contracts';
import { CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES } from './family-data-cutover-guard.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ENTRY_KEYS = Object.freeze(['epoch', 'gateId', 'status', 'evidenceDigest', 'previousHash', 'entryHash', 'acceptedAt']);
const hasExactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};

export interface CoreServiceCutoverReadinessEvidenceClaim {
  readonly epoch: number;
  readonly gateId: CoreServiceFamilyDataCutoverGateId;
  readonly status: 'pass';
  readonly evidenceDigest: string;
  readonly verificationBinding: string;
}

export interface CoreServiceCutoverReadinessEvidenceVerifier {
  verify(claim: CoreServiceCutoverReadinessEvidenceClaim): boolean;
}

export interface CoreServiceCutoverReadinessTrustedAnchor {
  readonly epoch: number;
  readonly entryCount: number;
  readonly headHash: string;
}

export interface CoreServiceCutoverReadinessLedgerOptions {
  readonly clock?: () => string;
  readonly verifier?: CoreServiceCutoverReadinessEvidenceVerifier;
  readonly restoredEntries?: readonly CoreServiceFamilyDataCutoverReadinessEntryContract[];
  readonly trustedAnchor?: CoreServiceCutoverReadinessTrustedAnchor;
}

export type CoreServiceCutoverReadinessErrorCode =
  | 'EVIDENCE_VERIFIER_UNAVAILABLE'
  | 'EVIDENCE_REJECTED'
  | 'EPOCH_INVALID'
  | 'STATE_REGRESSION'
  | 'JOURNAL_TAMPERED'
  | 'TRUSTED_ANCHOR_REQUIRED';

export class CoreServiceCutoverReadinessError extends Error {
  public readonly code: CoreServiceCutoverReadinessErrorCode;

  public constructor(code: CoreServiceCutoverReadinessErrorCode, message: string) {
    super(message);
    this.name = 'CoreServiceCutoverReadinessError';
    this.code = code;
  }
}

const hashEntry = (entry: Omit<CoreServiceFamilyDataCutoverReadinessEntryContract, 'entryHash'>): string =>
  createHash('sha256').update(canonicalizeCoreServiceCutoverReadinessEntry(entry), 'utf8').digest('hex');

const validTimestamp = (value: string): boolean => {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

const freezeEntry = (
  entry: CoreServiceFamilyDataCutoverReadinessEntryContract
): CoreServiceFamilyDataCutoverReadinessEntryContract => Object.freeze({
  epoch: entry.epoch,
  gateId: entry.gateId,
  status: entry.status,
  evidenceDigest: entry.evidenceDigest,
  previousHash: entry.previousHash,
  entryHash: entry.entryHash,
  acceptedAt: entry.acceptedAt
});

export class CoreServiceFamilyDataCutoverReadinessLedger {
  readonly #clock: () => string;
  readonly #verifier: CoreServiceCutoverReadinessEvidenceVerifier | undefined;
  readonly #trustedAnchorAttached: boolean;
  readonly #entries: CoreServiceFamilyDataCutoverReadinessEntryContract[];

  public constructor(options: CoreServiceCutoverReadinessLedgerOptions = {}) {
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#verifier = options.verifier;
    this.#entries = this.#restore(options.restoredEntries ?? [], options.trustedAnchor);
    this.#trustedAnchorAttached = options.trustedAnchor !== undefined;
  }

  public append(claim: CoreServiceCutoverReadinessEvidenceClaim): CoreServiceFamilyDataCutoverReadinessStatusContract {
    const expectedEpoch = this.#entries.length + 1;
    if (!Number.isSafeInteger(claim.epoch) || claim.epoch !== expectedEpoch) {
      throw new CoreServiceCutoverReadinessError('EPOCH_INVALID', 'Cutover-readiness evidence epoch must advance by exactly one');
    }
    if (!CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.includes(claim.gateId)) {
      throw new CoreServiceCutoverReadinessError('EVIDENCE_REJECTED', 'Cutover-readiness evidence gate is not recognized');
    }
    if (claim.status !== 'pass' || !SHA256_PATTERN.test(claim.evidenceDigest)) {
      throw new CoreServiceCutoverReadinessError('EVIDENCE_REJECTED', 'Cutover-readiness PASS evidence is malformed');
    }
    if (this.#entries.some((entry) => entry.gateId === claim.gateId)) {
      throw new CoreServiceCutoverReadinessError('STATE_REGRESSION', 'A completed cutover-readiness gate cannot be replaced or regressed');
    }
    if (typeof claim.verificationBinding !== 'string' || claim.verificationBinding.length < 1 || claim.verificationBinding.length > 8_192) {
      throw new CoreServiceCutoverReadinessError('EVIDENCE_REJECTED', 'Cutover-readiness verification binding is malformed');
    }
    if (!this.#verifier) {
      throw new CoreServiceCutoverReadinessError('EVIDENCE_VERIFIER_UNAVAILABLE', 'No trusted cutover-readiness evidence verifier is attached');
    }
    let verified = false;
    try {
      verified = this.#verifier.verify(Object.freeze({ ...claim }));
    } catch {
      verified = false;
    }
    if (!verified) throw new CoreServiceCutoverReadinessError('EVIDENCE_REJECTED', 'Cutover-readiness evidence verification failed');

    const acceptedAt = this.#clock();
    if (!validTimestamp(acceptedAt)) throw new CoreServiceCutoverReadinessError('EVIDENCE_REJECTED', 'Cutover-readiness acceptance timestamp is invalid');
    const unsigned = Object.freeze({
      epoch: claim.epoch,
      gateId: claim.gateId,
      status: 'pass' as const,
      evidenceDigest: claim.evidenceDigest,
      previousHash: this.#headHash(),
      acceptedAt
    });
    this.#entries.push(freezeEntry({ ...unsigned, entryHash: hashEntry(unsigned) }));
    return this.status();
  }

  public status(): CoreServiceFamilyDataCutoverReadinessStatusContract {
    const accepted = new Map(this.#entries.map((entry) => [entry.gateId, entry]));
    const requiredGates = CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.map((id) => {
      const entry = accepted.get(id);
      return Object.freeze({
        id,
        status: entry ? 'pass' as const : 'pending' as const,
        evidenceEpoch: entry?.epoch ?? null,
        evidenceDigest: entry?.evidenceDigest ?? null
      });
    });
    const allRequiredGatesPass = requiredGates.every((gate) => gate.status === 'pass');
    return Object.freeze({
      schemaVersion: 1,
      mode: 'monotonic-evidence-no-cutover',
      decision: 'blocked',
      ledgerEpoch: this.#entries.length,
      entryCount: this.#entries.length,
      headHash: this.#headHash(),
      verifierAttached: this.#verifier !== undefined,
      trustedAnchorAttached: this.#trustedAnchorAttached,
      integrity: 'verified',
      acceptanceState: allRequiredGatesPass ? 'all-gates-pass-cutover-still-blocked' : 'incomplete',
      allRequiredGatesPass,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      requiredGates: Object.freeze(requiredGates),
      entries: Object.freeze([...this.#entries]),
      reasons: Object.freeze([
        'DEC_171_CUTOVER_REMAINS_BLOCKED',
        allRequiredGatesPass ? 'SEPARATE_VERSIONED_USER_DECISION_REQUIRED' : 'ALL_INDEPENDENT_GATES_MUST_PASS'
      ]),
      observedAt: this.#clock()
    });
  }

  #headHash(): string {
    return this.#entries.at(-1)?.entryHash ?? CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH;
  }

  #restore(
    restored: readonly CoreServiceFamilyDataCutoverReadinessEntryContract[],
    anchor: CoreServiceCutoverReadinessTrustedAnchor | undefined
  ): CoreServiceFamilyDataCutoverReadinessEntryContract[] {
    if (restored.length > CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.length) {
      throw new CoreServiceCutoverReadinessError('JOURNAL_TAMPERED', 'Cutover-readiness journal contains too many entries');
    }
    if (restored.length > 0 && !anchor) {
      throw new CoreServiceCutoverReadinessError('TRUSTED_ANCHOR_REQUIRED', 'A non-empty cutover-readiness journal requires a trusted anchor');
    }
    const entries: CoreServiceFamilyDataCutoverReadinessEntryContract[] = [];
    const gates = new Set<CoreServiceFamilyDataCutoverGateId>();
    let previousHash: string = CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH;
    for (const [index, candidate] of restored.entries()) {
      const unsigned = {
        epoch: candidate.epoch,
        gateId: candidate.gateId,
        status: candidate.status,
        evidenceDigest: candidate.evidenceDigest,
        previousHash: candidate.previousHash,
        acceptedAt: candidate.acceptedAt
      };
      if (
        !candidate
        || typeof candidate !== 'object'
        || !hasExactKeys(candidate, ENTRY_KEYS)
        || candidate.epoch !== index + 1
        || candidate.status !== 'pass'
        || !CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.includes(candidate.gateId)
        || gates.has(candidate.gateId)
        || !SHA256_PATTERN.test(candidate.evidenceDigest)
        || candidate.previousHash !== previousHash
        || !validTimestamp(candidate.acceptedAt)
        || !SHA256_PATTERN.test(candidate.entryHash)
        || hashEntry(unsigned) !== candidate.entryHash
      ) throw new CoreServiceCutoverReadinessError('JOURNAL_TAMPERED', 'Cutover-readiness journal integrity validation failed');
      gates.add(candidate.gateId);
      previousHash = candidate.entryHash;
      entries.push(freezeEntry(candidate));
    }
    const expectedHead = entries.at(-1)?.entryHash ?? CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH;
    if (anchor && (
      !Number.isSafeInteger(anchor.epoch)
      || anchor.epoch !== entries.length
      || anchor.entryCount !== entries.length
      || anchor.headHash !== expectedHead
    )) throw new CoreServiceCutoverReadinessError('JOURNAL_TAMPERED', 'Cutover-readiness journal does not match its trusted anchor');
    return entries;
  }
}
