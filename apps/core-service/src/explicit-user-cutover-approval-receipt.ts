import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENESIS_HASH = '0'.repeat(64);
const RECEIPT_KEYS = Object.freeze([
  'action',
  'approvalSubjectId',
  'approvedAt',
  'authoritativeSourceSha256',
  'decisionId',
  'decisionVersion',
  'expiresAt',
  'readinessLedgerHeadHash',
  'schemaVersion',
  'verificationBinding'
] as const);
const TECHNICAL_GATE_KEYS = Object.freeze(['id', 'status'] as const);

export const EXPLICIT_USER_APPROVAL_MAX_LIFETIME_MS = 15 * 60 * 1_000;

export const TECHNICAL_CUTOVER_GATES = Object.freeze([
  'END_TO_END_SECURITY_VALIDATION',
  'KEY_LIFECYCLE_PROOF',
  'SINGLE_WRITER_PROOF',
  'ROLLBACK_DRILL'
] as const);

export type TechnicalCutoverGateId = typeof TECHNICAL_CUTOVER_GATES[number];

export interface TechnicalCutoverGateState {
  readonly id: TechnicalCutoverGateId;
  readonly status: 'pending' | 'pass';
}

export interface ExplicitUserCutoverApprovalReceipt {
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly decisionVersion: number;
  readonly action: 'approve-family-data-cutover';
  readonly approvalSubjectId: string;
  readonly authoritativeSourceSha256: string;
  readonly readinessLedgerHeadHash: string;
  readonly approvedAt: string;
  readonly expiresAt: string;
  readonly verificationBinding: string;
}

export interface ExplicitUserCutoverApprovalVerifier {
  verify(receipt: Readonly<ExplicitUserCutoverApprovalReceipt>): boolean;
}

export interface ExplicitUserApprovalEvaluationInput {
  readonly receipt: unknown;
  readonly technicalGates: unknown;
  readonly expectedAuthoritativeSourceSha256: string;
  readonly expectedReadinessLedgerHeadHash: string;
}

export interface ExplicitUserApprovalEvaluation {
  readonly schemaVersion: 1;
  readonly mode: 'explicit-user-approval-evidence-intake-no-cutover';
  readonly modeledGate: 'EXPLICIT_USER_CUTOVER_APPROVAL';
  readonly decision: 'blocked';
  readonly technicalGatesSatisfied: boolean;
  readonly verifierAttached: boolean;
  readonly approvalEvidenceAccepted: boolean;
  readonly eligibleForReadinessLedgerSubmission: boolean;
  readonly approvalEvidenceDigest: string | null;
  readonly approvalReceiptCreatedByBoundary: false;
  readonly readinessLedgerSubmissionPerformed: false;
  readonly receiptConsumed: false;
  readonly productionRuntimeWiring: false;
  readonly realDataAccessed: false;
  readonly cutoverAuthorityAttached: false;
  readonly automaticActivationAllowed: false;
  readonly reasons: readonly string[];
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

const parseCanonicalTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value ? milliseconds : null;
};

export class ExplicitUserApprovalReceiptIntake {
  readonly #verifier: ExplicitUserCutoverApprovalVerifier | undefined;
  readonly #clock: () => string;

  public constructor(options: {
    readonly verifier?: ExplicitUserCutoverApprovalVerifier;
    readonly clock?: () => string;
  } = {}) {
    this.#verifier = options.verifier;
    this.#clock = options.clock ?? (() => new Date().toISOString());
  }

  public evaluate(input: ExplicitUserApprovalEvaluationInput): ExplicitUserApprovalEvaluation {
    const technicalGatesSatisfied = this.#technicalGatesPass(input.technicalGates);
    if (!technicalGatesSatisfied) return this.#blocked('TECHNICAL_CUTOVER_GATES_INCOMPLETE', false);
    if (input.receipt === null || input.receipt === undefined) {
      return this.#blocked('EXPLICIT_USER_APPROVAL_RECEIPT_REQUIRED', true);
    }
    if (!this.#verifier) return this.#blocked('EXPLICIT_USER_APPROVAL_VERIFIER_UNAVAILABLE', true);

    const receipt = this.#validatedReceipt(
      input.receipt,
      input.expectedAuthoritativeSourceSha256,
      input.expectedReadinessLedgerHeadHash
    );
    if (!receipt) return this.#blocked('EXPLICIT_USER_APPROVAL_RECEIPT_INVALID', true);

    const verifierInput = Object.freeze({ ...receipt });
    let verified = false;
    try {
      verified = this.#verifier.verify(verifierInput) === true;
    } catch {
      verified = false;
    }
    if (!verified) return this.#blocked('EXPLICIT_USER_APPROVAL_RECEIPT_REJECTED', true);

    const canonical = JSON.stringify([
      'PPT-EXPLICIT-USER-CUTOVER-APPROVAL-RECEIPT-V1',
      receipt.schemaVersion,
      receipt.decisionId,
      receipt.decisionVersion,
      receipt.action,
      receipt.approvalSubjectId,
      receipt.authoritativeSourceSha256,
      receipt.readinessLedgerHeadHash,
      receipt.approvedAt,
      receipt.expiresAt,
      receipt.verificationBinding
    ]);
    return Object.freeze({
      schemaVersion: 1,
      mode: 'explicit-user-approval-evidence-intake-no-cutover',
      modeledGate: 'EXPLICIT_USER_CUTOVER_APPROVAL',
      decision: 'blocked',
      technicalGatesSatisfied: true,
      verifierAttached: true,
      approvalEvidenceAccepted: true,
      eligibleForReadinessLedgerSubmission: true,
      approvalEvidenceDigest: createHash('sha256').update(canonical, 'utf8').digest('hex'),
      approvalReceiptCreatedByBoundary: false,
      readinessLedgerSubmissionPerformed: false,
      receiptConsumed: false,
      productionRuntimeWiring: false,
      realDataAccessed: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false,
      reasons: Object.freeze([
        'EXPLICIT_USER_APPROVAL_EVIDENCE_ELIGIBLE',
        'DEC_171_CUTOVER_REMAINS_BLOCKED',
        'SEPARATE_VERSIONED_SUCCESSOR_DECISION_REQUIRED'
      ])
    });
  }

  #technicalGatesPass(candidate: unknown): candidate is readonly TechnicalCutoverGateState[] {
    if (!Array.isArray(candidate) || candidate.length !== TECHNICAL_CUTOVER_GATES.length) return false;
    const seen = new Set<TechnicalCutoverGateId>();
    for (const gate of candidate) {
      if (!isPlainDataObjectWithExactKeys(gate, TECHNICAL_GATE_KEYS)) return false;
      if (typeof gate.id !== 'string' || !TECHNICAL_CUTOVER_GATES.includes(gate.id as TechnicalCutoverGateId)) return false;
      const id = gate.id as TechnicalCutoverGateId;
      if (gate.status !== 'pass' || seen.has(id)) return false;
      seen.add(id);
    }
    return TECHNICAL_CUTOVER_GATES.every((id) => seen.has(id));
  }

  #validatedReceipt(candidate: unknown, expectedSource: unknown, expectedHead: unknown): ExplicitUserCutoverApprovalReceipt | null {
    if (!isPlainDataObjectWithExactKeys(candidate, RECEIPT_KEYS)) return null;
    if (!isNonGenesisSha256(expectedSource) || !isNonGenesisSha256(expectedHead)) return null;
    if (!isNonGenesisSha256(candidate.authoritativeSourceSha256) || !isNonGenesisSha256(candidate.readinessLedgerHeadHash)) return null;
    if (candidate.authoritativeSourceSha256 !== expectedSource || candidate.readinessLedgerHeadHash !== expectedHead) return null;

    const approvedAt = parseCanonicalTimestamp(candidate.approvedAt);
    const expiresAt = parseCanonicalTimestamp(candidate.expiresAt);
    let observedAt: number | null = null;
    try {
      observedAt = parseCanonicalTimestamp(this.#clock());
    } catch {
      observedAt = null;
    }
    if (approvedAt === null || expiresAt === null || observedAt === null) return null;

    const structurallyValid = candidate.schemaVersion === 1
      && candidate.action === 'approve-family-data-cutover'
      && typeof candidate.decisionId === 'string'
      && /^[A-Z0-9][A-Z0-9._-]{2,127}$/u.test(candidate.decisionId)
      && Number.isSafeInteger(candidate.decisionVersion)
      && Number(candidate.decisionVersion) >= 1
      && typeof candidate.approvalSubjectId === 'string'
      && /^[a-z0-9][a-z0-9._:-]{2,127}$/u.test(candidate.approvalSubjectId)
      && typeof candidate.verificationBinding === 'string'
      && /^[A-Za-z0-9_-]{32,8192}$/u.test(candidate.verificationBinding)
      && approvedAt < expiresAt
      && expiresAt - approvedAt <= EXPLICIT_USER_APPROVAL_MAX_LIFETIME_MS
      && approvedAt <= observedAt
      && observedAt < expiresAt;
    return structurallyValid ? candidate as unknown as ExplicitUserCutoverApprovalReceipt : null;
  }

  #blocked(reason: string, technicalGatesSatisfied: boolean): ExplicitUserApprovalEvaluation {
    return Object.freeze({
      schemaVersion: 1,
      mode: 'explicit-user-approval-evidence-intake-no-cutover',
      modeledGate: 'EXPLICIT_USER_CUTOVER_APPROVAL',
      decision: 'blocked',
      technicalGatesSatisfied,
      verifierAttached: this.#verifier !== undefined,
      approvalEvidenceAccepted: false,
      eligibleForReadinessLedgerSubmission: false,
      approvalEvidenceDigest: null,
      approvalReceiptCreatedByBoundary: false,
      readinessLedgerSubmissionPerformed: false,
      receiptConsumed: false,
      productionRuntimeWiring: false,
      realDataAccessed: false,
      cutoverAuthorityAttached: false,
      automaticActivationAllowed: false,
      reasons: Object.freeze([reason, 'DEC_171_CUTOVER_REMAINS_BLOCKED'])
    });
  }
}
