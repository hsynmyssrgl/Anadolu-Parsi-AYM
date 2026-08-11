import { createHmac, timingSafeEqual } from 'node:crypto';

export type PlatformApplicationId =
  | 'windows-desktop'
  | 'windows-core-service'
  | 'windows-cluster-agent'
  | 'macos-companion'
  | 'ios-companion'
  | 'ipados-companion'
  | 'watchos-companion'
  | 'visionos-companion'
  | 'ocr-worker'
  | 'ai-worker'
  | 'translation-worker'
  | 'communication-service'
  | 'backup-worker'
  | 'signed-plugin';

export type PlatformCapability =
  | 'family.read' | 'family.write' | 'health.read' | 'health.write'
  | 'finance.read' | 'finance.write' | 'location.read' | 'location.share'
  | 'archive.read' | 'archive.write' | 'archive.ocr'
  | 'ai.process' | 'translation.process' | 'communication.message'
  | 'communication.call' | 'communication.record' | 'file.share'
  | 'backup.create' | 'backup.restore' | 'cluster.admin' | 'plugin.execute';

export type DataSensitivity = 'public' | 'internal' | 'personal' | 'sensitive' | 'highly_sensitive';
export type PolicyAction = 'read' | 'create' | 'update' | 'delete' | 'share' | 'process' | 'record' | 'administer';
export type PolicyReason =
  | 'ALLOW_POLICY'
  | 'EXPLICIT_DENY'
  | 'POLICY_VERSION_MISMATCH'
  | 'APPLICATION_NOT_REGISTERED'
  | 'CAPABILITY_NOT_DECLARED'
  | 'ACTION_CAPABILITY_MISMATCH'
  | 'DEVICE_NOT_TRUSTED'
  | 'MEMBERSHIP_INACTIVE'
  | 'PURPOSE_REQUIRED'
  | 'CONSENT_REQUIRED'
  | 'CONSENT_EXPIRED'
  | 'OFFLINE_OPERATION_FORBIDDEN'
  | 'CLUSTER_NOT_WRITABLE'
  | 'RESOURCE_SCOPE_DENIED'
  | 'OWNER_OR_GRANT_REQUIRED'
  | 'INVALID_REQUEST';

export interface PolicySubject {
  readonly accountId: string;
  readonly personId?: string;
  readonly deviceId: string;
  readonly applicationId: PlatformApplicationId;
  readonly deviceTrusted: boolean;
  readonly membershipActive: boolean;
  readonly roles: readonly string[];
  readonly familyIds?: readonly string[];
  readonly householdIds?: readonly string[];
  readonly familyBranchIds?: readonly string[];
}

export interface PolicyResource {
  readonly type: string;
  readonly id: string;
  readonly familyId: string;
  readonly householdId?: string;
  readonly familyBranchId?: string;
  readonly ownerPersonId?: string;
  readonly sensitivity: DataSensitivity;
  readonly sourceResourceId?: string;
}

export interface PolicyGrant {
  readonly id: string;
  readonly subjectAccountId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly actions: readonly PolicyAction[];
  readonly purposes?: readonly string[];
  readonly effect: 'allow' | 'deny';
  readonly startsAt: string;
  readonly endsAt?: string;
}

export interface PolicyConsent {
  readonly id: string;
  readonly subjectPersonId: string;
  readonly capability: PlatformCapability;
  readonly purpose: string;
  readonly startsAt: string;
  readonly endsAt?: string;
  readonly revokedAt?: string;
}

export interface PolicyObligation {
  readonly type:
    | 'mask_fields' | 'local_processing_only' | 'no_cache' | 'no_clipboard'
    | 'no_export' | 'no_ai' | 'no_recording' | 'watermark'
    | 'delete_after' | 'strong_reauthentication' | 'online_only' | 'high_detail_audit';
  readonly value?: string | readonly string[];
}

export interface PlatformPolicyRequest {
  readonly correlationId?: string;
  readonly policyVersion: string;
  readonly subject: PolicySubject;
  readonly resource: PolicyResource;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly purpose?: string;
  readonly occurredAt: string;
  readonly online: boolean;
  readonly clusterWritable: boolean;
  readonly grants?: readonly PolicyGrant[];
  readonly consents?: readonly PolicyConsent[];
  readonly requestedFields?: readonly string[];
  readonly enforcementMode?: 'legacy' | 'strict';
}

export interface PlatformPolicyDecision {
  readonly allowed: boolean;
  readonly reason: PolicyReason;
  readonly policyVersion: string;
  readonly matchedGrantId?: string;
  readonly matchedConsentId?: string;
  readonly obligations: readonly PolicyObligation[];
}

export interface PlatformPolicyReceipt {
  readonly receiptVersion: 1;
  readonly requestHash: string;
  readonly decision: PlatformPolicyDecision;
  readonly issuedAt: string;
  readonly nonce: string;
  readonly signature: string;
}

export interface PlatformPolicyAuthorization {
  readonly decision: PlatformPolicyDecision;
  readonly receipt: PlatformPolicyReceipt;
}

export interface PlatformPolicyKernelConfig {
  readonly policyVersion: string;
  readonly signingKey: Uint8Array;
  readonly applicationCapabilities: Readonly<Partial<Record<PlatformApplicationId, readonly PlatformCapability[]>>>;
  readonly consentRequiredCapabilities: readonly PlatformCapability[];
  readonly onlineOnlyCapabilities: readonly PlatformCapability[];
  readonly writeActions: readonly PolicyAction[];
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const digest = (value: unknown): string => createHmac('sha256', 'ppt-policy-request-v1').update(stable(value)).digest('hex');
const sign = (key: Uint8Array, value: unknown): string => createHmac('sha256', key).update(stable(value)).digest('hex');
const parseTime = (value?: string): number => value ? Date.parse(value) : Number.NaN;
const isSensitive = (sensitivity: DataSensitivity): boolean => sensitivity === 'sensitive' || sensitivity === 'highly_sensitive';
const freezeObligations = (values: readonly PolicyObligation[]): readonly PolicyObligation[] => Object.freeze(values.map((value) => Object.freeze({
  ...value,
  ...(Array.isArray(value.value) ? { value: Object.freeze([...value.value]) } : {})
})));
const nonEmpty = (value: unknown, max = 512): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
const validSensitivities = new Set<DataSensitivity>(['public', 'internal', 'personal', 'sensitive', 'highly_sensitive']);
const validActions = new Set<PolicyAction>(['read', 'create', 'update', 'delete', 'share', 'process', 'record', 'administer']);
const actions = (...values: PolicyAction[]): readonly PolicyAction[] => Object.freeze(values);
const capabilityActions: Readonly<Record<PlatformCapability, readonly PolicyAction[]>> = Object.freeze({
  'family.read': actions('read'),
  'family.write': actions('create', 'update', 'delete'),
  'health.read': actions('read'),
  'health.write': actions('create', 'update', 'delete'),
  'finance.read': actions('read'),
  'finance.write': actions('create', 'update', 'delete'),
  'location.read': actions('read'),
  'location.share': actions('share'),
  'archive.read': actions('read'),
  'archive.write': actions('create', 'update', 'delete', 'record'),
  'archive.ocr': actions('read', 'process'),
  'ai.process': actions('process'),
  'translation.process': actions('process'),
  'communication.message': actions('create'),
  'communication.call': actions('create'),
  'communication.record': actions('record'),
  'file.share': actions('share'),
  'backup.create': actions('create'),
  'backup.restore': actions('update'),
  'cluster.admin': actions('administer'),
  'plugin.execute': actions('process')
});

const validGrant = (value: PolicyGrant): boolean =>
  nonEmpty(value.id) && nonEmpty(value.subjectAccountId) && nonEmpty(value.resourceType) && nonEmpty(value.resourceId) &&
  Array.isArray(value.actions) && value.actions.length > 0 && value.actions.every((action) => validActions.has(action)) &&
  (value.effect === 'allow' || value.effect === 'deny') && Number.isFinite(parseTime(value.startsAt)) &&
  (!value.endsAt || Number.isFinite(parseTime(value.endsAt)));

const validConsent = (value: PolicyConsent): boolean =>
  nonEmpty(value.id) && nonEmpty(value.subjectPersonId) && nonEmpty(value.capability) && Boolean(capabilityActions[value.capability]) && nonEmpty(value.purpose) &&
  Number.isFinite(parseTime(value.startsAt)) && (!value.endsAt || Number.isFinite(parseTime(value.endsAt))) &&
  (!value.revokedAt || Number.isFinite(parseTime(value.revokedAt)));

export class PlatformPolicyKernel {
  readonly #config: PlatformPolicyKernelConfig;

  public constructor(config: PlatformPolicyKernelConfig) {
    if (!config.policyVersion.trim()) throw new Error('policyVersion is required');
    if (config.signingKey.byteLength < 32) throw new Error('policy signing key must be at least 256 bits');
    const applicationCapabilities = Object.fromEntries(
      Object.entries(config.applicationCapabilities).map(([applicationId, capabilities]) => [applicationId, Object.freeze([...(capabilities ?? [])])])
    ) as Partial<Record<PlatformApplicationId, readonly PlatformCapability[]>>;
    this.#config = Object.freeze({
      policyVersion: config.policyVersion,
      signingKey: Uint8Array.from(config.signingKey),
      applicationCapabilities: Object.freeze(applicationCapabilities),
      consentRequiredCapabilities: Object.freeze([...config.consentRequiredCapabilities]),
      onlineOnlyCapabilities: Object.freeze([...config.onlineOnlyCapabilities]),
      writeActions: Object.freeze([...config.writeActions])
    });
  }

  public evaluate(request: PlatformPolicyRequest): PlatformPolicyDecision {
    const deny = (reason: PolicyReason, obligations: readonly PolicyObligation[] = []): PlatformPolicyDecision =>
      Object.freeze({ allowed: false, reason, policyVersion: this.#config.policyVersion, obligations: freezeObligations(obligations) });

    if (
      !nonEmpty(request.subject?.accountId) || !nonEmpty(request.subject?.deviceId) ||
      !nonEmpty(request.resource?.type) || !nonEmpty(request.resource?.id) || !nonEmpty(request.resource?.familyId) ||
      !nonEmpty(request.occurredAt) || !Number.isFinite(parseTime(request.occurredAt)) ||
      typeof request.subject.deviceTrusted !== 'boolean' || typeof request.subject.membershipActive !== 'boolean' ||
      !Array.isArray(request.subject.roles) || !request.subject.roles.every((role) => nonEmpty(role, 128)) ||
      (request.subject.familyIds !== undefined && (!Array.isArray(request.subject.familyIds) || !request.subject.familyIds.every((id) => nonEmpty(id)))) ||
      (request.subject.householdIds !== undefined && (!Array.isArray(request.subject.householdIds) || !request.subject.householdIds.every((id) => nonEmpty(id)))) ||
      (request.subject.familyBranchIds !== undefined && (!Array.isArray(request.subject.familyBranchIds) || !request.subject.familyBranchIds.every((id) => nonEmpty(id)))) ||
      typeof request.online !== 'boolean' || typeof request.clusterWritable !== 'boolean' ||
      !validSensitivities.has(request.resource.sensitivity) || !validActions.has(request.action) ||
      (request.enforcementMode !== undefined && request.enforcementMode !== 'legacy' && request.enforcementMode !== 'strict') ||
      (request.purpose !== undefined && !nonEmpty(request.purpose, 256)) ||
      (request.grants !== undefined && (!Array.isArray(request.grants) || !request.grants.every(validGrant))) ||
      (request.consents !== undefined && (!Array.isArray(request.consents) || !request.consents.every(validConsent)))
    ) return deny('INVALID_REQUEST');
    if (request.policyVersion !== this.#config.policyVersion) return deny('POLICY_VERSION_MISMATCH');
    const capabilities = this.#config.applicationCapabilities[request.subject.applicationId];
    if (!capabilities) return deny('APPLICATION_NOT_REGISTERED');
    if (!capabilities.includes(request.capability)) return deny('CAPABILITY_NOT_DECLARED');
    if (!capabilityActions[request.capability]?.includes(request.action)) return deny('ACTION_CAPABILITY_MISMATCH');
    if (request.subject.deviceTrusted !== true) return deny('DEVICE_NOT_TRUSTED');
    if (request.subject.membershipActive !== true) return deny('MEMBERSHIP_INACTIVE');
    if (
      (request.subject.familyIds && !request.subject.familyIds.includes(request.resource.familyId)) ||
      (request.resource.householdId && (!request.subject.householdIds || !request.subject.householdIds.includes(request.resource.householdId))) ||
      (request.resource.familyBranchId && (!request.subject.familyBranchIds || !request.subject.familyBranchIds.includes(request.resource.familyBranchId)))
    ) return deny('RESOURCE_SCOPE_DENIED');
    if (isSensitive(request.resource.sensitivity) && !request.purpose?.trim()) return deny('PURPOSE_REQUIRED');
    if (!request.online && this.#config.onlineOnlyCapabilities.includes(request.capability)) return deny('OFFLINE_OPERATION_FORBIDDEN');
    if (this.#config.writeActions.includes(request.action) && !request.clusterWritable) return deny('CLUSTER_NOT_WRITABLE');

    const at = parseTime(request.occurredAt);
    const activeGrants = (request.grants ?? []).filter((grant) =>
      grant.subjectAccountId === request.subject.accountId &&
      grant.resourceType === request.resource.type &&
      (grant.resourceId === request.resource.id || grant.resourceId === '*') &&
      grant.actions.includes(request.action) &&
      (!grant.purposes?.length || Boolean(request.purpose && grant.purposes.includes(request.purpose))) &&
      parseTime(grant.startsAt) <= at &&
      (!grant.endsAt || parseTime(grant.endsAt) >= at)
    );
    const explicitDeny = activeGrants.find((grant) => grant.effect === 'deny');
    if (explicitDeny) return Object.freeze({ allowed: false, reason: 'EXPLICIT_DENY', policyVersion: this.#config.policyVersion, matchedGrantId: explicitDeny.id, obligations: freezeObligations([]) });

    let matchedConsentId: string | undefined;
    if (this.#config.consentRequiredCapabilities.includes(request.capability)) {
      const consent = (request.consents ?? []).find((item) =>
        item.subjectPersonId === (request.resource.ownerPersonId ?? request.subject.personId) &&
        item.capability === request.capability &&
        item.purpose === request.purpose &&
        !item.revokedAt &&
        parseTime(item.startsAt) <= at &&
        (!item.endsAt || parseTime(item.endsAt) >= at)
      );
      if (!consent) {
        const expired = (request.consents ?? []).some((item) => item.capability === request.capability && item.purpose === request.purpose && Boolean(item.endsAt) && parseTime(item.endsAt) < at);
        return deny(expired ? 'CONSENT_EXPIRED' : 'CONSENT_REQUIRED', [{ type: 'no_recording' }, { type: 'no_ai' }]);
      }
      matchedConsentId = consent.id;
    }

    const owner = Boolean(request.subject.personId && request.resource.ownerPersonId && request.subject.personId === request.resource.ownerPersonId);
    const explicitAllow = activeGrants.find((grant) => grant.effect === 'allow');
    if (
      !owner && !explicitAllow &&
      (request.enforcementMode === 'strict' || (request.resource.sensitivity !== 'public' && request.resource.sensitivity !== 'internal'))
    ) return deny('OWNER_OR_GRANT_REQUIRED');

    const obligations: PolicyObligation[] = [];
    if (isSensitive(request.resource.sensitivity)) obligations.push({ type: 'high_detail_audit' });
    if (request.capability === 'archive.ocr' || request.capability === 'ai.process' || request.capability === 'translation.process') obligations.push({ type: 'local_processing_only' });
    if (!request.online) obligations.push({ type: 'no_export' });
    if (request.capability === 'communication.record') obligations.push({ type: 'delete_after', value: 'consent-retention-policy' });

    return Object.freeze({
      allowed: true,
      reason: 'ALLOW_POLICY',
      policyVersion: this.#config.policyVersion,
      ...(explicitAllow ? { matchedGrantId: explicitAllow.id } : {}),
      ...(matchedConsentId ? { matchedConsentId } : {}),
      obligations: freezeObligations(obligations)
    });
  }

  public issueReceipt(request: PlatformPolicyRequest, decision: PlatformPolicyDecision, issuedAt: string, nonce: string): PlatformPolicyReceipt {
    if (!nonEmpty(nonce, 256)) throw new Error('receipt nonce is required');
    if (!nonEmpty(issuedAt, 128) || !Number.isFinite(parseTime(issuedAt))) throw new Error('receipt issuedAt is invalid');
    const evaluated = this.evaluate(request);
    if (stable(evaluated) !== stable(decision)) throw new Error('policy decision does not match a fresh kernel evaluation');
    const unsigned = { receiptVersion: 1 as const, requestHash: digest(request), decision, issuedAt, nonce };
    return Object.freeze({ ...unsigned, signature: sign(this.#config.signingKey, unsigned) });
  }

  public authorizeWithReceipt(request: PlatformPolicyRequest, issuedAt: string, nonce: string): PlatformPolicyAuthorization {
    const decision = this.evaluate(request);
    const receipt = this.issueReceipt(request, decision, issuedAt, nonce);
    return Object.freeze({ decision, receipt });
  }

  public verifyReceipt(receipt: PlatformPolicyReceipt): boolean {
    try {
      if (receipt.receiptVersion !== 1 || receipt.decision.policyVersion !== this.#config.policyVersion) return false;
      if (!nonEmpty(receipt.issuedAt, 128) || !Number.isFinite(parseTime(receipt.issuedAt)) || !nonEmpty(receipt.nonce, 256)) return false;
      if (!/^[0-9a-f]{64}$/iu.test(receipt.requestHash) || !/^[0-9a-f]{64}$/iu.test(receipt.signature)) return false;
      const unsigned = { receiptVersion: receipt.receiptVersion, requestHash: receipt.requestHash, decision: receipt.decision, issuedAt: receipt.issuedAt, nonce: receipt.nonce };
      const expected = Buffer.from(sign(this.#config.signingKey, unsigned), 'hex');
      const actual = Buffer.from(receipt.signature, 'hex');
      return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  public verifyReceiptForRequest(receipt: PlatformPolicyReceipt, request: PlatformPolicyRequest): boolean {
    if (receipt.requestHash !== digest(request)) return false;
    if (receipt.decision.policyVersion !== this.#config.policyVersion) return false;
    if (stable(receipt.decision) !== stable(this.evaluate(request))) return false;
    return this.verifyReceipt(receipt);
  }
}
