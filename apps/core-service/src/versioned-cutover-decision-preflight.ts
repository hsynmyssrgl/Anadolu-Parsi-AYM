import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENESIS_HASH = '0'.repeat(64);
const INPUT_KEYS = Object.freeze([
  'expectedAuthoritativeSourceSha256',
  'gates',
  'observedAuthoritativeSourceSha256',
  'readinessLedgerEntryCount',
  'readinessLedgerEpoch',
  'readinessLedgerHeadHash',
  'readinessLedgerIntegrityVerified',
  'readinessLedgerTrustedAnchorAttached'
] as const);
const GATE_KEYS = Object.freeze(['evidenceDigest', 'id', 'status'] as const);

export const VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES = Object.freeze([
  'END_TO_END_SECURITY_VALIDATION',
  'KEY_LIFECYCLE_PROOF',
  'SINGLE_WRITER_PROOF',
  'ROLLBACK_DRILL',
  'EXPLICIT_USER_CUTOVER_APPROVAL'
] as const);

export type VersionedCutoverPreflightGateId = typeof VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES[number];

export interface VersionedCutoverPreflightGateState {
  readonly id: VersionedCutoverPreflightGateId;
  readonly status: 'pending' | 'pass';
  readonly evidenceDigest: string | null;
}

export interface VersionedCutoverDecisionPreflightInput {
  readonly expectedAuthoritativeSourceSha256: string;
  readonly observedAuthoritativeSourceSha256: string;
  readonly readinessLedgerEpoch: number;
  readonly readinessLedgerEntryCount: number;
  readonly readinessLedgerHeadHash: string;
  readonly readinessLedgerIntegrityVerified: boolean;
  readonly readinessLedgerTrustedAnchorAttached: boolean;
  readonly gates: readonly VersionedCutoverPreflightGateState[];
}

export interface VersionedCutoverDecisionPreflight {
  readonly schemaVersion: 1;
  readonly preflightClass: 'read-only-successor-decision-preflight-non-authoritative';
  readonly currentDecision: 'DEC-171';
  readonly decision: 'blocked';
  readonly preflightDigest: string;
  readonly allRequiredGatesPass: boolean;
  readonly authoritativeSourceSealVerified: boolean;
  readonly readinessLedgerIntegrityVerified: boolean;
  readonly readinessLedgerTrustedAnchorAttached: boolean;
  readonly readinessLedgerEvidenceReady: boolean;
  readonly eligibleForSuccessorDecision: boolean;
  readonly successorDecisionRequired: true;
  readonly successorDecisionCreated: false;
  readonly versionedDecisionSubmissionPerformed: false;
  readonly productionRuntimeWiring: false;
  readonly independentEvidenceVerificationPerformed: false;
  readonly userConsentCreatedByBoundary: false;
  readonly cutoverAuthorityAttached: false;
  readonly automaticActivationAllowed: false;
  readonly realDataTransferAllowed: false;
  readonly writeOwnershipTransferAllowed: false;
  readonly reasons: readonly string[];
}

export type VersionedCutoverDecisionPreflightErrorCode =
  | 'INPUT_MALFORMED'
  | 'DIGEST_INVALID'
  | 'GATE_SET_INVALID'
  | 'GATE_DUPLICATE'
  | 'GATE_STATE_INVALID'
  | 'EVIDENCE_REUSED'
  | 'LEDGER_SNAPSHOT_INVALID';

export class VersionedCutoverDecisionPreflightError extends Error {
  public readonly code: VersionedCutoverDecisionPreflightErrorCode;

  public constructor(code: VersionedCutoverDecisionPreflightErrorCode, message: string) {
    super(message);
    this.name = 'VersionedCutoverDecisionPreflightError';
    this.code = code;
  }
}

const isPlainDataObjectWithExactKeys = (candidate: unknown, expected: readonly string[]): candidate is Record<string, unknown> => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Object.keys(candidate).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || !actual.every((key, index) => key === sortedExpected[index])) return false;
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  return actual.every((key) => {
    const descriptor = descriptors[key];
    return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor;
  });
};

const isNonGenesisSha256 = (value: unknown): value is string =>
  typeof value === 'string' && SHA256_PATTERN.test(value) && value !== GENESIS_HASH;

const preflightError = (code: VersionedCutoverDecisionPreflightErrorCode, message: string): never => {
  throw new VersionedCutoverDecisionPreflightError(code, message);
};

export const evaluateVersionedCutoverDecisionPreflight = (candidate: unknown): VersionedCutoverDecisionPreflight => {
  if (!isPlainDataObjectWithExactKeys(candidate, INPUT_KEYS)) {
    return preflightError('INPUT_MALFORMED', 'Versioned cutover preflight input shape is invalid');
  }
  if (
    !isNonGenesisSha256(candidate.expectedAuthoritativeSourceSha256)
    || !isNonGenesisSha256(candidate.observedAuthoritativeSourceSha256)
    || !isNonGenesisSha256(candidate.readinessLedgerHeadHash)
  ) return preflightError('DIGEST_INVALID', 'Versioned cutover preflight requires non-genesis lowercase SHA-256 seals');
  if (typeof candidate.readinessLedgerIntegrityVerified !== 'boolean' || typeof candidate.readinessLedgerTrustedAnchorAttached !== 'boolean') {
    return preflightError('INPUT_MALFORMED', 'Versioned cutover preflight ledger booleans are invalid');
  }
  if (
    !Number.isSafeInteger(candidate.readinessLedgerEpoch)
    || !Number.isSafeInteger(candidate.readinessLedgerEntryCount)
    || Number(candidate.readinessLedgerEpoch) < 0
    || Number(candidate.readinessLedgerEntryCount) < 0
    || Number(candidate.readinessLedgerEpoch) > VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.length
    || Number(candidate.readinessLedgerEntryCount) > VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.length
  ) return preflightError('LEDGER_SNAPSHOT_INVALID', 'Versioned cutover preflight ledger counters are invalid');
  if (!Array.isArray(candidate.gates) || candidate.gates.length !== VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.length) {
    return preflightError('GATE_SET_INVALID', 'Versioned cutover preflight requires the exact five-gate set');
  }

  const gates = new Map<VersionedCutoverPreflightGateId, VersionedCutoverPreflightGateState>();
  const evidenceDigests = new Set<string>();
  for (const gate of candidate.gates) {
    if (!isPlainDataObjectWithExactKeys(gate, GATE_KEYS)) {
      return preflightError('GATE_SET_INVALID', 'Versioned cutover preflight gate shape is invalid');
    }
    if (typeof gate.id !== 'string' || !VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.includes(gate.id as VersionedCutoverPreflightGateId)) {
      return preflightError('GATE_SET_INVALID', 'Versioned cutover preflight gate is not recognized');
    }
    const id = gate.id as VersionedCutoverPreflightGateId;
    if (gates.has(id)) return preflightError('GATE_DUPLICATE', 'Versioned cutover preflight gates must be unique');
    if (gate.status !== 'pending' && gate.status !== 'pass') {
      return preflightError('GATE_STATE_INVALID', 'Versioned cutover preflight gate status is invalid');
    }
    let evidenceDigest: string | null;
    if (gate.status === 'pending') {
      if (gate.evidenceDigest !== null) {
        return preflightError('GATE_STATE_INVALID', 'A pending cutover gate cannot carry evidence');
      }
      evidenceDigest = null;
    } else {
      if (!isNonGenesisSha256(gate.evidenceDigest)) {
        return preflightError('DIGEST_INVALID', 'A PASS cutover gate requires non-genesis lowercase SHA-256 evidence');
      }
      if (evidenceDigests.has(gate.evidenceDigest)) {
        return preflightError('EVIDENCE_REUSED', 'Cutover gate evidence digests must be globally unique');
      }
      evidenceDigests.add(gate.evidenceDigest);
      evidenceDigest = gate.evidenceDigest;
    }
    gates.set(id, Object.freeze({ id, status: gate.status, evidenceDigest }));
  }
  if (!VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.every((id) => gates.has(id))) {
    return preflightError('GATE_SET_INVALID', 'Versioned cutover preflight requires every canonical gate');
  }

  const passCount = [...gates.values()].filter((gate) => gate.status === 'pass').length;
  if (
    candidate.readinessLedgerEpoch !== candidate.readinessLedgerEntryCount
    || candidate.readinessLedgerEntryCount !== passCount
  ) return preflightError('LEDGER_SNAPSHOT_INVALID', 'Readiness ledger counters must equal the exact PASS gate count');

  const allRequiredGatesPass = passCount === VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.length;
  const authoritativeSourceSealVerified = candidate.expectedAuthoritativeSourceSha256 === candidate.observedAuthoritativeSourceSha256;
  const readinessLedgerEvidenceReady = candidate.readinessLedgerIntegrityVerified && candidate.readinessLedgerTrustedAnchorAttached;
  const eligibleForSuccessorDecision = allRequiredGatesPass && authoritativeSourceSealVerified && readinessLedgerEvidenceReady;
  const canonicalGates = VERSIONED_CUTOVER_PREFLIGHT_REQUIRED_GATES.map((id) => {
    const gate = gates.get(id);
    if (!gate) return preflightError('GATE_SET_INVALID', 'Canonical cutover gate is missing');
    return [gate.id, gate.status, gate.evidenceDigest] as const;
  });
  const preflightDigest = createHash('sha256').update(JSON.stringify([
    'PPT-VERSIONED-CUTOVER-DECISION-PREFLIGHT-V1',
    candidate.expectedAuthoritativeSourceSha256,
    candidate.observedAuthoritativeSourceSha256,
    candidate.readinessLedgerEpoch,
    candidate.readinessLedgerEntryCount,
    candidate.readinessLedgerHeadHash,
    candidate.readinessLedgerIntegrityVerified,
    candidate.readinessLedgerTrustedAnchorAttached,
    canonicalGates
  ]), 'utf8').digest('hex');
  const reasons = eligibleForSuccessorDecision
    ? ['DEC_171_CUTOVER_REMAINS_BLOCKED', 'SEPARATE_VERSIONED_SUCCESSOR_DECISION_REQUIRED']
    : [
        'DEC_171_CUTOVER_REMAINS_BLOCKED',
        ...(!allRequiredGatesPass ? ['ALL_INDEPENDENT_GATES_MUST_PASS'] : []),
        ...(!authoritativeSourceSealVerified ? ['AUTHORITATIVE_SOURCE_SEAL_MISMATCH'] : []),
        ...(!candidate.readinessLedgerIntegrityVerified ? ['READINESS_LEDGER_INTEGRITY_REQUIRED'] : []),
        ...(!candidate.readinessLedgerTrustedAnchorAttached ? ['READINESS_LEDGER_TRUSTED_ANCHOR_REQUIRED'] : [])
      ];
  return Object.freeze({
    schemaVersion: 1,
    preflightClass: 'read-only-successor-decision-preflight-non-authoritative',
    currentDecision: 'DEC-171',
    decision: 'blocked',
    preflightDigest,
    allRequiredGatesPass,
    authoritativeSourceSealVerified,
    readinessLedgerIntegrityVerified: candidate.readinessLedgerIntegrityVerified,
    readinessLedgerTrustedAnchorAttached: candidate.readinessLedgerTrustedAnchorAttached,
    readinessLedgerEvidenceReady,
    eligibleForSuccessorDecision,
    successorDecisionRequired: true,
    successorDecisionCreated: false,
    versionedDecisionSubmissionPerformed: false,
    productionRuntimeWiring: false,
    independentEvidenceVerificationPerformed: false,
    userConsentCreatedByBoundary: false,
    cutoverAuthorityAttached: false,
    automaticActivationAllowed: false,
    realDataTransferAllowed: false,
    writeOwnershipTransferAllowed: false,
    reasons: Object.freeze(reasons)
  });
};
