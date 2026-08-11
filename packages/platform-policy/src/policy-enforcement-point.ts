import { createHash, randomUUID } from 'node:crypto';
import {
  createPlatformDeviceCertificate,
  PlatformPolicyKernel,
  inferPlatformDataClasses,
  normalizePlatformDataClasses,
  platformPolicyContextHash,
  verifyPlatformDeviceCertificate,
  type PlatformApplicationId,
  type PlatformPolicyAuthorization,
  type PlatformCapability,
  type PlatformDataClass,
  type PlatformPolicyDecision,
  type PlatformPolicyDecisionAuthorityId,
  type PlatformDeviceCertificate,
  type PlatformPolicyPackage,
  type PlatformPolicyReceipt,
  type PlatformPolicyRequest,
  type PolicyAction,
  type PolicyConsent,
  type PolicyGrant,
  type PolicyObligation,
  type PolicyResource
} from './policy-kernel.js';

export interface PlatformPolicyIntent {
  readonly correlationId: string;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly purpose: string;
}

export interface PlatformPolicyConnectionAuthority {
  readonly policyVersion: string;
  readonly policyPackageVersion?: number;
  readonly policyPackageSha256?: string;
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  readonly accountId: string;
  readonly personId?: string;
  readonly deviceId: string;
  readonly applicationId: PlatformApplicationId;
  readonly applicationVersion?: string;
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificate?: PlatformDeviceCertificate;
  /** Trusted-device registry fields used once to mint a manifest-bound certificate. */
  readonly devicePublicKeyFingerprintSha256?: string;
  readonly deviceCertificateIssuedAt?: string;
  readonly deviceTrusted: boolean;
  readonly membershipActive: boolean;
  readonly roles: readonly string[];
  readonly familyIds: readonly string[];
  readonly householdIds?: readonly string[];
  readonly familyBranchIds?: readonly string[];
  readonly online: boolean;
  readonly grants?: readonly PolicyGrant[];
  readonly consents?: readonly PolicyConsent[];
  readonly expiresAt: string;
}

export interface PlatformPolicyAuthorityResolver {
  resolve(): Promise<PlatformPolicyConnectionAuthority> | PlatformPolicyConnectionAuthority;
}

export interface PlatformPolicyResourceResolver {
  resolve(intent: PlatformPolicyIntent, authority: PlatformPolicyConnectionAuthority): Promise<PolicyResource> | PolicyResource;
}

export interface PlatformPolicyReceiptRecord {
  readonly correlationId: string;
  readonly contextHash: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly applicationVersion: string;
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificateSha256?: string;
  readonly dataClasses: readonly PlatformDataClass[];
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly request: PlatformPolicyRequest;
  readonly decision: PlatformPolicyDecision;
  readonly receipt: PlatformPolicyReceipt;
  readonly recordedAt: string;
  /** Present on every receipt issued after the strict obligation executor was introduced. */
  readonly obligationExecution?: PlatformPolicyObligationExecution;
}

export interface PlatformPolicyObligationControls {
  readonly localProcessingOnly: boolean;
  readonly allowCache: boolean;
  readonly allowClipboard: boolean;
  readonly allowExport: boolean;
  readonly allowAi: boolean;
  readonly allowRecording: boolean;
  readonly onlineOnly: boolean;
  readonly highDetailAudit: boolean;
  readonly maskedFields: readonly string[];
  readonly watermark?: string;
  readonly deleteAfter?: string;
}

export interface PlatformPolicyExecutedObligation {
  readonly ordinal: number;
  readonly type: PolicyObligation['type'];
  readonly value?: string | readonly string[];
  readonly enforcement: 'PEP_RUNTIME_CONTROL';
}

export interface PlatformPolicyObligationExecution {
  readonly schemaVersion: 1;
  readonly executorId: 'ppt.platform-policy.strict-obligation-executor.v1';
  readonly requestHash: string;
  readonly receiptNonce: string;
  readonly executedAt: string;
  readonly executed: readonly PlatformPolicyExecutedObligation[];
  readonly controls: PlatformPolicyObligationControls;
  readonly attestationHash: string;
}

export interface PlatformPolicyJournalProjectionProof {
  readonly schemaVersion: 1;
  /** SHA-256 of the exact canonical signed receipt. */
  readonly receiptHash: string;
  /** SHA-256 of the complete canonical receipt record. */
  readonly recordHash: string;
  readonly receiptNonce: string;
  readonly entrySequence: number;
  readonly entryHash: string;
  readonly headSequence: number;
  readonly headHash: string;
  /** Exact byte length of the journal prefix ending at headSequence. */
  readonly journalSizeBytes: number;
  readonly issuedAt: string;
  /** HMAC-SHA256 over every preceding proof field using the protected journal MAC key. */
  readonly proofMac: string;
}

export interface PlatformPolicyReceiptSink {
  append(record: PlatformPolicyReceiptRecord): Promise<void> | void;
  /**
   * Idempotently projects an exact receipt. Implementations must only accept an
   * existing nonce when its complete canonical record is identical. Successful
   * projection returns a cryptographic proof created only after durable readback.
   */
  ensure?(record: PlatformPolicyReceiptRecord): Promise<PlatformPolicyJournalProjectionProof> | PlatformPolicyJournalProjectionProof;
  /** Verifies a proof and its anchored journal prefix against current protected storage. */
  verifyProjectionProof?(proof: PlatformPolicyJournalProjectionProof): Promise<boolean> | boolean;
}

export interface PlatformPolicyReplayReservation {
  readonly nonce: string;
  readonly reservedAtMs: number;
  readonly expiresAtMs: number;
}

export interface PlatformPolicyReplayStore {
  reserve(reservation: PlatformPolicyReplayReservation): Promise<boolean> | boolean;
}

export interface PlatformPolicyClusterFenceSnapshot {
  readonly writable: boolean;
  readonly epoch: number;
}

export type PlatformPolicyClusterFence = () => PlatformPolicyClusterFenceSnapshot;

export interface PlatformPolicyProviderAuthorizationInput {
  readonly request: PlatformPolicyRequest;
  readonly nonce: string;
}

export interface PlatformPolicyProviderAuthorizationResult {
  readonly effectiveRequest: PlatformPolicyRequest;
  readonly authorization: PlatformPolicyAuthorization;
}

export interface PlatformPolicyProviderVerificationInput {
  readonly request: PlatformPolicyRequest;
  readonly receipt: PlatformPolicyReceipt;
}

/**
 * Trusted policy-decision boundary used when the signing kernel lives in another
 * process. The provider may only narrow clusterWritable from true to false; the
 * PEP validates every other request field before accepting the result.
 */
export interface PlatformPolicyAuthorizationProvider {
  /** Production Desktop providers must cross the Windows Core Service process boundary. */
  readonly decisionAuthority?: 'windows-core-service';
  /** Trusted package metadata for out-of-process kernels; omission fails closed. */
  readonly resolvePolicyPackage?: (applicationId: PlatformApplicationId) => PlatformPolicyPackage;
  authorize(input: PlatformPolicyProviderAuthorizationInput):
    | Promise<PlatformPolicyProviderAuthorizationResult>
    | PlatformPolicyProviderAuthorizationResult;
  verify(input: PlatformPolicyProviderVerificationInput): Promise<boolean> | boolean;
}

const transactionContextBrand: unique symbol = Symbol('ppt.platform-policy.transaction-context');
const activeTransactionContexts = new WeakMap<object, {
  readonly expiresAtMs: number;
  readonly clock: () => string;
  readonly clusterFence: PlatformPolicyClusterFence;
  readonly fenceEpoch: number;
  readonly fenceWritable: boolean;
}>();
const sharedReplayReservations = new Map<string, number>();
const defaultReplayStore: PlatformPolicyReplayStore = Object.freeze({
  reserve(reservation: PlatformPolicyReplayReservation): boolean {
    for (const [nonce, expiresAtMs] of sharedReplayReservations) {
      if (expiresAtMs < reservation.reservedAtMs) sharedReplayReservations.delete(nonce);
    }
    if (sharedReplayReservations.has(reservation.nonce)) return false;
    sharedReplayReservations.set(reservation.nonce, reservation.expiresAtMs);
    return true;
  }
});

export interface PlatformPolicyTransactionContext {
  readonly [transactionContextBrand]: true;
  readonly correlationId: string;
  readonly requestHash: string;
  readonly contextHash: string;
  readonly policyVersion: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  readonly applicationVersion: string;
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificateSha256?: string;
  readonly subject: PlatformPolicyTransactionSubjectSnapshot;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceFamilyId: string;
  readonly resourceHouseholdId?: string;
  readonly resourceFamilyBranchId?: string;
  readonly resourceOwnerPersonId?: string;
  readonly dataClasses: readonly PlatformDataClass[];
  readonly purpose: string;
  readonly occurredAt: string;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly fenceEpoch: number;
  readonly fenceWritable: boolean;
  readonly decision: PlatformPolicyDecision & { readonly allowed: true; readonly contextHash: string };
  readonly receipt: PlatformPolicyReceipt;
  readonly receiptRecord: PlatformPolicyReceiptRecord;
  readonly obligationExecution: PlatformPolicyObligationExecution;
}

export interface PlatformPolicyTransactionSubjectSnapshot {
  readonly accountId: string;
  readonly personId?: string;
  readonly deviceId: string;
  readonly applicationId: PlatformApplicationId;
  readonly applicationVersion: string;
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificateSha256?: string;
  readonly roles: readonly string[];
  readonly familyIds: readonly string[];
  readonly householdIds: readonly string[];
  readonly familyBranchIds: readonly string[];
}

export interface PlatformPolicyTransactionExpectation {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly correlationId?: string;
  readonly resourceFamilyId?: string;
  readonly resourceHouseholdId?: string;
  readonly resourceFamilyBranchId?: string;
  readonly resourceOwnerPersonId?: string;
  readonly purpose?: string;
  readonly occurredAt?: string;
  readonly contextHash?: string;
  readonly dataClasses?: readonly PlatformDataClass[];
  readonly fenceEpoch?: number;
  readonly fenceWritable?: boolean;
}

export const assertActivePlatformPolicyTransactionContext: (
  value: unknown,
  expected?: PlatformPolicyTransactionExpectation
) => asserts value is PlatformPolicyTransactionContext = (
  value: unknown,
  expected?: PlatformPolicyTransactionExpectation
): asserts value is PlatformPolicyTransactionContext => {
  const active = value && typeof value === 'object' ? activeTransactionContexts.get(value) : undefined;
  if (!value || typeof value !== 'object' || !active) {
    throw new PlatformPolicyEnforcementError(
      'TRANSACTION_CONTEXT_INVALID',
      'Policy-authorized transaction context is forged, expired or outside its execution boundary'
    );
  }
  const now = Date.parse(active.clock());
  if (!Number.isFinite(now) || now > active.expiresAtMs) {
    activeTransactionContexts.delete(value);
    throw new PlatformPolicyEnforcementError('RECEIPT_EXPIRED', 'Policy-authorized transaction context has expired');
  }
  const fence = active.clusterFence();
  if (!fence || typeof fence.writable !== 'boolean' || !Number.isSafeInteger(fence.epoch) || fence.epoch !== active.fenceEpoch || fence.writable !== active.fenceWritable) {
    activeTransactionContexts.delete(value);
    throw new PlatformPolicyEnforcementError('CLUSTER_FENCE_CHANGED', 'Cluster writability fence changed during the policy-authorized transaction');
  }
  const context = value as PlatformPolicyTransactionContext;
  assertObligationExecution(context.obligationExecution, context.receipt);
  const boundContextHash = platformPolicyContextHash(context.receiptRecord.request);
  if (
    context.fenceEpoch !== active.fenceEpoch
    || context.fenceWritable !== active.fenceWritable
    || context.contextHash !== boundContextHash
    || context.decision.contextHash !== boundContextHash
    || context.receipt.decision.contextHash !== boundContextHash
    || context.receiptRecord.decision.contextHash !== boundContextHash
    || context.receiptRecord.receipt.decision.contextHash !== boundContextHash
    || context.correlationId !== context.receiptRecord.request.correlationId
    || context.policyVersion !== context.receiptRecord.request.policyVersion
    || context.policyPackageVersion !== context.receiptRecord.request.policyPackageVersion
    || context.policyPackageVersion !== context.receiptRecord.policyPackageVersion
    || context.policyPackageSha256 !== context.receiptRecord.request.policyPackageSha256
    || context.policyPackageSha256 !== context.receiptRecord.policyPackageSha256
    || context.decisionAuthorityId !== context.receiptRecord.request.decisionAuthorityId
    || context.decisionAuthorityId !== context.receiptRecord.decisionAuthorityId
    || context.decisionAuthorityId !== context.decision.decisionAuthorityId
    || context.decisionAuthorityId !== context.receipt.decision.decisionAuthorityId
    || context.applicationVersion !== context.receiptRecord.request.subject.applicationVersion
    || context.applicationVersion !== context.receiptRecord.applicationVersion
    || context.capabilityManifestSha256 !== context.receiptRecord.request.subject.capabilityManifestSha256
    || context.capabilityManifestSha256 !== context.receiptRecord.capabilityManifestSha256
    || context.deviceCertificateSha256 !== context.receiptRecord.request.subject.deviceCertificate?.certificateSha256
    || context.deviceCertificateSha256 !== context.receiptRecord.deviceCertificateSha256
    || stable(context.subject) !== stable({
      accountId: context.receiptRecord.request.subject.accountId,
      ...(context.receiptRecord.request.subject.personId ? { personId: context.receiptRecord.request.subject.personId } : {}),
      deviceId: context.receiptRecord.request.subject.deviceId,
      applicationId: context.receiptRecord.request.subject.applicationId,
      applicationVersion: context.receiptRecord.request.subject.applicationVersion,
      ...(context.receiptRecord.request.subject.capabilityManifestSha256 ? {
        capabilityManifestSha256: context.receiptRecord.request.subject.capabilityManifestSha256
      } : {}),
      ...(context.receiptRecord.request.subject.deviceCertificate ? {
        deviceCertificateSha256: context.receiptRecord.request.subject.deviceCertificate.certificateSha256
      } : {}),
      roles: context.receiptRecord.request.subject.roles,
      familyIds: context.receiptRecord.request.subject.familyIds,
      householdIds: context.receiptRecord.request.subject.householdIds,
      familyBranchIds: context.receiptRecord.request.subject.familyBranchIds
    })
    || context.resourceType !== context.receiptRecord.request.resource.type
    || context.resourceId !== context.receiptRecord.request.resource.id
    || context.resourceFamilyId !== context.receiptRecord.request.resource.familyId
    || context.resourceHouseholdId !== context.receiptRecord.request.resource.householdId
    || context.resourceFamilyBranchId !== context.receiptRecord.request.resource.familyBranchId
    || context.resourceOwnerPersonId !== context.receiptRecord.request.resource.ownerPersonId
    || stable(context.dataClasses) !== stable(context.receiptRecord.request.resource.dataClasses)
    || stable(context.dataClasses) !== stable(context.receiptRecord.dataClasses)
    || context.purpose !== context.receiptRecord.request.purpose
    || context.occurredAt !== context.receiptRecord.request.occurredAt
    || context.action !== context.receiptRecord.request.action
    || context.capability !== context.receiptRecord.request.capability
  ) {
    activeTransactionContexts.delete(value);
    throw new PlatformPolicyEnforcementError(
      'TRANSACTION_CONTEXT_INVALID',
      'Policy-authorized transaction context fence binding is invalid'
    );
  }
  if (
    expected &&
    (context.resourceType !== expected.resourceType || context.resourceId !== expected.resourceId ||
      context.action !== expected.action || context.capability !== expected.capability ||
      (expected.correlationId !== undefined && context.correlationId !== expected.correlationId) ||
      (expected.resourceFamilyId !== undefined && context.resourceFamilyId !== expected.resourceFamilyId) ||
      (expected.resourceHouseholdId !== undefined && context.resourceHouseholdId !== expected.resourceHouseholdId) ||
      (expected.resourceFamilyBranchId !== undefined && context.resourceFamilyBranchId !== expected.resourceFamilyBranchId) ||
      (expected.resourceOwnerPersonId !== undefined && context.resourceOwnerPersonId !== expected.resourceOwnerPersonId) ||
      (expected.purpose !== undefined && context.purpose !== expected.purpose) ||
      (expected.occurredAt !== undefined && context.occurredAt !== expected.occurredAt) ||
      (expected.contextHash !== undefined && context.contextHash !== expected.contextHash) ||
      (expected.dataClasses !== undefined && stable(context.dataClasses) !== stable(expected.dataClasses)) ||
      (expected.fenceEpoch !== undefined && context.fenceEpoch !== expected.fenceEpoch) ||
      (expected.fenceWritable !== undefined && context.fenceWritable !== expected.fenceWritable))
  ) {
    throw new PlatformPolicyEnforcementError('TRANSACTION_CONTEXT_MISMATCH', 'Policy-authorized transaction context does not match the repository operation');
  }
};

export type PlatformPolicyEnforcementErrorCode =
  | 'INTENT_INVALID'
  | 'AUTHORITY_INVALID'
  | 'AUTHORITY_RESOLUTION_FAILED'
  | 'AUTHORITY_EXPIRED'
  | 'RESOURCE_RESOLUTION_FAILED'
  | 'RESOURCE_MISMATCH'
  | 'RECEIPT_VERIFICATION_FAILED'
  | 'RECEIPT_PERSISTENCE_FAILED'
  | 'RECEIPT_EXPIRED'
  | 'RECEIPT_REPLAYED'
  | 'CLUSTER_FENCE_CHANGED'
  | 'POLICY_DENIED'
  | 'OBLIGATION_EXECUTION_FAILED'
  | 'TRANSACTION_CONTEXT_INVALID'
  | 'TRANSACTION_CONTEXT_MISMATCH'
  | 'POLICY_DECISION_UNAVAILABLE'
  | 'ENFORCEMENT_UNAVAILABLE';

export type PlatformPolicyAvailabilityStage =
  | 'AUTHORITY_RESOLUTION'
  | 'RESOURCE_RESOLUTION'
  | 'REPLAY_RESERVATION'
  | 'POLICY_AUTHORIZATION'
  | 'RECEIPT_VERIFICATION'
  | 'RECEIPT_PERSISTENCE';

export class PlatformPolicyEnforcementError extends Error {
  public readonly code: PlatformPolicyEnforcementErrorCode;
  public readonly decision: PlatformPolicyDecision | undefined;
  public readonly receipt: PlatformPolicyReceipt | undefined;
  public readonly availabilityStage: PlatformPolicyAvailabilityStage | undefined;

  public constructor(
    code: PlatformPolicyEnforcementErrorCode,
    message: string,
    options?: ErrorOptions & {
      readonly decision?: PlatformPolicyDecision;
      readonly receipt?: PlatformPolicyReceipt;
      readonly availabilityStage?: PlatformPolicyAvailabilityStage;
    }
  ) {
    super(message, options);
    this.name = 'PlatformPolicyEnforcementError';
    this.code = code;
    this.decision = options?.decision;
    this.receipt = options?.receipt;
    this.availabilityStage = options?.availabilityStage;
  }
}

interface PlatformPolicyEnforcementPointBaseOptions {
  readonly authorityResolver: PlatformPolicyAuthorityResolver;
  readonly resourceResolver: PlatformPolicyResourceResolver;
  readonly receiptSink: PlatformPolicyReceiptSink;
  readonly replayStore?: PlatformPolicyReplayStore;
  readonly clock?: () => string;
  readonly nonceFactory?: () => string;
  readonly receiptTtlMs?: number;
  /**
   * Maximum wait for each trusted pre-operation policy dependency. A dependency
   * that never settles is treated as an unavailable decision and the protected
   * operation is never entered.
   */
  readonly decisionTimeoutMs?: number;
  /**
   * Production business writes use this mode after recording the exact receipt
   * and fence in their SQLite transaction. Denied decisions are still appended
   * immediately; allowed receipts are projected by the production adapter only
   * after COMMIT and acknowledged from its durable pending-projection row.
   */
  readonly deferAllowedReceiptPersistence?: boolean;
}

export type PlatformPolicyEnforcementPointOptions = PlatformPolicyEnforcementPointBaseOptions & (
  | { readonly kernel: PlatformPolicyKernel; readonly provider?: never }
  | { readonly provider: PlatformPolicyAuthorizationProvider; readonly kernel?: never }
);

const validActions = new Set<PolicyAction>(['read', 'create', 'update', 'delete', 'share', 'process', 'record', 'administer']);
const validCapabilities = new Set<PlatformCapability>([
  'family.read', 'family.write', 'health.read', 'health.write',
  'finance.read', 'finance.write', 'location.read', 'location.share',
  'archive.read', 'archive.write', 'archive.ocr', 'ai.process',
  'translation.process', 'communication.message', 'communication.call',
  'communication.record', 'file.share', 'backup.create', 'backup.restore',
  'cluster.admin', 'plugin.execute'
]);
const validSensitivities = new Set(['public', 'internal', 'personal', 'sensitive', 'highly_sensitive']);
const validApplications = new Set<PlatformApplicationId>([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service',
  'backup-worker', 'signed-plugin'
]);

const nonEmptyBounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
const uniqueStrings = (values: readonly string[]): boolean => new Set(values).size === values.length;
const noValueObligations = new Set<PolicyObligation['type']>([
  'local_processing_only', 'no_cache', 'no_clipboard', 'no_export', 'no_ai',
  'no_recording', 'strong_reauthentication', 'online_only', 'high_detail_audit'
]);
const localProcessingApplications = new Set<PlatformApplicationId>([
  'windows-desktop', 'windows-core-service', 'macos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker'
]);
const parseTimestamp = (value: unknown): number => typeof value === 'string' ? Date.parse(value) : Number.NaN;
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const obligationExecutionPayload = (
  value: Omit<PlatformPolicyObligationExecution, 'attestationHash'>
): Omit<PlatformPolicyObligationExecution, 'attestationHash'> => ({
  schemaVersion: value.schemaVersion,
  executorId: value.executorId,
  requestHash: value.requestHash,
  receiptNonce: value.receiptNonce,
  executedAt: value.executedAt,
  executed: value.executed,
  controls: value.controls
});

const executePolicyObligations = (
  request: PlatformPolicyRequest,
  decision: PlatformPolicyDecision & { readonly allowed: true },
  receipt: PlatformPolicyReceipt,
  executedAt: string
): PlatformPolicyObligationExecution => {
  const seen = new Set<PolicyObligation['type']>();
  const executed: PlatformPolicyExecutedObligation[] = [];
  const maskedFields = new Set<string>();
  let localProcessingOnly = false;
  let allowCache = true;
  let allowClipboard = true;
  let allowExport = true;
  let allowAi = true;
  let allowRecording = true;
  let onlineOnly = false;
  let highDetailAudit = false;
  let watermark: string | undefined;
  let deleteAfter: string | undefined;

  for (const [ordinal, obligation] of decision.obligations.entries()) {
    if (!obligation || typeof obligation !== 'object' || seen.has(obligation.type)) {
      throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'Policy obligation set is invalid or contains duplicates');
    }
    seen.add(obligation.type);
    const value = obligation.value;
    if (noValueObligations.has(obligation.type) && value !== undefined) {
      throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', `${obligation.type} obligation does not accept a value`);
    }
    switch (obligation.type) {
      case 'mask_fields': {
        if (
          !Array.isArray(value)
          || value.length < 1
          || value.length > 10_000
          || value.some((field) => !nonEmptyBounded(field, 256))
          || !uniqueStrings(value)
          || stable(value) !== stable([...value].sort())
          || (value.includes('*') && value.length !== 1)
          || (!value.includes('*') && value.some((field) => !(request.requestedFields ?? []).includes(field)))
        ) {
          throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'mask_fields obligation requires a canonical requested-field set or a single wildcard');
        }
        for (const field of value) maskedFields.add(field);
        break;
      }
      case 'local_processing_only': localProcessingOnly = true; break;
      case 'no_cache': allowCache = false; break;
      case 'no_clipboard': allowClipboard = false; break;
      case 'no_export': allowExport = false; break;
      case 'no_ai': allowAi = false; break;
      case 'no_recording': allowRecording = false; break;
      case 'watermark':
        if (
          !nonEmptyBounded(value, 512)
          || value !== `policy:${request.policyVersion};correlation:${request.correlationId}`
        ) throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'watermark obligation is not bound to the policy version and correlation');
        watermark = value;
        break;
      case 'delete_after':
        if (
          !nonEmptyBounded(value, 512)
          || !/^retention:(?:consent-policy|data-class:(?:personal|special|health|finance|child|location|communication|biometric|legacy))$/u.test(value)
        ) throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'delete_after obligation requires a supported retention directive');
        deleteAfter = value;
        break;
      case 'strong_reauthentication':
        throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'Strong reauthentication evidence is not attached to this transaction');
      case 'online_only':
        if (!request.online) throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'online_only obligation cannot be satisfied while offline');
        onlineOnly = true;
        break;
      case 'high_detail_audit': highDetailAudit = true; break;
      default:
        throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'Unsupported policy obligation');
    }
    executed.push(Object.freeze({
      ordinal,
      type: obligation.type,
      ...(value === undefined
        ? {}
        : { value: Array.isArray(value) ? Object.freeze([...value]) : value }),
      enforcement: 'PEP_RUNTIME_CONTROL' as const
    }));
  }
  const controls: PlatformPolicyObligationControls = Object.freeze({
    localProcessingOnly,
    allowCache,
    allowClipboard,
    allowExport,
    allowAi,
    allowRecording,
    onlineOnly,
    highDetailAudit,
    maskedFields: Object.freeze([...maskedFields].sort()),
    ...(watermark === undefined ? {} : { watermark }),
    ...(deleteAfter === undefined ? {} : { deleteAfter })
  });
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    executorId: 'ppt.platform-policy.strict-obligation-executor.v1' as const,
    requestHash: receipt.requestHash,
    receiptNonce: receipt.nonce,
    executedAt,
    executed: Object.freeze(executed),
    controls
  });
  return Object.freeze({ ...payload, attestationHash: sha256(stable(payload)) });
};

const assertObligationControlCompatibility = (
  request: PlatformPolicyRequest,
  controls: PlatformPolicyObligationControls
): void => {
  if (controls.localProcessingOnly && !localProcessingApplications.has(request.subject.applicationId)) {
    throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'Local-only processing cannot run in the resolved application');
  }
  if (!controls.allowExport && request.capability === 'file.share') {
    throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'No-export policy blocks the requested file-share operation');
  }
  if (!controls.allowAi && request.capability === 'ai.process') {
    throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'No-AI policy blocks the requested AI operation');
  }
  if (!controls.allowRecording && request.capability === 'communication.record') {
    throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'No-record policy blocks the requested recording operation');
  }
};

const assertObligationExecution = (
  execution: PlatformPolicyObligationExecution,
  receipt: PlatformPolicyReceipt
): void => {
  if (
    execution.schemaVersion !== 1
    || execution.executorId !== 'ppt.platform-policy.strict-obligation-executor.v1'
    || execution.requestHash !== receipt.requestHash
    || execution.receiptNonce !== receipt.nonce
    || !Number.isFinite(Date.parse(execution.executedAt))
    || !/^[0-9a-f]{64}$/u.test(execution.attestationHash)
    || execution.attestationHash !== sha256(stable(obligationExecutionPayload(execution)))
    || execution.executed.length !== receipt.decision.obligations.length
    || execution.executed.some((item, index) => item.ordinal !== index || stable(item.value) !== stable(receipt.decision.obligations[index]?.value) || item.type !== receipt.decision.obligations[index]?.type)
  ) throw new PlatformPolicyEnforcementError('OBLIGATION_EXECUTION_FAILED', 'Policy obligation execution attestation is missing or does not match the signed decision');
};
const freezeGrant = (grant: PolicyGrant): PolicyGrant => Object.freeze({
  ...grant,
  actions: Object.freeze([...grant.actions]),
  ...(grant.purposes ? { purposes: Object.freeze([...grant.purposes]) } : {})
});
const freezeConsent = (consent: PolicyConsent): PolicyConsent => Object.freeze({ ...consent });

export class PlatformPolicyEnforcementPoint {
  readonly #kernel: PlatformPolicyKernel | undefined;
  readonly #provider: PlatformPolicyAuthorizationProvider | undefined;
  readonly #authorityResolver: PlatformPolicyAuthorityResolver;
  readonly #resourceResolver: PlatformPolicyResourceResolver;
  readonly #receiptSink: PlatformPolicyReceiptSink;
  readonly #replayStore: PlatformPolicyReplayStore;
  readonly #clock: () => string;
  readonly #nonceFactory: () => string;
  readonly #receiptTtlMs: number;
  readonly #decisionTimeoutMs: number;
  readonly #deferAllowedReceiptPersistence: boolean;

  public constructor(options: PlatformPolicyEnforcementPointOptions) {
    if (!options || typeof options !== 'object') {
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Policy enforcement composition is unavailable');
    }
    if ((options.kernel === undefined) === (options.provider === undefined)) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Exactly one policy kernel or authorization provider must be composed'
      );
    }
    if (
      !options.authorityResolver || typeof options.authorityResolver.resolve !== 'function'
      || !options.resourceResolver || typeof options.resourceResolver.resolve !== 'function'
      || !options.receiptSink || typeof options.receiptSink.append !== 'function'
      || (options.replayStore !== undefined && typeof options.replayStore.reserve !== 'function')
      || (options.provider !== undefined
        && (typeof options.provider.authorize !== 'function' || typeof options.provider.verify !== 'function'))
      || (options.kernel !== undefined
        && (typeof options.kernel.authorizeWithReceipt !== 'function' || typeof options.kernel.verifyReceiptForRequest !== 'function'))
    ) {
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Policy enforcement dependency is unavailable');
    }
    this.#kernel = options.kernel;
    this.#provider = options.provider;
    this.#authorityResolver = options.authorityResolver;
    this.#resourceResolver = options.resourceResolver;
    this.#receiptSink = options.receiptSink;
    this.#replayStore = options.replayStore ?? defaultReplayStore;
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#nonceFactory = options.nonceFactory ?? randomUUID;
    const receiptTtlMs = options.receiptTtlMs ?? 30_000;
    if (!Number.isSafeInteger(receiptTtlMs) || receiptTtlMs < 1_000 || receiptTtlMs > 300_000) {
      throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Policy receipt TTL must be an integer between 1000 and 300000 milliseconds');
    }
    this.#receiptTtlMs = receiptTtlMs;
    const decisionTimeoutMs = options.decisionTimeoutMs ?? 5_000;
    if (!Number.isSafeInteger(decisionTimeoutMs) || decisionTimeoutMs < 10 || decisionTimeoutMs > 60_000) {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Policy decision timeout must be an integer between 10 and 60000 milliseconds'
      );
    }
    this.#decisionTimeoutMs = decisionTimeoutMs;
    this.#deferAllowedReceiptPersistence = options.deferAllowedReceiptPersistence === true;
    if (this.#deferAllowedReceiptPersistence && typeof options.receiptSink.ensure !== 'function') {
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Deferred policy receipt persistence requires an idempotent exact receipt sink'
      );
    }
  }

  public async execute<T>(
    intent: PlatformPolicyIntent,
    clusterFence: PlatformPolicyClusterFence,
    operation: (context: PlatformPolicyTransactionContext) => Promise<T> | T
  ): Promise<T> {
    this.#assertIntent(intent);
    intent = Object.freeze({
      correlationId: intent.correlationId,
      action: intent.action,
      capability: intent.capability,
      resourceType: intent.resourceType,
      resourceId: intent.resourceId,
      purpose: intent.purpose
    });
    if (typeof clusterFence !== 'function' || typeof operation !== 'function') {
      throw new PlatformPolicyEnforcementError('INTENT_INVALID', 'Policy transaction boundary is invalid');
    }
    let authority: PlatformPolicyConnectionAuthority;
    try {
      authority = await this.#withinDecisionDeadline(
        'AUTHORITY_RESOLUTION',
        () => this.#authorityResolver.resolve()
      );
    } catch (error) {
      if (error instanceof PlatformPolicyEnforcementError && error.code === 'POLICY_DECISION_UNAVAILABLE') throw error;
      throw new PlatformPolicyEnforcementError('AUTHORITY_RESOLUTION_FAILED', 'Trusted policy connection authority could not be resolved', { cause: error });
    }
    authority = this.#bindAuthorityPolicyPackage(authority);
    this.#assertAuthority(authority, parseTimestamp(this.#clock()));
    authority = Object.freeze({
      ...authority,
      roles: Object.freeze([...authority.roles]),
      familyIds: Object.freeze([...authority.familyIds]),
      householdIds: Object.freeze([...(authority.householdIds ?? [])]),
      familyBranchIds: Object.freeze([...(authority.familyBranchIds ?? [])]),
      ...(authority.grants ? { grants: Object.freeze(authority.grants.map(freezeGrant)) } : {}),
      ...(authority.consents ? { consents: Object.freeze(authority.consents.map(freezeConsent)) } : {})
    });

    let resource: PolicyResource;
    try {
      resource = await this.#withinDecisionDeadline(
        'RESOURCE_RESOLUTION',
        () => this.#resourceResolver.resolve(intent, authority)
      );
    } catch (error) {
      if (error instanceof PlatformPolicyEnforcementError && error.code === 'POLICY_DECISION_UNAVAILABLE') throw error;
      throw new PlatformPolicyEnforcementError('RESOURCE_RESOLUTION_FAILED', 'Policy resource context could not be resolved', { cause: error });
    }
    if (!resource || typeof resource !== 'object') {
      throw new PlatformPolicyEnforcementError('RESOURCE_RESOLUTION_FAILED', 'Policy resource context is missing');
    }
    if (resource.type !== intent.resourceType || resource.id !== intent.resourceId) {
      throw new PlatformPolicyEnforcementError('RESOURCE_MISMATCH', 'Resolved policy resource does not match the requested intent');
    }
    if (
      !nonEmptyBounded(resource.familyId, 256) || !validSensitivities.has(resource.sensitivity)
      || (resource.householdId !== undefined && !nonEmptyBounded(resource.householdId, 256))
      || (resource.familyBranchId !== undefined && !nonEmptyBounded(resource.familyBranchId, 256))
      || (resource.ownerPersonId !== undefined && !nonEmptyBounded(resource.ownerPersonId, 256))
      || (resource.sourceResourceId !== undefined && !nonEmptyBounded(resource.sourceResourceId, 256))
      || (resource.dataClasses !== undefined && !Array.isArray(resource.dataClasses))
      || (resource.classificationSource !== undefined && resource.classificationSource !== 'declared' && resource.classificationSource !== 'policy_default')
      || (resource.dataClasses === undefined && resource.classificationSource !== undefined)
    ) {
      throw new PlatformPolicyEnforcementError('RESOURCE_RESOLUTION_FAILED', 'Resolved policy resource context is invalid');
    }
    let dataClasses: readonly PlatformDataClass[];
    let classificationSource: 'declared' | 'policy_default';
    try {
      if (resource.dataClasses !== undefined) {
        if (resource.classificationSource === 'policy_default') throw new TypeError('Declared data classes cannot claim policy-default authority');
        dataClasses = normalizePlatformDataClasses(resource.dataClasses);
        classificationSource = 'declared';
      } else {
        dataClasses = inferPlatformDataClasses(intent.capability, resource.type);
        classificationSource = 'policy_default';
      }
    } catch (error) {
      throw new PlatformPolicyEnforcementError('RESOURCE_RESOLUTION_FAILED', 'Resolved policy data classification is invalid', { cause: error });
    }
    resource = Object.freeze({
      ...resource,
      dataClasses,
      classificationSource
    });

    const issuedAt = this.#clock();
    const issuedAtMs = parseTimestamp(issuedAt);
    this.#assertAuthority(authority, issuedAtMs);
    const authorityExpiresAtMs = parseTimestamp(authority.expiresAt);
    const requestedFence = this.#readFence(clusterFence);

    const subject: PlatformPolicyTransactionSubjectSnapshot = Object.freeze({
      accountId: authority.accountId,
      ...(authority.personId ? { personId: authority.personId } : {}),
      deviceId: authority.deviceId,
      applicationId: authority.applicationId,
      applicationVersion: authority.applicationVersion!,
      ...(authority.capabilityManifestSha256 ? { capabilityManifestSha256: authority.capabilityManifestSha256 } : {}),
      ...(authority.deviceCertificate ? { deviceCertificateSha256: authority.deviceCertificate.certificateSha256 } : {}),
      roles: Object.freeze([...authority.roles]),
      familyIds: Object.freeze([...authority.familyIds]),
      householdIds: Object.freeze([...(authority.householdIds ?? [])]),
      familyBranchIds: Object.freeze([...(authority.familyBranchIds ?? [])])
    });
    const request: PlatformPolicyRequest = Object.freeze({
      correlationId: intent.correlationId,
      policyVersion: authority.policyVersion,
      policyPackageVersion: authority.policyPackageVersion!,
      policyPackageSha256: authority.policyPackageSha256!,
      ...(authority.decisionAuthorityId ? { decisionAuthorityId: authority.decisionAuthorityId } : {}),
      subject: Object.freeze({
        ...subject,
        ...(authority.deviceCertificate ? { deviceCertificate: authority.deviceCertificate } : {}),
        deviceTrusted: authority.deviceTrusted,
        membershipActive: authority.membershipActive
      }),
      resource: Object.freeze({ ...resource }),
      action: intent.action,
      capability: intent.capability,
      purpose: intent.purpose,
      occurredAt: issuedAt,
      online: authority.online,
      clusterWritable: requestedFence.writable,
      enforcementMode: 'strict',
      ...(authority.grants ? { grants: authority.grants } : {}),
      ...(authority.consents ? { consents: authority.consents } : {})
    });

    const nonce = this.#nonceFactory();
    if (!nonEmptyBounded(nonce, 256)) {
      throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Policy receipt nonce is invalid');
    }
    // Reserve before crossing the provider boundary. A provider receipt may be
    // issued later than the request, so retain the nonce for the longest
    // receipt lifetime this PEP can accept (one TTL to issue plus one TTL to
    // execute), bounded by the connection authority.
    const reservationExpiresAtMs = Math.min(issuedAtMs + (this.#receiptTtlMs * 2), authorityExpiresAtMs);
    let reserved: boolean;
    try {
      reserved = await this.#withinDecisionDeadline(
        'REPLAY_RESERVATION',
        () => this.#replayStore.reserve({ nonce, reservedAtMs: issuedAtMs, expiresAtMs: reservationExpiresAtMs })
      );
    } catch (error) {
      if (error instanceof PlatformPolicyEnforcementError) throw error;
      throw new PlatformPolicyEnforcementError(
        'ENFORCEMENT_UNAVAILABLE',
        'Policy replay reservation store is unavailable',
        { cause: error }
      );
    }
    if (!reserved) throw new PlatformPolicyEnforcementError('RECEIPT_REPLAYED', 'Policy receipt nonce was already issued');
    const provided = await this.#withinDecisionDeadline(
      'POLICY_AUTHORIZATION',
      () => this.#authorize(request, issuedAt, nonce)
    );
    const effectiveRequest = this.#assertEffectiveRequest(request, provided.effectiveRequest);
    const authorization = provided.authorization;
    const contextHash = platformPolicyContextHash(effectiveRequest);
    if (
      authorization.receipt.nonce !== nonce ||
      stable(authorization.decision) !== stable(authorization.receipt.decision) ||
      authorization.decision.policyVersion !== effectiveRequest.policyVersion ||
      authorization.decision.policyPackageVersion !== effectiveRequest.policyPackageVersion ||
      authorization.decision.policyPackageSha256 !== effectiveRequest.policyPackageSha256 ||
      authorization.decision.decisionAuthorityId !== effectiveRequest.decisionAuthorityId ||
      authorization.decision.applicationVersion !== effectiveRequest.subject.applicationVersion ||
      (effectiveRequest.subject.capabilityManifestSha256 !== undefined
        && authorization.decision.capabilityManifestSha256 !== effectiveRequest.subject.capabilityManifestSha256) ||
      (effectiveRequest.subject.deviceCertificate !== undefined
        && authorization.decision.deviceCertificateSha256 !== effectiveRequest.subject.deviceCertificate.certificateSha256) ||
      authorization.decision.contextHash !== contextHash ||
      authorization.receipt.decision.contextHash !== contextHash
    ) {
      throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Policy authorization is not bound to the reserved nonce and decision');
    }
    const receiptIssuedAtMs = parseTimestamp(authorization.receipt.issuedAt);
    const providerReturnedAtMs = parseTimestamp(this.#clock());
    if (
      !Number.isFinite(receiptIssuedAtMs) || !Number.isFinite(providerReturnedAtMs) ||
      receiptIssuedAtMs < issuedAtMs || receiptIssuedAtMs > providerReturnedAtMs ||
      receiptIssuedAtMs - issuedAtMs > this.#receiptTtlMs ||
      (this.#kernel !== undefined && receiptIssuedAtMs !== issuedAtMs)
    ) {
      throw new PlatformPolicyEnforcementError(
        'RECEIPT_VERIFICATION_FAILED',
        'Policy receipt issue time is invalid, stale or in the future'
      );
    }
    const effectiveExpiresAtMs = Math.min(receiptIssuedAtMs + this.#receiptTtlMs, authorityExpiresAtMs);
    if (providerReturnedAtMs > effectiveExpiresAtMs) {
      throw new PlatformPolicyEnforcementError('RECEIPT_EXPIRED', 'Policy receipt expired before verification', {
        decision: authorization.decision,
        receipt: authorization.receipt
      });
    }
    const fence = this.#readFence(clusterFence);
    if (
      fence.epoch !== requestedFence.epoch || fence.writable !== requestedFence.writable ||
      effectiveRequest.clusterWritable !== fence.writable
    ) {
      throw new PlatformPolicyEnforcementError(
        'CLUSTER_FENCE_CHANGED',
        'Cluster writability fence changed while policy authorization was being issued'
      );
    }
    if (!(await this.#verifyWithinDecisionDeadline(effectiveRequest, authorization.receipt))) {
      throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Policy receipt is not bound to the resolved request');
    }
    if (authorization.decision.allowed && !effectiveRequest.clusterWritable) {
      throw new PlatformPolicyEnforcementError(
        'RECEIPT_VERIFICATION_FAILED',
        'Policy provider allowed a transaction after narrowing the cluster fence to read-only'
      );
    }

    const allowedDecision = authorization.decision.allowed
      ? authorization.decision as PlatformPolicyDecision & { readonly allowed: true; readonly contextHash: string }
      : undefined;
    const obligationExecution = allowedDecision
      ? executePolicyObligations(effectiveRequest, allowedDecision, authorization.receipt, this.#clock())
      : undefined;
    if (obligationExecution) assertObligationControlCompatibility(effectiveRequest, obligationExecution.controls);
    const record: PlatformPolicyReceiptRecord = Object.freeze({
      correlationId: intent.correlationId,
      contextHash,
      policyPackageVersion: effectiveRequest.policyPackageVersion!,
      policyPackageSha256: effectiveRequest.policyPackageSha256!,
      ...(effectiveRequest.decisionAuthorityId ? { decisionAuthorityId: effectiveRequest.decisionAuthorityId } : {}),
      applicationVersion: effectiveRequest.subject.applicationVersion!,
      ...(effectiveRequest.subject.capabilityManifestSha256 ? {
        capabilityManifestSha256: effectiveRequest.subject.capabilityManifestSha256
      } : {}),
      ...(effectiveRequest.subject.deviceCertificate ? {
        deviceCertificateSha256: effectiveRequest.subject.deviceCertificate.certificateSha256
      } : {}),
      dataClasses: Object.freeze([...(effectiveRequest.resource.dataClasses ?? [])]),
      resourceType: resource.type,
      resourceId: resource.id,
      action: intent.action,
      capability: intent.capability,
      request: effectiveRequest,
      decision: authorization.decision,
      receipt: authorization.receipt,
      recordedAt: authorization.receipt.issuedAt,
      ...(obligationExecution ? { obligationExecution } : {})
    });
    if (!authorization.decision.allowed) {
      await this.#appendReceipt(
        record,
        authorization,
        'Denied policy receipt could not be persisted before returning the decision'
      );
      if (!(await this.#verifyWithinDecisionDeadline(effectiveRequest, authorization.receipt))) {
        throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Persisted policy receipt changed or no longer matches the resolved request');
      }
      throw new PlatformPolicyEnforcementError('POLICY_DENIED', `Policy denied the transaction: ${authorization.decision.reason}`, {
        decision: authorization.decision,
        receipt: authorization.receipt
      });
    }
    if (!this.#deferAllowedReceiptPersistence) {
      await this.#appendReceipt(
        record,
        authorization,
        'Policy receipt could not be persisted before transaction execution'
      );
      if (!(await this.#verifyWithinDecisionDeadline(effectiveRequest, authorization.receipt))) {
        throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Persisted policy receipt changed or no longer matches the resolved request');
      }
    }
    const executionStartedAtMs = parseTimestamp(this.#clock());
    if (!Number.isFinite(executionStartedAtMs) || executionStartedAtMs < receiptIssuedAtMs || executionStartedAtMs > effectiveExpiresAtMs) {
      throw new PlatformPolicyEnforcementError('RECEIPT_EXPIRED', 'Policy receipt expired before transaction execution', {
        decision: authorization.decision,
        receipt: authorization.receipt
      });
    }
    const executionFence = this.#readFence(clusterFence);
    if (executionFence.epoch !== fence.epoch || executionFence.writable !== fence.writable) {
      throw new PlatformPolicyEnforcementError('CLUSTER_FENCE_CHANGED', 'Cluster writability fence changed before transaction execution', {
        decision: authorization.decision,
        receipt: authorization.receipt
      });
    }

    const decision = allowedDecision!;
    assertObligationExecution(obligationExecution!, authorization.receipt);
    const context: PlatformPolicyTransactionContext = Object.freeze({
      [transactionContextBrand]: true as const,
      correlationId: intent.correlationId,
      requestHash: authorization.receipt.requestHash,
      contextHash,
      policyVersion: decision.policyVersion,
      policyPackageVersion: decision.policyPackageVersion!,
      policyPackageSha256: decision.policyPackageSha256!,
      ...(decision.decisionAuthorityId ? { decisionAuthorityId: decision.decisionAuthorityId } : {}),
      applicationVersion: decision.applicationVersion!,
      ...(effectiveRequest.subject.capabilityManifestSha256 ? {
        capabilityManifestSha256: effectiveRequest.subject.capabilityManifestSha256
      } : {}),
      ...(effectiveRequest.subject.deviceCertificate ? {
        deviceCertificateSha256: effectiveRequest.subject.deviceCertificate.certificateSha256
      } : {}),
      subject,
      resourceType: resource.type,
      resourceId: resource.id,
      resourceFamilyId: resource.familyId,
      ...(resource.householdId ? { resourceHouseholdId: resource.householdId } : {}),
      ...(resource.familyBranchId ? { resourceFamilyBranchId: resource.familyBranchId } : {}),
      ...(resource.ownerPersonId ? { resourceOwnerPersonId: resource.ownerPersonId } : {}),
      dataClasses: Object.freeze([...(effectiveRequest.resource.dataClasses ?? [])]),
      purpose: intent.purpose,
      occurredAt: effectiveRequest.occurredAt,
      action: intent.action,
      capability: intent.capability,
      fenceEpoch: fence.epoch,
      fenceWritable: fence.writable,
      decision,
      receipt: authorization.receipt,
      receiptRecord: record,
      obligationExecution: obligationExecution!
    });
    activeTransactionContexts.set(context, {
      expiresAtMs: effectiveExpiresAtMs,
      clock: this.#clock,
      clusterFence,
      fenceEpoch: fence.epoch,
      fenceWritable: fence.writable
    });
    try {
      const result = await operation(context);
      if (!this.#deferAllowedReceiptPersistence) {
        assertActivePlatformPolicyTransactionContext(context, {
          resourceType: context.resourceType,
          resourceId: context.resourceId,
          action: context.action,
          capability: context.capability,
          correlationId: context.correlationId,
          resourceFamilyId: context.resourceFamilyId,
          fenceEpoch: context.fenceEpoch,
          fenceWritable: context.fenceWritable
        });
      } else if (activeTransactionContexts.get(context) === undefined) {
        throw new PlatformPolicyEnforcementError(
          'TRANSACTION_CONTEXT_INVALID',
          'Deferred policy transaction context left its trusted execution boundary'
        );
      }
      return result;
    } finally {
      activeTransactionContexts.delete(context);
    }
  }

  async #appendReceipt(
    record: PlatformPolicyReceiptRecord,
    authorization: PlatformPolicyAuthorization,
    message: string
  ): Promise<void> {
    try {
      await this.#withinDecisionDeadline(
        'RECEIPT_PERSISTENCE',
        () => this.#receiptSink.append(record)
      );
    } catch (error) {
      if (error instanceof PlatformPolicyEnforcementError && error.code === 'POLICY_DECISION_UNAVAILABLE') throw error;
      throw new PlatformPolicyEnforcementError('RECEIPT_PERSISTENCE_FAILED', message, {
        cause: error,
        decision: authorization.decision,
        receipt: authorization.receipt
      });
    }
  }

  async #authorize(
    request: PlatformPolicyRequest,
    issuedAt: string,
    nonce: string
  ): Promise<PlatformPolicyProviderAuthorizationResult> {
    if (this.#kernel) {
      return Object.freeze({
        effectiveRequest: request,
        authorization: this.#kernel.authorizeWithReceipt(request, issuedAt, nonce)
      });
    }
    try {
      const result = await this.#provider!.authorize(Object.freeze({ request, nonce }));
      if (!result || typeof result !== 'object' || !result.effectiveRequest || !result.authorization) {
        throw new Error('Policy provider returned an invalid authorization envelope');
      }
      return result;
    } catch (error) {
      if (error instanceof PlatformPolicyEnforcementError) throw error;
      throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE', 'Policy authorization provider is unavailable', { cause: error });
    }
  }

  async #verify(request: PlatformPolicyRequest, receipt: PlatformPolicyReceipt): Promise<boolean> {
    if (this.#kernel) return this.#kernel.verifyReceiptForRequest(receipt, request);
    try {
      return (await this.#provider!.verify(Object.freeze({ request, receipt }))) === true;
    } catch (error) {
      throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Policy receipt provider verification failed', { cause: error });
    }
  }

  #verifyWithinDecisionDeadline(
    request: PlatformPolicyRequest,
    receipt: PlatformPolicyReceipt
  ): Promise<boolean> {
    return this.#withinDecisionDeadline(
      'RECEIPT_VERIFICATION',
      () => this.#verify(request, receipt)
    );
  }

  async #withinDecisionDeadline<T>(
    stage: PlatformPolicyAvailabilityStage,
    operation: () => Promise<T> | T
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unavailable = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new PlatformPolicyEnforcementError(
        'POLICY_DECISION_UNAVAILABLE',
        `Policy decision dependency did not settle within ${this.#decisionTimeoutMs} milliseconds`,
        { availabilityStage: stage }
      )), this.#decisionTimeoutMs);
    });
    try {
      return await Promise.race([Promise.resolve().then(operation), unavailable]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  #assertEffectiveRequest(request: PlatformPolicyRequest, effectiveRequest: PlatformPolicyRequest): PlatformPolicyRequest {
    if (!effectiveRequest || typeof effectiveRequest !== 'object') {
      throw new PlatformPolicyEnforcementError('RECEIPT_VERIFICATION_FAILED', 'Policy provider effective request is missing');
    }
    const { clusterWritable: requestedWritable, ...requestedRest } = request;
    const { clusterWritable: effectiveWritable, ...effectiveRest } = effectiveRequest;
    if (
      typeof effectiveWritable !== 'boolean' ||
      stable(requestedRest) !== stable(effectiveRest) ||
      (!requestedWritable && effectiveWritable)
    ) {
      throw new PlatformPolicyEnforcementError(
        'RECEIPT_VERIFICATION_FAILED',
        'Policy provider changed the resolved request outside the allowed clusterWritable narrowing'
      );
    }
    return Object.freeze({ ...request, clusterWritable: effectiveWritable });
  }

  #assertIntent(intent: PlatformPolicyIntent): void {
    const allowedKeys = new Set(['correlationId', 'action', 'capability', 'resourceType', 'resourceId', 'purpose']);
    if (!intent || typeof intent !== 'object' || Object.keys(intent).some((key) => !allowedKeys.has(key))) {
      throw new PlatformPolicyEnforcementError('INTENT_INVALID', 'Policy intent contains an unsupported field');
    }
    if (!nonEmptyBounded(intent.correlationId, 128) || !/^[A-Za-z0-9._:-]+$/u.test(intent.correlationId)) {
      throw new PlatformPolicyEnforcementError('INTENT_INVALID', 'Policy intent correlationId is invalid');
    }
    if (!validActions.has(intent.action) || !validCapabilities.has(intent.capability)) {
      throw new PlatformPolicyEnforcementError('INTENT_INVALID', 'Policy intent action or capability is invalid');
    }
    if (!nonEmptyBounded(intent.resourceType, 128) || !nonEmptyBounded(intent.resourceId, 256)) {
      throw new PlatformPolicyEnforcementError('INTENT_INVALID', 'Policy intent resource identity is invalid');
    }
    if (!nonEmptyBounded(intent.purpose, 256)) {
      throw new PlatformPolicyEnforcementError('INTENT_INVALID', 'Policy intent purpose is required and invalid');
    }
  }

  #assertAuthority(authority: PlatformPolicyConnectionAuthority, now: number): void {
    if (
      !authority || typeof authority !== 'object' || !Number.isFinite(now) ||
      !nonEmptyBounded(authority.policyVersion, 128) || !nonEmptyBounded(authority.accountId, 256) || !nonEmptyBounded(authority.deviceId, 256) ||
      !Number.isSafeInteger(authority.policyPackageVersion) || authority.policyPackageVersion! < 1 ||
      !/^[0-9a-f]{64}$/u.test(authority.policyPackageSha256 ?? '') ||
      (authority.personId !== undefined && !nonEmptyBounded(authority.personId, 256)) ||
      (authority.decisionAuthorityId !== undefined
        && authority.decisionAuthorityId !== 'local-policy-kernel'
        && authority.decisionAuthorityId !== 'windows-core-service') ||
      !validApplications.has(authority.applicationId) || typeof authority.deviceTrusted !== 'boolean' ||
      !nonEmptyBounded(authority.applicationVersion, 128) ||
      (authority.capabilityManifestSha256 !== undefined && !/^[0-9a-f]{64}$/u.test(authority.capabilityManifestSha256)) ||
      typeof authority.membershipActive !== 'boolean' || typeof authority.online !== 'boolean' ||
      !Array.isArray(authority.roles) || authority.roles.length === 0 || authority.roles.some((role) => !nonEmptyBounded(role, 128)) || authority.roles.length > 64 || !uniqueStrings(authority.roles) ||
      !Array.isArray(authority.familyIds) || authority.familyIds.length === 0 || authority.familyIds.length > 10_000 || authority.familyIds.some((id) => !nonEmptyBounded(id, 256)) ||
      !uniqueStrings(authority.familyIds) ||
      (authority.householdIds !== undefined && (!Array.isArray(authority.householdIds) || authority.householdIds.length > 10_000 || authority.householdIds.some((id) => !nonEmptyBounded(id, 256)) || !uniqueStrings(authority.householdIds))) ||
      (authority.familyBranchIds !== undefined && (!Array.isArray(authority.familyBranchIds) || authority.familyBranchIds.length > 10_000 || authority.familyBranchIds.some((id) => !nonEmptyBounded(id, 256)) || !uniqueStrings(authority.familyBranchIds))) ||
      (authority.grants !== undefined && (!Array.isArray(authority.grants) || authority.grants.length > 10_000)) ||
      (authority.consents !== undefined && (!Array.isArray(authority.consents) || authority.consents.length > 10_000))
    ) {
      throw new PlatformPolicyEnforcementError('AUTHORITY_INVALID', 'Policy connection authority is invalid');
    }
    const expiresAt = parseTimestamp(authority.expiresAt);
    if (!Number.isFinite(expiresAt)) throw new PlatformPolicyEnforcementError('AUTHORITY_INVALID', 'Policy connection authority expiry is invalid');
    if (expiresAt <= now) throw new PlatformPolicyEnforcementError('AUTHORITY_EXPIRED', 'Policy connection authority has expired');
  }

  #bindAuthorityPolicyPackage(authority: PlatformPolicyConnectionAuthority): PlatformPolicyConnectionAuthority {
    if (!authority || typeof authority !== 'object') return authority;
    let policyPackage: PlatformPolicyPackage | undefined;
    try {
      policyPackage = this.#kernel?.policyPackage ?? this.#provider?.resolvePolicyPackage?.(authority.applicationId);
    } catch (error) {
      throw new PlatformPolicyEnforcementError('AUTHORITY_INVALID', 'Signed policy package could not be resolved', { cause: error });
    }
    if (!policyPackage) return authority;
    const applicationVersion = policyPackage.payload.applicationVersions[authority.applicationId];
    const applicationManifest = policyPackage.payload.applicationManifests[authority.applicationId];
    const decisionAuthorityId = policyPackage.payload.decisionAuthorityId;
    if (
      policyPackage.payload.schemaVersion !== 1
      || policyPackage.payload.policyVersion !== authority.policyVersion
      || policyPackage.payloadSha256 !== sha256(stable(policyPackage.payload))
      || policyPackage.signatureAlgorithm !== 'HMAC-SHA256'
      || !/^[0-9a-f]{64}$/u.test(policyPackage.signature)
      || applicationVersion === undefined
      || applicationManifest === undefined
      || applicationManifest.applicationId !== authority.applicationId
      || applicationManifest.applicationVersion !== applicationVersion
      || (authority.policyPackageVersion !== undefined && authority.policyPackageVersion !== policyPackage.payload.packageVersion)
      || (authority.policyPackageSha256 !== undefined && authority.policyPackageSha256 !== policyPackage.payloadSha256)
      || (authority.applicationVersion !== undefined && authority.applicationVersion !== applicationVersion)
      || (authority.decisionAuthorityId !== undefined && authority.decisionAuthorityId !== decisionAuthorityId)
    ) {
      throw new PlatformPolicyEnforcementError('AUTHORITY_INVALID', 'Policy authority does not match the signed policy package');
    }
    let deviceCertificate = authority.deviceCertificate;
    if (applicationManifest.deviceCertificateRequired && !deviceCertificate) {
      if (
        !/^[0-9a-f]{64}$/u.test(authority.devicePublicKeyFingerprintSha256 ?? '')
        || !Number.isFinite(parseTimestamp(authority.deviceCertificateIssuedAt ?? ''))
      ) throw new PlatformPolicyEnforcementError(
        'AUTHORITY_INVALID',
        'Trusted-device certificate source is missing for the registered application'
      );
      deviceCertificate = createPlatformDeviceCertificate({
        schemaVersion: 1,
        issuer: 'trusted-device-registry',
        deviceId: authority.deviceId,
        applicationId: authority.applicationId,
        publicKeyFingerprintSha256: authority.devicePublicKeyFingerprintSha256!,
        capabilityManifestSha256: applicationManifest.capabilityManifestSha256,
        issuedAt: authority.deviceCertificateIssuedAt!,
        expiresAt: authority.expiresAt
      });
    }
    if (deviceCertificate && !verifyPlatformDeviceCertificate(deviceCertificate, {
      deviceId: authority.deviceId,
      applicationId: authority.applicationId,
      capabilityManifestSha256: applicationManifest.capabilityManifestSha256,
      occurredAt: this.#clock()
    })) throw new PlatformPolicyEnforcementError('AUTHORITY_INVALID', 'Device certificate is invalid or not bound to the application manifest');
    return Object.freeze({
      ...authority,
      policyPackageVersion: policyPackage.payload.packageVersion,
      policyPackageSha256: policyPackage.payloadSha256,
      ...(decisionAuthorityId ? { decisionAuthorityId } : {}),
      applicationVersion,
      capabilityManifestSha256: applicationManifest.capabilityManifestSha256,
      ...(deviceCertificate ? { deviceCertificate } : {})
    });
  }

  #readFence(clusterFence: PlatformPolicyClusterFence): PlatformPolicyClusterFenceSnapshot {
    let fence: PlatformPolicyClusterFenceSnapshot;
    try {
      fence = clusterFence();
    } catch (error) {
      throw new PlatformPolicyEnforcementError('CLUSTER_FENCE_CHANGED', 'Cluster writability fence is unavailable', { cause: error });
    }
    if (!fence || typeof fence.writable !== 'boolean' || !Number.isSafeInteger(fence.epoch) || fence.epoch < 0) {
      throw new PlatformPolicyEnforcementError('CLUSTER_FENCE_CHANGED', 'Cluster writability fence is invalid');
    }
    return Object.freeze({ writable: fence.writable, epoch: fence.epoch });
  }
}
