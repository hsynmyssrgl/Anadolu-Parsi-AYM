import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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

export const PLATFORM_APPLICATION_IDS = Object.freeze([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent',
  'macos-companion', 'ios-companion', 'ipados-companion', 'watchos-companion',
  'visionos-companion', 'ocr-worker', 'ai-worker', 'translation-worker',
  'communication-service', 'backup-worker', 'signed-plugin'
] as const satisfies readonly PlatformApplicationId[]);
const platformApplicationIdSet = new Set<PlatformApplicationId>(PLATFORM_APPLICATION_IDS);

export type PlatformCapability =
  | 'family.read' | 'family.write' | 'health.read' | 'health.write'
  | 'finance.read' | 'finance.write' | 'location.read' | 'location.share'
  | 'archive.read' | 'archive.write' | 'archive.ocr'
  | 'ai.process' | 'translation.process' | 'communication.message'
  | 'communication.call' | 'communication.record' | 'file.share'
  | 'backup.create' | 'backup.restore' | 'cluster.admin' | 'plugin.execute';

export type PlatformRuntimeCapability =
  | 'camera.access'
  | 'microphone.access'
  | 'file.access'
  | 'ocr.process'
  | 'ai.process'
  | 'location.access'
  | 'network.access';

export const PLATFORM_RUNTIME_CAPABILITIES = Object.freeze([
  'camera.access',
  'microphone.access',
  'file.access',
  'ocr.process',
  'ai.process',
  'location.access',
  'network.access'
] as const satisfies readonly PlatformRuntimeCapability[]);
const platformRuntimeCapabilitySet = new Set<PlatformRuntimeCapability>(PLATFORM_RUNTIME_CAPABILITIES);

export type PlatformPolicyDecisionAuthorityId = 'local-policy-kernel' | 'windows-core-service';

export type DataSensitivity = 'public' | 'internal' | 'personal' | 'sensitive' | 'highly_sensitive';
export type PlatformDataClass =
  | 'general'
  | 'personal'
  | 'special'
  | 'health'
  | 'finance'
  | 'child'
  | 'location'
  | 'communication'
  | 'biometric'
  | 'legacy';
export type PlatformDataClassificationSource = 'declared' | 'policy_default';
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
  | 'OWNERSHIP_SHARE_REQUIRED'
  | 'DATA_CLASS_CAPABILITY_MISMATCH'
  | 'POLICY_PACKAGE_VERSION_MISMATCH'
  | 'POLICY_PACKAGE_HASH_MISMATCH'
  | 'APPLICATION_VERSION_MISMATCH'
  | 'APPLICATION_MANIFEST_MISMATCH'
  | 'DEVICE_CERTIFICATE_INVALID'
  | 'DECISION_AUTHORITY_MISMATCH'
  | 'INVALID_REQUEST';

export interface PlatformApplicationIdentityManifest {
  readonly schemaVersion: 1;
  readonly applicationId: PlatformApplicationId;
  readonly applicationVersion: string;
  readonly capabilities: readonly PlatformCapability[];
  readonly runtimeCapabilities: readonly PlatformRuntimeCapability[];
  readonly deviceCertificateRequired: boolean;
  readonly capabilityManifestSha256: string;
}

export interface PlatformDeviceCertificate {
  readonly schemaVersion: 1;
  readonly issuer: 'trusted-device-registry';
  readonly deviceId: string;
  readonly applicationId: PlatformApplicationId;
  readonly publicKeyFingerprintSha256: string;
  readonly capabilityManifestSha256: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly certificateSha256: string;
}

export interface PolicySubject {
  readonly accountId: string;
  readonly personId?: string;
  readonly deviceId: string;
  readonly applicationId: PlatformApplicationId;
  readonly applicationVersion?: string;
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificate?: PlatformDeviceCertificate;
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
  readonly dataClasses?: readonly PlatformDataClass[];
  readonly classificationSource?: PlatformDataClassificationSource;
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
  /** Subject ownership share for this resource, expressed as 1..10,000 basis points. */
  readonly ownershipBasisPoints?: number;
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

export type PolicyObligationType =
  | 'mask_fields' | 'local_processing_only' | 'no_cache' | 'no_clipboard'
  | 'no_export' | 'no_ai' | 'no_recording' | 'watermark'
  | 'delete_after' | 'strong_reauthentication' | 'online_only' | 'high_detail_audit';

export interface PolicyObligation {
  readonly type: PolicyObligationType;
  readonly value?: string | readonly string[];
}

export interface PlatformPolicyRequest {
  readonly correlationId?: string;
  readonly policyVersion: string;
  /** Version of the signed policy package used for this authorization. */
  readonly policyPackageVersion?: number;
  /** SHA-256 of the exact canonical signed policy package payload. */
  readonly policyPackageSha256?: string;
  /** Trusted process that must freshly evaluate this complete request. */
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  readonly subject: PolicySubject;
  readonly resource: PolicyResource;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly purpose?: string;
  /** Minimum ownership share required by the operation, expressed as 1..10,000 basis points. */
  readonly minimumOwnershipBasisPoints?: number;
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
  readonly policyPackageVersion?: number;
  readonly policyPackageSha256?: string;
  readonly applicationVersion?: string;
  readonly capabilityManifestSha256?: string;
  readonly deviceCertificateSha256?: string;
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  /** SHA-256 binding of the complete validated authorization context. */
  readonly contextHash?: string;
  readonly matchedGrantId?: string;
  readonly matchedOwnershipBasisPoints?: number;
  readonly matchedConsentId?: string;
  readonly obligations: readonly PolicyObligation[];
}

export interface PlatformPolicyContextSnapshot {
  readonly schemaVersion: 1;
  readonly correlationId: string;
  readonly policyVersion: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly decisionAuthorityId: PlatformPolicyDecisionAuthorityId | '';
  readonly subject: {
    readonly accountId: string;
    readonly personId: string | null;
    readonly deviceId: string;
    readonly applicationId: PlatformApplicationId;
    readonly applicationVersion: string;
    readonly capabilityManifestSha256: string;
    readonly deviceCertificateSha256: string;
    readonly deviceTrusted: boolean;
    readonly membershipActive: boolean;
    readonly roles: readonly string[];
    readonly familyIds: readonly string[];
    readonly householdIds: readonly string[];
    readonly familyBranchIds: readonly string[];
  };
  readonly resource: {
    readonly type: string;
    readonly id: string;
    readonly familyId: string;
    readonly householdId: string | null;
    readonly familyBranchId: string | null;
    readonly ownerPersonId: string | null;
    readonly sensitivity: DataSensitivity;
    readonly dataClasses: readonly PlatformDataClass[];
    readonly classificationSource: PlatformDataClassificationSource;
    readonly sourceResourceId: string | null;
  };
  readonly purpose: string;
  readonly minimumOwnershipBasisPoints: number;
  readonly occurredAt: string;
  readonly action: PolicyAction;
  readonly capability: PlatformCapability;
  readonly online: boolean;
  readonly clusterWritable: boolean;
  readonly requestedFields: readonly string[];
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
  readonly policyPackageVersion?: number;
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  readonly applicationVersions?: Readonly<Partial<Record<PlatformApplicationId, string>>>;
  readonly deviceCertificateRequiredApplications?: readonly PlatformApplicationId[];
  readonly applicationCapabilities: Readonly<Partial<Record<PlatformApplicationId, readonly PlatformCapability[]>>>;
  readonly applicationRuntimeCapabilities?: Readonly<Partial<Record<PlatformApplicationId, readonly PlatformRuntimeCapability[]>>>;
  readonly consentRequiredCapabilities: readonly PlatformCapability[];
  readonly onlineOnlyCapabilities: readonly PlatformCapability[];
  readonly writeActions: readonly PolicyAction[];
}

export interface PlatformPolicyPackagePayload {
  readonly schemaVersion: 1;
  readonly packageVersion: number;
  readonly policyVersion: string;
  readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId;
  readonly applicationVersions: Readonly<Partial<Record<PlatformApplicationId, string>>>;
  readonly applicationCapabilities: Readonly<Partial<Record<PlatformApplicationId, readonly PlatformCapability[]>>>;
  readonly applicationManifests: Readonly<Partial<Record<PlatformApplicationId, PlatformApplicationIdentityManifest>>>;
  readonly consentRequiredCapabilities: readonly PlatformCapability[];
  readonly onlineOnlyCapabilities: readonly PlatformCapability[];
  readonly writeActions: readonly PolicyAction[];
}

export interface PlatformPolicyPackage {
  readonly payload: PlatformPolicyPackagePayload;
  readonly payloadSha256: string;
  readonly signatureAlgorithm: 'HMAC-SHA256';
  readonly signature: string;
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
const sha256 = (value: unknown): string => createHash('sha256').update(stable(value), 'utf8').digest('hex');
const sha256Pattern = /^[0-9a-f]{64}$/u;

export const platformCapabilityManifestHash = (input: {
  readonly applicationId: PlatformApplicationId;
  readonly applicationVersion: string;
  readonly capabilities: readonly PlatformCapability[];
  readonly runtimeCapabilities?: readonly PlatformRuntimeCapability[];
  readonly deviceCertificateRequired: boolean;
}): string => sha256({
  schemaVersion: 1,
  applicationId: input.applicationId,
  applicationVersion: input.applicationVersion,
  capabilities: [...input.capabilities].sort(),
  runtimeCapabilities: [...(input.runtimeCapabilities ?? [])].sort(),
  deviceCertificateRequired: input.deviceCertificateRequired
});

type PlatformDeviceCertificatePayload = Omit<PlatformDeviceCertificate, 'certificateSha256'>;

export const createPlatformDeviceCertificate = (
  input: PlatformDeviceCertificatePayload
): PlatformDeviceCertificate => {
  const payload: PlatformDeviceCertificatePayload = Object.freeze({
    schemaVersion: input.schemaVersion,
    issuer: input.issuer,
    deviceId: input.deviceId,
    applicationId: input.applicationId,
    publicKeyFingerprintSha256: input.publicKeyFingerprintSha256,
    capabilityManifestSha256: input.capabilityManifestSha256,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt
  });
  return Object.freeze({ ...payload, certificateSha256: sha256(payload) });
};

export const verifyPlatformDeviceCertificate = (
  certificate: PlatformDeviceCertificate,
  expected: {
    readonly deviceId: string;
    readonly applicationId: PlatformApplicationId;
    readonly capabilityManifestSha256: string;
    readonly occurredAt: string;
  }
): boolean => {
  try {
    const { certificateSha256, ...payload } = certificate;
    const occurredAt = Date.parse(expected.occurredAt);
    return certificate.schemaVersion === 1
      && certificate.issuer === 'trusted-device-registry'
      && certificate.deviceId === expected.deviceId
      && certificate.applicationId === expected.applicationId
      && certificate.capabilityManifestSha256 === expected.capabilityManifestSha256
      && sha256Pattern.test(certificate.publicKeyFingerprintSha256)
      && sha256Pattern.test(certificate.capabilityManifestSha256)
      && sha256Pattern.test(certificateSha256)
      && certificateSha256 === sha256(payload)
      && Number.isFinite(occurredAt)
      && Number.isFinite(Date.parse(certificate.issuedAt))
      && Number.isFinite(Date.parse(certificate.expiresAt))
      && Date.parse(certificate.issuedAt) <= occurredAt
      && occurredAt <= Date.parse(certificate.expiresAt);
  } catch {
    return false;
  }
};
const signPolicyPackage = (key: Uint8Array, payload: PlatformPolicyPackagePayload): string =>
  createHmac('sha256', key).update('ppt-policy-package-v1\0', 'utf8').update(stable(payload), 'utf8').digest('hex');
const parseTime = (value?: string): number => value ? Date.parse(value) : Number.NaN;
const isSensitive = (sensitivity: DataSensitivity): boolean => sensitivity === 'sensitive' || sensitivity === 'highly_sensitive';
const freezeObligations = (values: readonly PolicyObligation[]): readonly PolicyObligation[] => Object.freeze(values.map((value) => Object.freeze({
  ...value,
  ...(Array.isArray(value.value) ? { value: Object.freeze([...value.value]) } : {})
})));
const nonEmpty = (value: unknown, max = 512): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
const validUniqueStrings = (value: unknown, minimum: number, maximum: number, itemMaximum = 512): value is readonly string[] =>
  Array.isArray(value) && value.length >= minimum && value.length <= maximum &&
  value.every((item) => nonEmpty(item, itemMaximum)) && new Set(value).size === value.length;
const validSensitivities = new Set<DataSensitivity>(['public', 'internal', 'personal', 'sensitive', 'highly_sensitive']);
export const PLATFORM_DATA_CLASSES = Object.freeze([
  'general', 'personal', 'special', 'health', 'finance', 'child',
  'location', 'communication', 'biometric', 'legacy'
] as const satisfies readonly PlatformDataClass[]);
const validDataClasses = new Set<PlatformDataClass>(PLATFORM_DATA_CLASSES);
const dataClassOrder = new Map<PlatformDataClass, number>(PLATFORM_DATA_CLASSES.map((value, index) => [value, index]));
const validClassificationSources = new Set<PlatformDataClassificationSource>(['declared', 'policy_default']);
export const PPK006_POLICY_OBLIGATION_TYPES = Object.freeze([
  'mask_fields',
  'local_processing_only',
  'no_cache',
  'no_export',
  'no_ai',
  'no_recording',
  'watermark',
  'delete_after'
] as const satisfies readonly PolicyObligationType[]);
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
  (value.effect === 'allow' || value.effect === 'deny') &&
  (value.ownershipBasisPoints === undefined || (value.effect === 'allow' && Number.isInteger(value.ownershipBasisPoints) && value.ownershipBasisPoints >= 1 && value.ownershipBasisPoints <= 10_000)) &&
  Number.isFinite(parseTime(value.startsAt)) &&
  (!value.endsAt || Number.isFinite(parseTime(value.endsAt)));

const validConsent = (value: PolicyConsent): boolean =>
  nonEmpty(value.id) && nonEmpty(value.subjectPersonId) && nonEmpty(value.capability) && Boolean(capabilityActions[value.capability]) && nonEmpty(value.purpose) &&
  Number.isFinite(parseTime(value.startsAt)) && (!value.endsAt || Number.isFinite(parseTime(value.endsAt))) &&
  (!value.revokedAt || Number.isFinite(parseTime(value.revokedAt)));

export const normalizePlatformDataClasses = (
  values: readonly PlatformDataClass[]
): readonly PlatformDataClass[] => {
  if (
    !Array.isArray(values) || values.length < 1 || values.length > PLATFORM_DATA_CLASSES.length
    || values.some((value) => !validDataClasses.has(value))
    || new Set(values).size !== values.length
  ) throw new TypeError('Platform data classes must be a non-empty unique supported set');
  return Object.freeze([...values].sort((left, right) => (dataClassOrder.get(left) ?? 99) - (dataClassOrder.get(right) ?? 99)));
};

export const inferPlatformDataClasses = (
  capability: PlatformCapability,
  resourceType: string
): readonly PlatformDataClass[] => {
  const type = resourceType.trim().toLowerCase();
  const inferred = new Set<PlatformDataClass>();
  if (/(?:^|[_:.-])child(?:$|[_:.-])|minor|guardian/u.test(type)) inferred.add('child');
  if (/health|medical|medication|diagnos/u.test(type)) inferred.add('health');
  if (/finance|payment|accounting|valuation/u.test(type)) inferred.add('finance');
  if (/location|geofence|coordinate|address/u.test(type)) inferred.add('location');
  if (/communication|message|call|recording/u.test(type)) inferred.add('communication');
  if (/biometric|fingerprint|face|voiceprint/u.test(type)) inferred.add('biometric');
  if (/legacy|inheritance|estate|will/u.test(type)) inferred.add('legacy');
  if (inferred.size === 0) {
    if (capability.startsWith('health.')) inferred.add('health');
    else if (capability.startsWith('finance.')) inferred.add('finance');
    else if (capability.startsWith('location.')) inferred.add('location');
    else if (capability.startsWith('communication.')) inferred.add('communication');
    else if (capability === 'ai.process' || capability === 'translation.process' || capability === 'plugin.execute') inferred.add('special');
    else if (capability === 'cluster.admin' || type === 'desktop_ipc_endpoint') inferred.add('general');
    else inferred.add('personal');
  }
  return normalizePlatformDataClasses([...inferred]);
};

const dataClassCapabilityCompatible = (
  dataClass: PlatformDataClass,
  capability: PlatformCapability
): boolean => {
  if (capability.startsWith('family.') || capability.startsWith('backup.')) return true;
  if (dataClass === 'health') return capability.startsWith('health.');
  if (dataClass === 'finance') return capability.startsWith('finance.');
  if (dataClass === 'location') return capability.startsWith('location.');
  if (dataClass === 'communication') return capability.startsWith('communication.');
  return true;
};

const obligationDataClassSets = Object.freeze({
  localProcessingOnly: new Set<PlatformDataClass>(['special', 'health', 'finance', 'biometric']),
  noCache: new Set<PlatformDataClass>(['special', 'health', 'finance', 'child', 'location', 'communication', 'biometric', 'legacy']),
  noExport: new Set<PlatformDataClass>(['special', 'health', 'finance', 'child', 'biometric', 'legacy']),
  noAi: new Set<PlatformDataClass>(['special', 'health', 'finance', 'child', 'biometric']),
  noRecording: new Set<PlatformDataClass>(['special', 'health', 'finance', 'child', 'location', 'biometric', 'legacy'])
});
const retentionPriority = Object.freeze([
  'biometric', 'child', 'special', 'health', 'finance', 'communication', 'location', 'legacy', 'personal'
] as const satisfies readonly PlatformDataClass[]);
const hasObligationClass = (
  dataClasses: readonly PlatformDataClass[],
  values: ReadonlySet<PlatformDataClass>
): boolean => dataClasses.some((value) => values.has(value));

export const platformPolicyContextSnapshot = (request: PlatformPolicyRequest): PlatformPolicyContextSnapshot => Object.freeze({
  schemaVersion: 1 as const,
  correlationId: request.correlationId ?? '',
  policyVersion: request.policyVersion,
  policyPackageVersion: request.policyPackageVersion ?? 0,
  policyPackageSha256: request.policyPackageSha256 ?? '',
  decisionAuthorityId: request.decisionAuthorityId ?? '',
  subject: Object.freeze({
    accountId: request.subject.accountId,
    personId: request.subject.personId ?? null,
    deviceId: request.subject.deviceId,
    applicationId: request.subject.applicationId,
    applicationVersion: request.subject.applicationVersion ?? '',
    capabilityManifestSha256: request.subject.capabilityManifestSha256 ?? '',
    deviceCertificateSha256: request.subject.deviceCertificate?.certificateSha256 ?? '',
    deviceTrusted: request.subject.deviceTrusted,
    membershipActive: request.subject.membershipActive,
    roles: Object.freeze([...(request.subject.roles ?? [])]),
    familyIds: Object.freeze([...(request.subject.familyIds ?? [])]),
    householdIds: Object.freeze([...(request.subject.householdIds ?? [])]),
    familyBranchIds: Object.freeze([...(request.subject.familyBranchIds ?? [])])
  }),
  resource: Object.freeze({
    type: request.resource.type,
    id: request.resource.id,
    familyId: request.resource.familyId,
    householdId: request.resource.householdId ?? null,
    familyBranchId: request.resource.familyBranchId ?? null,
    ownerPersonId: request.resource.ownerPersonId ?? null,
    sensitivity: request.resource.sensitivity,
    dataClasses: Object.freeze([...(request.resource.dataClasses ?? [])]),
    classificationSource: request.resource.classificationSource ?? 'policy_default',
    sourceResourceId: request.resource.sourceResourceId ?? null
  }),
  purpose: request.purpose ?? '',
  minimumOwnershipBasisPoints: request.minimumOwnershipBasisPoints ?? 0,
  occurredAt: request.occurredAt,
  action: request.action,
  capability: request.capability,
  online: request.online,
  clusterWritable: request.clusterWritable,
  requestedFields: Object.freeze([...(request.requestedFields ?? [])])
});

export const platformPolicyContextHash = (request: PlatformPolicyRequest): string =>
  createHash('sha256').update(stable(platformPolicyContextSnapshot(request)), 'utf8').digest('hex');

export class PlatformPolicyKernel {
  readonly #config: PlatformPolicyKernelConfig & {
    readonly policyPackageVersion: number;
    readonly applicationVersions: Readonly<Partial<Record<PlatformApplicationId, string>>>;
    readonly applicationRuntimeCapabilities: Readonly<Partial<Record<PlatformApplicationId, readonly PlatformRuntimeCapability[]>>>;
    readonly applicationManifests: Readonly<Partial<Record<PlatformApplicationId, PlatformApplicationIdentityManifest>>>;
  };
  readonly #policyPackage: PlatformPolicyPackage;

  public constructor(config: PlatformPolicyKernelConfig) {
    if (!config.policyVersion.trim()) throw new Error('policyVersion is required');
    if (config.signingKey.byteLength < 32) throw new Error('policy signing key must be at least 256 bits');
    if (
      config.decisionAuthorityId !== undefined
      && config.decisionAuthorityId !== 'local-policy-kernel'
      && config.decisionAuthorityId !== 'windows-core-service'
    ) throw new Error('decisionAuthorityId is invalid');
    const packageVersion = config.policyPackageVersion ?? 1;
    if (!Number.isSafeInteger(packageVersion) || packageVersion < 1) throw new Error('policyPackageVersion must be a positive safe integer');
    const applicationCapabilities = Object.fromEntries(
      Object.entries(config.applicationCapabilities).map(([applicationId, capabilities]) => [applicationId, Object.freeze([...(capabilities ?? [])].sort())])
    ) as Partial<Record<PlatformApplicationId, readonly PlatformCapability[]>>;
    if (Object.keys(applicationCapabilities).some((applicationId) => !platformApplicationIdSet.has(applicationId as PlatformApplicationId))) {
      throw new Error('application capability registry contains an invalid applicationId');
    }
    const configuredRuntimeCapabilities = config.applicationRuntimeCapabilities ?? {};
    if (Object.keys(configuredRuntimeCapabilities).some((applicationId) => (
      !platformApplicationIdSet.has(applicationId as PlatformApplicationId)
      || applicationCapabilities[applicationId as PlatformApplicationId] === undefined
    ))) throw new Error('application runtime capability registry contains an unregistered applicationId');
    const applicationRuntimeCapabilities = Object.fromEntries(
      Object.keys(applicationCapabilities).sort().map((applicationIdValue) => {
        const applicationId = applicationIdValue as PlatformApplicationId;
        const values = [...(configuredRuntimeCapabilities[applicationId] ?? [])];
        if (
          values.length !== new Set(values).size
          || values.some((value) => !platformRuntimeCapabilitySet.has(value))
        ) throw new Error(`application runtime capability registry is invalid: ${applicationId}`);
        return [applicationId, Object.freeze(values.sort())];
      })
    ) as Partial<Record<PlatformApplicationId, readonly PlatformRuntimeCapability[]>>;
    const applicationVersions = Object.fromEntries(
      Object.keys(applicationCapabilities).sort().map((applicationId) => {
        const version = config.applicationVersions?.[applicationId as PlatformApplicationId] ?? 'v1';
        if (!nonEmpty(version, 128)) throw new Error(`application version is invalid: ${applicationId}`);
        return [applicationId, version];
      })
    ) as Partial<Record<PlatformApplicationId, string>>;
    const certificateRequired = new Set(config.deviceCertificateRequiredApplications ?? []);
    if (
      certificateRequired.size !== (config.deviceCertificateRequiredApplications?.length ?? 0)
      || [...certificateRequired].some((applicationId) => !platformApplicationIdSet.has(applicationId))
    ) throw new Error('device certificate application registry is invalid');
    const applicationManifests = Object.fromEntries(
      Object.keys(applicationCapabilities).sort().map((applicationIdValue) => {
        const applicationId = applicationIdValue as PlatformApplicationId;
        const applicationVersion = applicationVersions[applicationId]!;
        const capabilities = applicationCapabilities[applicationId]!;
        const runtimeCapabilities = applicationRuntimeCapabilities[applicationId]!;
        const deviceCertificateRequired = certificateRequired.has(applicationId);
        const manifest = Object.freeze({
          schemaVersion: 1 as const,
          applicationId,
          applicationVersion,
          capabilities,
          runtimeCapabilities,
          deviceCertificateRequired,
          capabilityManifestSha256: platformCapabilityManifestHash({
            applicationId,
            applicationVersion,
            capabilities,
            runtimeCapabilities,
            deviceCertificateRequired
          })
        });
        return [applicationId, manifest];
      })
    ) as Partial<Record<PlatformApplicationId, PlatformApplicationIdentityManifest>>;
    this.#config = Object.freeze({
      policyVersion: config.policyVersion,
      signingKey: Uint8Array.from(config.signingKey),
      policyPackageVersion: packageVersion,
      ...(config.decisionAuthorityId ? { decisionAuthorityId: config.decisionAuthorityId } : {}),
      applicationVersions: Object.freeze(applicationVersions),
      applicationCapabilities: Object.freeze(applicationCapabilities),
      applicationRuntimeCapabilities: Object.freeze(applicationRuntimeCapabilities),
      applicationManifests: Object.freeze(applicationManifests),
      deviceCertificateRequiredApplications: Object.freeze([...certificateRequired].sort()),
      consentRequiredCapabilities: Object.freeze([...config.consentRequiredCapabilities].sort()),
      onlineOnlyCapabilities: Object.freeze([...config.onlineOnlyCapabilities].sort()),
      writeActions: Object.freeze([...config.writeActions].sort())
    });
    const payload: PlatformPolicyPackagePayload = Object.freeze({
      schemaVersion: 1 as const,
      packageVersion,
      policyVersion: this.#config.policyVersion,
      ...(this.#config.decisionAuthorityId ? { decisionAuthorityId: this.#config.decisionAuthorityId } : {}),
      applicationVersions: this.#config.applicationVersions!,
      applicationCapabilities: this.#config.applicationCapabilities,
      applicationManifests: this.#config.applicationManifests,
      consentRequiredCapabilities: this.#config.consentRequiredCapabilities,
      onlineOnlyCapabilities: this.#config.onlineOnlyCapabilities,
      writeActions: this.#config.writeActions
    });
    this.#policyPackage = Object.freeze({
      payload,
      payloadSha256: sha256(payload),
      signatureAlgorithm: 'HMAC-SHA256' as const,
      signature: signPolicyPackage(this.#config.signingKey, payload)
    });
    if (!this.verifyPolicyPackage(this.#policyPackage)) throw new Error('signed policy package self-verification failed');
  }

  public get policyPackage(): PlatformPolicyPackage {
    return this.#policyPackage;
  }

  public applicationVersionFor(applicationId: PlatformApplicationId): string | undefined {
    return this.#policyPackage.payload.applicationVersions[applicationId];
  }

  public verifyPolicyPackage(policyPackage: PlatformPolicyPackage): boolean {
    try {
      if (
        policyPackage.signatureAlgorithm !== 'HMAC-SHA256'
        || policyPackage.payload.schemaVersion !== 1
        || policyPackage.payload.policyVersion !== this.#config.policyVersion
        || policyPackage.payload.packageVersion !== this.#config.policyPackageVersion
        || policyPackage.payloadSha256 !== sha256(policyPackage.payload)
        || stable(policyPackage.payload) !== stable({
          schemaVersion: 1,
          packageVersion: this.#config.policyPackageVersion,
          policyVersion: this.#config.policyVersion,
          ...(this.#config.decisionAuthorityId ? { decisionAuthorityId: this.#config.decisionAuthorityId } : {}),
          applicationVersions: this.#config.applicationVersions,
          applicationCapabilities: this.#config.applicationCapabilities,
          applicationManifests: this.#config.applicationManifests,
          consentRequiredCapabilities: this.#config.consentRequiredCapabilities,
          onlineOnlyCapabilities: this.#config.onlineOnlyCapabilities,
          writeActions: this.#config.writeActions
        })
        || !/^[0-9a-f]{64}$/u.test(policyPackage.signature)
      ) return false;
      const expected = Buffer.from(signPolicyPackage(this.#config.signingKey, policyPackage.payload), 'hex');
      const actual = Buffer.from(policyPackage.signature, 'hex');
      return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  public evaluate(request: PlatformPolicyRequest): PlatformPolicyDecision {
    let contextHash: string | undefined;
    const decisionApplicationVersion = request?.subject?.applicationId
      ? this.applicationVersionFor(request.subject.applicationId)
      : undefined;
    const decisionApplicationManifest = request?.subject?.applicationId
      ? this.#policyPackage.payload.applicationManifests[request.subject.applicationId]
      : undefined;
    const deny = (reason: PolicyReason, obligations: readonly PolicyObligation[] = []): PlatformPolicyDecision =>
      Object.freeze({
        allowed: false,
        reason,
        policyVersion: this.#config.policyVersion,
        policyPackageVersion: this.#policyPackage.payload.packageVersion,
        policyPackageSha256: this.#policyPackage.payloadSha256,
        ...(this.#config.decisionAuthorityId ? { decisionAuthorityId: this.#config.decisionAuthorityId } : {}),
        ...(decisionApplicationVersion === undefined ? {} : { applicationVersion: decisionApplicationVersion }),
        ...(decisionApplicationManifest === undefined ? {} : {
          capabilityManifestSha256: decisionApplicationManifest.capabilityManifestSha256
        }),
        ...(request?.subject?.deviceCertificate === undefined ? {} : {
          deviceCertificateSha256: request.subject.deviceCertificate.certificateSha256
        }),
        ...(contextHash ? { contextHash } : {}),
        obligations: freezeObligations(obligations)
      });

    const strictContext = request?.enforcementMode === 'strict';

    if (
      !request || typeof request !== 'object' ||
      !nonEmpty(request.policyVersion, 128) ||
      (request.policyPackageVersion !== undefined && (!Number.isSafeInteger(request.policyPackageVersion) || request.policyPackageVersion < 1)) ||
      (request.policyPackageSha256 !== undefined && !/^[0-9a-f]{64}$/u.test(request.policyPackageSha256)) ||
      (request.decisionAuthorityId !== undefined
        && request.decisionAuthorityId !== 'local-policy-kernel'
        && request.decisionAuthorityId !== 'windows-core-service') ||
      !nonEmpty(request.subject?.accountId) || !nonEmpty(request.subject?.deviceId) ||
      (request.subject.applicationVersion !== undefined && !nonEmpty(request.subject.applicationVersion, 128)) ||
      (request.subject.capabilityManifestSha256 !== undefined && !sha256Pattern.test(request.subject.capabilityManifestSha256)) ||
      (request.subject.personId !== undefined && !nonEmpty(request.subject.personId)) ||
      !nonEmpty(request.resource?.type) || !nonEmpty(request.resource?.id) || !nonEmpty(request.resource?.familyId) ||
      (request.resource.householdId !== undefined && !nonEmpty(request.resource.householdId)) ||
      (request.resource.familyBranchId !== undefined && !nonEmpty(request.resource.familyBranchId)) ||
      (request.resource.ownerPersonId !== undefined && !nonEmpty(request.resource.ownerPersonId)) ||
      (request.resource.dataClasses !== undefined && (
        !Array.isArray(request.resource.dataClasses)
        || request.resource.dataClasses.length < 1
        || request.resource.dataClasses.length > PLATFORM_DATA_CLASSES.length
        || request.resource.dataClasses.some((value) => !validDataClasses.has(value))
        || new Set(request.resource.dataClasses).size !== request.resource.dataClasses.length
        || stable(request.resource.dataClasses) !== stable(normalizePlatformDataClasses(request.resource.dataClasses))
      )) ||
      (request.resource.classificationSource !== undefined && !validClassificationSources.has(request.resource.classificationSource)) ||
      (strictContext && (
        !Array.isArray(request.resource.dataClasses)
        || !validClassificationSources.has(request.resource.classificationSource as PlatformDataClassificationSource)
      )) ||
      (request.resource.sourceResourceId !== undefined && !nonEmpty(request.resource.sourceResourceId)) ||
      !nonEmpty(request.occurredAt) || !Number.isFinite(parseTime(request.occurredAt)) ||
      typeof request.subject.deviceTrusted !== 'boolean' || typeof request.subject.membershipActive !== 'boolean' ||
      !validUniqueStrings(request.subject.roles, 1, 64, 128) ||
      !validUniqueStrings(request.subject.familyIds, 1, 10_000, 256) ||
      (request.subject.householdIds !== undefined && !validUniqueStrings(request.subject.householdIds, 0, 10_000, 256)) ||
      (request.subject.familyBranchIds !== undefined && !validUniqueStrings(request.subject.familyBranchIds, 0, 10_000, 256)) ||
      (strictContext && (!Array.isArray(request.subject.householdIds) || !Array.isArray(request.subject.familyBranchIds))) ||
      typeof request.online !== 'boolean' || typeof request.clusterWritable !== 'boolean' ||
      !validSensitivities.has(request.resource.sensitivity) || !validActions.has(request.action) ||
      (request.enforcementMode !== undefined && request.enforcementMode !== 'legacy' && request.enforcementMode !== 'strict') ||
      (request.purpose !== undefined && !nonEmpty(request.purpose, 256)) ||
      (request.minimumOwnershipBasisPoints !== undefined && (!Number.isInteger(request.minimumOwnershipBasisPoints) || request.minimumOwnershipBasisPoints < 1 || request.minimumOwnershipBasisPoints > 10_000)) ||
      (strictContext && (
        !nonEmpty(request.correlationId, 128) || !nonEmpty(request.purpose, 256)
        || !Number.isSafeInteger(request.policyPackageVersion) || request.policyPackageVersion! < 1
        || !/^[0-9a-f]{64}$/u.test(request.policyPackageSha256 ?? '')
        || !nonEmpty(request.subject.applicationVersion, 128)
      )) ||
      (request.requestedFields !== undefined && !validUniqueStrings(request.requestedFields, 0, 10_000, 256)) ||
      (request.grants !== undefined && (!Array.isArray(request.grants) || !request.grants.every(validGrant))) ||
      (request.consents !== undefined && (!Array.isArray(request.consents) || !request.consents.every(validConsent)))
    ) return deny('INVALID_REQUEST');
    contextHash = platformPolicyContextHash(request);
    if (request.policyVersion !== this.#config.policyVersion) return deny('POLICY_VERSION_MISMATCH');
    if (request.policyPackageVersion !== undefined && request.policyPackageVersion !== this.#policyPackage.payload.packageVersion) {
      return deny('POLICY_PACKAGE_VERSION_MISMATCH');
    }
    if (request.policyPackageSha256 !== undefined && request.policyPackageSha256 !== this.#policyPackage.payloadSha256) {
      return deny('POLICY_PACKAGE_HASH_MISMATCH');
    }
    if (
      this.#config.decisionAuthorityId !== undefined
      && (request.decisionAuthorityId === undefined || request.decisionAuthorityId !== this.#config.decisionAuthorityId)
    ) return deny('DECISION_AUTHORITY_MISMATCH');
    const capabilities = this.#config.applicationCapabilities[request.subject.applicationId];
    if (!capabilities) return deny('APPLICATION_NOT_REGISTERED');
    const applicationManifest = this.#policyPackage.payload.applicationManifests[request.subject.applicationId];
    if (!applicationManifest) return deny('APPLICATION_NOT_REGISTERED');
    if (
      request.subject.applicationVersion !== undefined
      && request.subject.applicationVersion !== this.applicationVersionFor(request.subject.applicationId)
    ) return deny('APPLICATION_VERSION_MISMATCH');
    if (
      request.subject.capabilityManifestSha256 !== undefined
      && request.subject.capabilityManifestSha256 !== applicationManifest.capabilityManifestSha256
    ) return deny('APPLICATION_MANIFEST_MISMATCH');
    if (strictContext && applicationManifest.deviceCertificateRequired) {
      if (request.subject.capabilityManifestSha256 !== applicationManifest.capabilityManifestSha256) {
        return deny('APPLICATION_MANIFEST_MISMATCH');
      }
      if (!request.subject.deviceCertificate || !verifyPlatformDeviceCertificate(request.subject.deviceCertificate, {
        deviceId: request.subject.deviceId,
        applicationId: request.subject.applicationId,
        capabilityManifestSha256: applicationManifest.capabilityManifestSha256,
        occurredAt: request.occurredAt
      })) return deny('DEVICE_CERTIFICATE_INVALID');
    }
    if (!capabilities.includes(request.capability)) return deny('CAPABILITY_NOT_DECLARED');
    if (!capabilityActions[request.capability]?.includes(request.action)) return deny('ACTION_CAPABILITY_MISMATCH');
    if (!(request.resource.dataClasses ?? []).every((dataClass) => dataClassCapabilityCompatible(dataClass, request.capability))) {
      return deny('DATA_CLASS_CAPABILITY_MISMATCH');
    }
    if (request.subject.deviceTrusted !== true) return deny('DEVICE_NOT_TRUSTED');
    if (request.subject.membershipActive !== true) return deny('MEMBERSHIP_INACTIVE');
    if (
      !request.subject.familyIds!.includes(request.resource.familyId) ||
      (request.resource.householdId && (!request.subject.householdIds || !request.subject.householdIds.includes(request.resource.householdId))) ||
      (request.resource.familyBranchId && (!request.subject.familyBranchIds || !request.subject.familyBranchIds.includes(request.resource.familyBranchId)))
    ) return deny('RESOURCE_SCOPE_DENIED');
    if ((strictContext || isSensitive(request.resource.sensitivity)) && !request.purpose?.trim()) return deny('PURPOSE_REQUIRED');
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
    if (explicitDeny) return Object.freeze({
      allowed: false,
      reason: 'EXPLICIT_DENY',
      policyVersion: this.#config.policyVersion,
      policyPackageVersion: this.#policyPackage.payload.packageVersion,
      policyPackageSha256: this.#policyPackage.payloadSha256,
      ...(this.#config.decisionAuthorityId ? { decisionAuthorityId: this.#config.decisionAuthorityId } : {}),
      applicationVersion: decisionApplicationVersion!,
      capabilityManifestSha256: decisionApplicationManifest!.capabilityManifestSha256,
      ...(request.subject.deviceCertificate ? { deviceCertificateSha256: request.subject.deviceCertificate.certificateSha256 } : {}),
      contextHash,
      matchedGrantId: explicitDeny.id,
      obligations: freezeObligations([])
    });

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
    const explicitAllow = activeGrants.find((grant) => grant.effect === 'allow' && (
      request.minimumOwnershipBasisPoints === undefined
      || (grant.ownershipBasisPoints !== undefined && grant.ownershipBasisPoints >= request.minimumOwnershipBasisPoints)
    ));
    const ownerOwnershipBasisPoints = owner ? 10_000 : undefined;
    if (request.minimumOwnershipBasisPoints !== undefined && !owner && !explicitAllow) {
      return deny('OWNERSHIP_SHARE_REQUIRED');
    }
    if (
      !owner && !explicitAllow &&
      (request.enforcementMode === 'strict' || (request.resource.sensitivity !== 'public' && request.resource.sensitivity !== 'internal'))
    ) return deny('OWNER_OR_GRANT_REQUIRED');

    const obligations: PolicyObligation[] = [];
    const addObligation = (obligation: PolicyObligation): void => {
      if (!obligations.some((current) => current.type === obligation.type)) obligations.push(obligation);
    };
    const dataClasses = request.resource.dataClasses ?? [];
    const nonOwnerRead = request.action === 'read' && !owner;
    const retentionClass = retentionPriority.find((value) => dataClasses.includes(value));
    if (isSensitive(request.resource.sensitivity) || dataClasses.some((value) => value !== 'general' && value !== 'personal')) {
      addObligation({ type: 'high_detail_audit' });
    }
    if (nonOwnerRead && dataClasses.some((value) => value !== 'general')) {
      addObligation({
        type: 'mask_fields',
        value: Object.freeze(request.requestedFields?.length
          ? [...request.requestedFields].sort()
          : ['*'])
      });
    }
    if (
      request.capability === 'archive.ocr'
      || request.capability === 'ai.process'
      || request.capability === 'translation.process'
      || hasObligationClass(dataClasses, obligationDataClassSets.localProcessingOnly)
    ) {
      addObligation({ type: 'local_processing_only' });
    }
    if (hasObligationClass(dataClasses, obligationDataClassSets.noCache)) addObligation({ type: 'no_cache' });
    if (dataClasses.includes('biometric')) {
      addObligation({ type: 'no_clipboard' });
    }
    if (hasObligationClass(dataClasses, obligationDataClassSets.noExport)) addObligation({ type: 'no_export' });
    if (!request.online) addObligation({ type: 'no_export' });
    if (hasObligationClass(dataClasses, obligationDataClassSets.noAi)) addObligation({ type: 'no_ai' });
    if (hasObligationClass(dataClasses, obligationDataClassSets.noRecording)) addObligation({ type: 'no_recording' });
    if (request.action === 'share') {
      addObligation({ type: 'watermark', value: `policy:${this.#config.policyVersion};correlation:${request.correlationId}` });
    }
    if (request.capability === 'communication.record') {
      addObligation({ type: 'delete_after', value: 'retention:consent-policy' });
    } else if (retentionClass) {
      addObligation({ type: 'delete_after', value: `retention:data-class:${retentionClass}` });
    }

    return Object.freeze({
      allowed: true,
      reason: 'ALLOW_POLICY',
      policyVersion: this.#config.policyVersion,
      policyPackageVersion: this.#policyPackage.payload.packageVersion,
      policyPackageSha256: this.#policyPackage.payloadSha256,
      ...(this.#config.decisionAuthorityId ? { decisionAuthorityId: this.#config.decisionAuthorityId } : {}),
      applicationVersion: decisionApplicationVersion!,
      capabilityManifestSha256: decisionApplicationManifest!.capabilityManifestSha256,
      ...(request.subject.deviceCertificate ? { deviceCertificateSha256: request.subject.deviceCertificate.certificateSha256 } : {}),
      contextHash,
      ...(explicitAllow ? { matchedGrantId: explicitAllow.id } : {}),
      ...(explicitAllow?.ownershipBasisPoints !== undefined
        ? { matchedOwnershipBasisPoints: explicitAllow.ownershipBasisPoints }
        : ownerOwnershipBasisPoints !== undefined && request.minimumOwnershipBasisPoints !== undefined
          ? { matchedOwnershipBasisPoints: ownerOwnershipBasisPoints }
          : {}),
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
      if (
        receipt.receiptVersion !== 1
        || receipt.decision.policyVersion !== this.#config.policyVersion
        || receipt.decision.policyPackageVersion !== this.#policyPackage.payload.packageVersion
        || receipt.decision.policyPackageSha256 !== this.#policyPackage.payloadSha256
      ) return false;
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
    if (receipt.decision.policyPackageVersion !== this.#policyPackage.payload.packageVersion) return false;
    if (receipt.decision.policyPackageSha256 !== this.#policyPackage.payloadSha256) return false;
    if (stable(receipt.decision) !== stable(this.evaluate(request))) return false;
    return this.verifyReceipt(receipt);
  }
}
