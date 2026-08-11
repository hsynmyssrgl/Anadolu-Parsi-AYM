import { createHash, createHmac } from 'node:crypto';
import {
  platformPolicyContextHash,
  type PlatformDataClass,
  type PolicyObligation,
  type PolicyObligationType,
  type PolicyReason
} from './policy-kernel.js';
import type { PlatformPolicyObligationExecution, PlatformPolicyReceiptRecord } from './policy-enforcement-point.js';

export const IMMUTABLE_POLICY_DECISION_AUDIT_SCHEMA_VERSION = 1 as const;

export const IMMUTABLE_POLICY_DECISION_AUDIT_REQUIRED_FIELDS = Object.freeze([
  'decision',
  'decisionReason',
  'policyVersion',
  'policyPackageVersion',
  'policyPackageSha256',
  'obligations',
  'correlationId',
  'contextHash',
  'requestHash',
  'receiptHash',
  'recordHash',
  'receiptNonce',
  'decisionAuthorityId',
  'applicationId',
  'applicationVersion',
  'capabilityManifestSha256',
  'deviceCertificateSha256',
  'resourceType',
  'resourceId',
  'dataClasses',
  'action',
  'capability',
  'recordedAt',
  'auditHash'
] as const);

const POLICY_REASONS = Object.freeze([
  'ALLOW_POLICY', 'EXPLICIT_DENY', 'POLICY_VERSION_MISMATCH', 'APPLICATION_NOT_REGISTERED',
  'CAPABILITY_NOT_DECLARED', 'ACTION_CAPABILITY_MISMATCH', 'DEVICE_NOT_TRUSTED',
  'MEMBERSHIP_INACTIVE', 'PURPOSE_REQUIRED', 'CONSENT_REQUIRED', 'CONSENT_EXPIRED',
  'OFFLINE_OPERATION_FORBIDDEN', 'CLUSTER_NOT_WRITABLE', 'RESOURCE_SCOPE_DENIED',
  'OWNER_OR_GRANT_REQUIRED', 'OWNERSHIP_SHARE_REQUIRED', 'DATA_CLASS_CAPABILITY_MISMATCH',
  'POLICY_PACKAGE_VERSION_MISMATCH', 'POLICY_PACKAGE_HASH_MISMATCH',
  'APPLICATION_VERSION_MISMATCH', 'APPLICATION_MANIFEST_MISMATCH',
  'DEVICE_CERTIFICATE_INVALID', 'DECISION_AUTHORITY_MISMATCH', 'INVALID_REQUEST'
] as const satisfies readonly PolicyReason[]);

const OBLIGATION_TYPES = Object.freeze([
  'mask_fields', 'local_processing_only', 'no_cache', 'no_clipboard', 'no_export', 'no_ai',
  'no_recording', 'watermark', 'delete_after', 'strong_reauthentication', 'online_only',
  'high_detail_audit'
] as const satisfies readonly PolicyObligationType[]);

const policyReasons = new Set<string>(POLICY_REASONS);
const obligationTypes = new Set<string>(OBLIGATION_TYPES);
const SHA256 = /^[0-9a-f]{64}$/u;
const TOKEN = /^[A-Za-z0-9._:-]+$/u;

export type ImmutablePolicyDecisionAuditFailureCode =
  | 'AUDIT_RECORD_INVALID'
  | 'AUDIT_RECORD_BINDING_MISMATCH'
  | 'AUDIT_DECISION_INVALID'
  | 'AUDIT_OBLIGATIONS_INVALID'
  | 'AUDIT_OBLIGATION_EXECUTION_INVALID'
  | 'AUDIT_HASH_MISMATCH';

export class ImmutablePolicyDecisionAuditError extends Error {
  public readonly code: ImmutablePolicyDecisionAuditFailureCode;

  public constructor(code: ImmutablePolicyDecisionAuditFailureCode, message: string) {
    super(message);
    this.name = 'ImmutablePolicyDecisionAuditError';
    this.code = code;
  }
}

export interface ImmutablePolicyDecisionAuditRecord {
  readonly schemaVersion: 1;
  readonly correlationId: string;
  readonly contextHash: string;
  readonly requestHash: string;
  readonly receiptHash: string;
  readonly recordHash: string;
  readonly receiptNonce: string;
  readonly policyVersion: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly decisionAuthorityId: string;
  readonly applicationId: string;
  readonly applicationVersion: string;
  readonly capabilityManifestSha256: string | null;
  readonly deviceCertificateSha256: string | null;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly dataClasses: readonly PlatformDataClass[];
  readonly action: string;
  readonly capability: string;
  readonly decision: 'allowed' | 'denied';
  readonly decisionReason: PolicyReason;
  readonly obligations: readonly PolicyObligation[];
  readonly recordedAt: string;
  readonly auditHash: string;
}

export interface ImmutablePolicyDecisionAuditPolicySnapshot {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly journalEntrySchemaVersion: 2;
  readonly protectedAuditEnvelopeSchemaVersion: 1;
  readonly requiredFields: typeof IMMUTABLE_POLICY_DECISION_AUDIT_REQUIRED_FIELDS;
  readonly allowedDecisionsRecorded: true;
  readonly deniedDecisionsRecorded: true;
  readonly denialReasonRequired: true;
  readonly obligationsRecordedExactly: true;
  readonly appendOnly: true;
  readonly encryptedAtRest: true;
  readonly hmacSha256Chained: true;
  readonly externalMonotonicCheckpointRequired: true;
  readonly payloadExposedToClient: false;
  readonly historicalBackfillRequired: false;
}

type UnsignedAuditRecord = Omit<ImmutablePolicyDecisionAuditRecord, 'auditHash'>;

export const canonicalPolicyDecisionAuditJson = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ImmutablePolicyDecisionAuditError('AUDIT_RECORD_INVALID', 'Audit number must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalPolicyDecisionAuditJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.some((key) => record[key] === undefined)) {
      throw new ImmutablePolicyDecisionAuditError('AUDIT_RECORD_INVALID', 'Audit record cannot contain undefined values');
    }
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalPolicyDecisionAuditJson(record[key])}`).join(',')}}`;
  }
  throw new ImmutablePolicyDecisionAuditError('AUDIT_RECORD_INVALID', 'Audit record contains an unsupported value');
};

const sha256 = (value: unknown): string =>
  createHash('sha256').update(canonicalPolicyDecisionAuditJson(value), 'utf8').digest('hex');
const requestHash = (value: unknown): string =>
  createHmac('sha256', 'ppt-policy-request-v1').update(canonicalPolicyDecisionAuditJson(value), 'utf8').digest('hex');
const nonEmpty = (value: unknown, maximum = 256): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const same = (left: unknown, right: unknown): boolean => {
  if (left === undefined || right === undefined) return left === right;
  return canonicalPolicyDecisionAuditJson(left) === canonicalPolicyDecisionAuditJson(right);
};

const freezeObligation = (value: PolicyObligation): PolicyObligation => Object.freeze({
  type: value.type,
  ...(value.value === undefined ? {} : {
    value: Array.isArray(value.value) ? Object.freeze([...value.value]) : value.value
  })
});

const assertObligations: (value: unknown) => asserts value is readonly PolicyObligation[] = (
  value: unknown
): asserts value is readonly PolicyObligation[] => {
  if (!Array.isArray(value) || value.length > OBLIGATION_TYPES.length) {
    throw new ImmutablePolicyDecisionAuditError('AUDIT_OBLIGATIONS_INVALID', 'Decision obligations are invalid');
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ImmutablePolicyDecisionAuditError('AUDIT_OBLIGATIONS_INVALID', 'Decision obligation is invalid');
    }
    const obligation = item as Partial<PolicyObligation> & Record<string, unknown>;
    const keys = Object.keys(obligation);
    if (keys.some((key) => key !== 'type' && key !== 'value') || !obligationTypes.has(String(obligation.type)) || seen.has(String(obligation.type))) {
      throw new ImmutablePolicyDecisionAuditError('AUDIT_OBLIGATIONS_INVALID', 'Decision obligation type is invalid or duplicated');
    }
    seen.add(String(obligation.type));
    if (obligation.value !== undefined) {
      const validValue = typeof obligation.value === 'string'
        ? obligation.value.length > 0 && obligation.value.length <= 2048
        : Array.isArray(obligation.value)
          && obligation.value.length <= 256
          && obligation.value.every((entry) => nonEmpty(entry, 256))
          && new Set(obligation.value).size === obligation.value.length;
      if (!validValue) {
        throw new ImmutablePolicyDecisionAuditError('AUDIT_OBLIGATIONS_INVALID', 'Decision obligation value is invalid');
      }
    }
  }
};

const obligationExecutionPayload = (
  value: PlatformPolicyObligationExecution
): Omit<PlatformPolicyObligationExecution, 'attestationHash'> => ({
  schemaVersion: value.schemaVersion,
  executorId: value.executorId,
  requestHash: value.requestHash,
  receiptNonce: value.receiptNonce,
  executedAt: value.executedAt,
  executed: value.executed,
  controls: value.controls
});

const assertObligationExecution = (record: PlatformPolicyReceiptRecord): void => {
  const execution = record.obligationExecution;
  if (!record.decision.allowed) {
    if (execution !== undefined) {
      throw new ImmutablePolicyDecisionAuditError('AUDIT_OBLIGATION_EXECUTION_INVALID', 'Denied decision cannot claim obligation execution');
    }
    return;
  }
  if (
    !execution || execution.schemaVersion !== 1
    || execution.executorId !== 'ppt.platform-policy.strict-obligation-executor.v1'
    || execution.requestHash !== record.receipt.requestHash
    || execution.receiptNonce !== record.receipt.nonce
    || !Number.isFinite(Date.parse(execution.executedAt))
    || !SHA256.test(execution.attestationHash)
    || execution.attestationHash !== sha256(obligationExecutionPayload(execution))
    || !Array.isArray(execution.executed)
    || execution.executed.length !== record.decision.obligations.length
    || execution.executed.some((item, index) => (
      item.ordinal !== index
      || item.enforcement !== 'PEP_RUNTIME_CONTROL'
      || item.type !== record.decision.obligations[index]?.type
      || !same(item.value, record.decision.obligations[index]?.value)
    ))
  ) {
    throw new ImmutablePolicyDecisionAuditError('AUDIT_OBLIGATION_EXECUTION_INVALID', 'Allowed decision obligation execution is missing or invalid');
  }
};

const assertRecord = (record: PlatformPolicyReceiptRecord): void => {
  if (
    !record || typeof record !== 'object'
    || !nonEmpty(record.correlationId, 128) || !TOKEN.test(record.correlationId)
    || !SHA256.test(record.contextHash) || !SHA256.test(record.policyPackageSha256)
    || !Number.isSafeInteger(record.policyPackageVersion) || record.policyPackageVersion < 1
    || !nonEmpty(record.applicationVersion, 128)
    || !nonEmpty(record.resourceType, 128) || !nonEmpty(record.resourceId, 256)
    || !record.request || typeof record.request !== 'object'
    || !record.decision || typeof record.decision !== 'object'
    || !record.receipt || typeof record.receipt !== 'object'
    || !Number.isFinite(Date.parse(record.recordedAt))
    || !Array.isArray(record.dataClasses)
  ) throw new ImmutablePolicyDecisionAuditError('AUDIT_RECORD_INVALID', 'Policy decision audit source record is invalid');

  if (
    typeof record.decision.allowed !== 'boolean'
    || !policyReasons.has(String(record.decision.reason))
    || (record.decision.allowed && record.decision.reason !== 'ALLOW_POLICY')
    || (!record.decision.allowed && record.decision.reason === 'ALLOW_POLICY')
  ) throw new ImmutablePolicyDecisionAuditError('AUDIT_DECISION_INVALID', 'Policy decision or denial reason is invalid');

  assertObligations(record.decision.obligations);
  if (!same(record.decision, record.receipt.decision)) {
    throw new ImmutablePolicyDecisionAuditError('AUDIT_RECORD_BINDING_MISMATCH', 'Receipt decision differs from the audited decision');
  }

  const request = record.request;
  const decision = record.decision;
  if (
    record.receipt.receiptVersion !== 1
    || !SHA256.test(record.receipt.requestHash) || !SHA256.test(record.receipt.signature)
    || !nonEmpty(record.receipt.nonce, 256)
    || record.receipt.issuedAt !== record.recordedAt
    || record.receipt.requestHash !== requestHash(request)
    || record.contextHash !== platformPolicyContextHash(request)
    || decision.contextHash !== record.contextHash
    || request.correlationId !== record.correlationId
    || request.policyVersion !== decision.policyVersion
    || request.policyVersion !== record.receipt.decision.policyVersion
    || request.policyPackageVersion !== record.policyPackageVersion
    || request.policyPackageVersion !== decision.policyPackageVersion
    || request.policyPackageSha256 !== record.policyPackageSha256
    || request.policyPackageSha256 !== decision.policyPackageSha256
    || request.decisionAuthorityId !== record.decisionAuthorityId
    || request.decisionAuthorityId !== decision.decisionAuthorityId
    || request.subject.applicationVersion !== record.applicationVersion
    || request.subject.applicationVersion !== decision.applicationVersion
    || request.subject.capabilityManifestSha256 !== record.capabilityManifestSha256
    || request.subject.capabilityManifestSha256 !== decision.capabilityManifestSha256
    || request.subject.deviceCertificate?.certificateSha256 !== record.deviceCertificateSha256
    || request.subject.deviceCertificate?.certificateSha256 !== decision.deviceCertificateSha256
    || request.resource.type !== record.resourceType || request.resource.id !== record.resourceId
    || request.action !== record.action || request.capability !== record.capability
    || !same(request.resource.dataClasses, record.dataClasses)
  ) throw new ImmutablePolicyDecisionAuditError('AUDIT_RECORD_BINDING_MISMATCH', 'Policy decision audit source bindings do not match');

  assertObligationExecution(record);
};

const unsignedAuditRecord = (record: PlatformPolicyReceiptRecord): UnsignedAuditRecord => Object.freeze({
  schemaVersion: IMMUTABLE_POLICY_DECISION_AUDIT_SCHEMA_VERSION,
  correlationId: record.correlationId,
  contextHash: record.contextHash,
  requestHash: record.receipt.requestHash,
  receiptHash: sha256(record.receipt),
  recordHash: sha256(record),
  receiptNonce: record.receipt.nonce,
  policyVersion: record.decision.policyVersion,
  policyPackageVersion: record.policyPackageVersion,
  policyPackageSha256: record.policyPackageSha256,
  decisionAuthorityId: record.decisionAuthorityId ?? '',
  applicationId: record.request.subject.applicationId,
  applicationVersion: record.applicationVersion,
  capabilityManifestSha256: record.capabilityManifestSha256 ?? null,
  deviceCertificateSha256: record.deviceCertificateSha256 ?? null,
  resourceType: record.resourceType,
  resourceId: record.resourceId,
  dataClasses: Object.freeze([...record.dataClasses]),
  action: record.action,
  capability: record.capability,
  decision: record.decision.allowed ? 'allowed' : 'denied',
  decisionReason: record.decision.reason,
  obligations: Object.freeze(record.decision.obligations.map(freezeObligation)),
  recordedAt: record.recordedAt
});

export class ImmutablePolicyDecisionAuditPolicy {
  public create(record: PlatformPolicyReceiptRecord): ImmutablePolicyDecisionAuditRecord {
    assertRecord(record);
    const unsigned = unsignedAuditRecord(record);
    return Object.freeze({ ...unsigned, auditHash: sha256(unsigned) });
  }

  public verify(record: PlatformPolicyReceiptRecord, audit: ImmutablePolicyDecisionAuditRecord): boolean {
    try {
      if (!audit || audit.schemaVersion !== IMMUTABLE_POLICY_DECISION_AUDIT_SCHEMA_VERSION || !SHA256.test(audit.auditHash)) return false;
      const expected = this.create(record);
      return same(expected, audit);
    } catch {
      return false;
    }
  }

  public snapshot(): ImmutablePolicyDecisionAuditPolicySnapshot {
    return Object.freeze({
      schemaVersion: IMMUTABLE_POLICY_DECISION_AUDIT_SCHEMA_VERSION,
      enforcement: 'fail-closed',
      journalEntrySchemaVersion: 2,
      protectedAuditEnvelopeSchemaVersion: 1,
      requiredFields: IMMUTABLE_POLICY_DECISION_AUDIT_REQUIRED_FIELDS,
      allowedDecisionsRecorded: true,
      deniedDecisionsRecorded: true,
      denialReasonRequired: true,
      obligationsRecordedExactly: true,
      appendOnly: true,
      encryptedAtRest: true,
      hmacSha256Chained: true,
      externalMonotonicCheckpointRequired: true,
      payloadExposedToClient: false,
      historicalBackfillRequired: false
    });
  }
}
