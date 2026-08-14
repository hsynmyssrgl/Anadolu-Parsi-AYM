import { createHash } from 'node:crypto';

import {
  normalizePlatformDataClasses,
  type DataSensitivity,
  type PlatformApplicationId,
  type PlatformCapability,
  type PlatformDataClass,
  type PolicyAction,
  type PolicyObligation,
  type PolicyObligationType
} from './policy-kernel.js';

export const DERIVED_DATA_KINDS = Object.freeze([
  'OCR_TEXT',
  'SEARCH_INDEX',
  'THUMBNAIL',
  'AI_MEMORY',
  'SUMMARY',
  'EMBEDDING',
  'TRANSLATION',
  'TRANSCRIPT',
  'CACHE',
  'REPLICA'
] as const);

/** PPK-016 is deliberately zero-exception: callers cannot persist a binding directly. */
export const DERIVED_DATA_DIRECT_ACCESS_EXCEPTIONS = Object.freeze([] as const);
export const DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS = Object.freeze([
  'packages/repositories/src/derived-data-policy-repository.ts'
] as const);
/** Exact read-only metadata inventory consumers; this grants no schema or mutation authority. */
export const DERIVED_DATA_AUTHORIZED_METADATA_INVENTORY_READERS = Object.freeze([
  'packages/repositories/src/data-lifecycle-repository.ts',
  'packages/repositories/src/privacy-ownership-data-rights-repository.ts'
] as const);

export const DERIVED_DATA_MAX_SOURCE_COUNT = 32 as const;
export const DERIVED_DATA_MAX_LINEAGE_DEPTH = 16 as const;
export const DERIVED_DATA_MAX_ANCESTOR_COUNT = 512 as const;

export type DerivedDataKind = (typeof DERIVED_DATA_KINDS)[number];

export interface DerivedDataResourceIdentity {
  readonly resourceType: string;
  readonly resourceId: string;
}

export interface DerivedDataSourcePolicySnapshot extends DerivedDataResourceIdentity {
  readonly schemaVersion: 1;
  readonly resourceVersion: string;
  readonly contentSha256: string;
  readonly familyId: string;
  readonly policyVersion: string;
  readonly policyPackageSha256: string;
  readonly receiptActive: boolean;
  readonly receiptHash: string;
  readonly contextHash: string;
  readonly requestHash: string;
  readonly sensitivity: DataSensitivity;
  readonly dataClasses: readonly PlatformDataClass[];
  readonly allowedAccountIds: readonly string[];
  readonly allowedApplicationIds: readonly PlatformApplicationId[];
  readonly allowedCapabilities: readonly PlatformCapability[];
  readonly allowedActions: readonly PolicyAction[];
  readonly allowedPurposes: readonly string[];
  readonly obligations: readonly PolicyObligation[];
  readonly retentionUntil: string | null;
  readonly lineageDepth: number;
  readonly ancestorResources: readonly DerivedDataResourceIdentity[];
}

export interface DerivedDataTargetPolicy extends DerivedDataResourceIdentity {
  readonly schemaVersion: 1;
  readonly kind: DerivedDataKind;
  readonly resourceVersion: string;
  readonly contentSha256: string;
  readonly familyId: string;
  readonly policyVersion: string;
  readonly policyPackageSha256: string;
  readonly sensitivity: DataSensitivity;
  readonly dataClasses: readonly PlatformDataClass[];
  readonly allowedAccountIds: readonly string[];
  readonly allowedApplicationIds: readonly PlatformApplicationId[];
  readonly allowedCapabilities: readonly PlatformCapability[];
  readonly allowedActions: readonly PolicyAction[];
  readonly allowedPurposes: readonly string[];
  readonly obligations: readonly PolicyObligation[];
  readonly retentionUntil: string | null;
}

export interface DerivedDataEffectivePolicy {
  readonly familyId: string;
  readonly policyVersion: string;
  readonly policyPackageSha256: string;
  readonly sensitivity: DataSensitivity;
  readonly dataClasses: readonly PlatformDataClass[];
  readonly allowedAccountIds: readonly string[];
  readonly allowedApplicationIds: readonly PlatformApplicationId[];
  readonly allowedCapabilities: readonly PlatformCapability[];
  readonly allowedActions: readonly PolicyAction[];
  readonly allowedPurposes: readonly string[];
  readonly obligations: readonly PolicyObligation[];
  readonly retentionUntil: string | null;
}

export interface DerivedDataPolicyBinding {
  readonly schemaVersion: 1;
  readonly target: DerivedDataTargetPolicy;
  readonly sources: readonly DerivedDataSourcePolicySnapshot[];
  readonly effectivePolicy: DerivedDataEffectivePolicy;
  readonly lineageDepth: number;
  readonly ancestorResources: readonly DerivedDataResourceIdentity[];
  readonly sourceSetHash: string;
  readonly bindingHash: string;
}

/** Compatibility name used by the durable repository contract. */
export type DerivedDataInheritanceBinding = DerivedDataPolicyBinding;

export type DerivedDataInheritanceDenialReason =
  | 'ALLOW_INHERITANCE'
  | 'MALFORMED_INPUT'
  | 'TARGET_MALFORMED'
  | 'SOURCE_COUNT_INVALID'
  | 'SOURCE_MALFORMED'
  | 'SOURCE_RECEIPT_INACTIVE'
  | 'DUPLICATE_SOURCE'
  | 'SELF_REFERENCE'
  | 'CYCLIC_LINEAGE'
  | 'LINEAGE_DEPTH_EXCEEDED'
  | 'ANCESTOR_COUNT_EXCEEDED'
  | 'FAMILY_MISMATCH'
  | 'POLICY_VERSION_MISMATCH'
  | 'POLICY_PACKAGE_HASH_MISMATCH'
  | 'SOURCE_ACCESS_INTERSECTION_EMPTY'
  | 'SENSITIVITY_DOWNGRADE'
  | 'DATA_CLASS_DOWNGRADE'
  | 'ACCOUNT_ACCESS_BROADENED'
  | 'APPLICATION_ACCESS_BROADENED'
  | 'CAPABILITY_ACCESS_BROADENED'
  | 'ACTION_ACCESS_BROADENED'
  | 'PURPOSE_ACCESS_BROADENED'
  | 'OBLIGATION_DOWNGRADE'
  | 'RETENTION_BROADENED'
  | 'BINDING_MALFORMED'
  | 'SOURCE_SET_HASH_MISMATCH'
  | 'BINDING_HASH_MISMATCH';

export type DerivedDataInheritanceDecision =
  | Readonly<{
      readonly allowed: true;
      readonly reason: 'ALLOW_INHERITANCE';
      readonly binding: DerivedDataPolicyBinding;
      readonly operationAllowed: true;
      readonly persistenceAllowed: true;
    }>
  | Readonly<{
      readonly allowed: false;
      readonly reason: Exclude<DerivedDataInheritanceDenialReason, 'ALLOW_INHERITANCE'>;
      readonly operationAllowed: false;
      readonly persistenceAllowed: false;
    }>;

export interface DerivedDataInheritanceBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly supportedKinds: typeof DERIVED_DATA_KINDS;
  readonly maximumSourceCount: 32;
  readonly maximumLineageDepth: 16;
  readonly maximumAncestorCount: 512;
  readonly sourcePolicyIntersectionRequired: true;
  readonly sensitivityDowngradeAllowed: false;
  readonly accessBroadeningAllowed: false;
  readonly authorizedRepositoryAdapterCount: 1;
  readonly directAccessExceptionCount: 0;
  readonly payloadExposed: false;
  readonly persistentPathExposed: false;
  readonly secretMaterialExposed: false;
  readonly cutoverAuthorityAttached: false;
}

export interface EvaluateDerivedDataInheritanceInput {
  readonly target: DerivedDataTargetPolicy;
  readonly sources: readonly DerivedDataSourcePolicySnapshot[];
}

const APPLICATION_IDS = new Set<PlatformApplicationId>([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service',
  'backup-worker', 'signed-plugin'
]);
const CAPABILITIES = new Set<PlatformCapability>([
  'family.read', 'family.write', 'health.read', 'health.write', 'finance.read', 'finance.write',
  'location.read', 'location.share', 'archive.read', 'archive.write', 'archive.ocr', 'ai.process',
  'translation.process', 'communication.message', 'communication.call', 'communication.record',
  'file.share', 'backup.create', 'backup.restore', 'cluster.admin', 'plugin.execute'
]);
const ACTIONS = new Set<PolicyAction>([
  'read', 'create', 'update', 'delete', 'share', 'process', 'record', 'administer'
]);
const DATA_CLASSES = new Set<PlatformDataClass>([
  'general', 'personal', 'special', 'health', 'finance', 'child',
  'location', 'communication', 'biometric', 'legacy'
]);
const OBLIGATION_TYPES = new Set<PolicyObligationType>([
  'mask_fields', 'local_processing_only', 'no_cache', 'no_clipboard', 'no_export', 'no_ai',
  'no_recording', 'watermark', 'delete_after', 'strong_reauthentication', 'online_only',
  'high_detail_audit'
]);
const VALUED_OBLIGATIONS = new Set<PolicyObligationType>(['mask_fields', 'watermark', 'delete_after']);
const SENSITIVITY_ORDER: Readonly<Record<DataSensitivity, number>> = Object.freeze({
  public: 0,
  internal: 1,
  personal: 2,
  sensitive: 3,
  highly_sensitive: 4
});
const SENSITIVITIES = new Set<DataSensitivity>(Object.keys(SENSITIVITY_ORDER) as DataSensitivity[]);
const TARGET_KEYS = Object.freeze([
  'schemaVersion', 'kind', 'resourceType', 'resourceId', 'resourceVersion', 'contentSha256',
  'familyId', 'policyVersion', 'policyPackageSha256', 'sensitivity', 'dataClasses',
  'allowedAccountIds', 'allowedApplicationIds', 'allowedCapabilities', 'allowedActions',
  'allowedPurposes', 'obligations', 'retentionUntil'
] as const);
const SOURCE_KEYS = Object.freeze([
  'schemaVersion', 'resourceType', 'resourceId', 'resourceVersion', 'contentSha256',
  'familyId', 'policyVersion', 'policyPackageSha256', 'receiptActive', 'receiptHash',
  'contextHash', 'requestHash', 'sensitivity', 'dataClasses', 'allowedAccountIds',
  'allowedApplicationIds', 'allowedCapabilities', 'allowedActions', 'allowedPurposes',
  'obligations', 'retentionUntil', 'lineageDepth', 'ancestorResources'
] as const);
const BINDING_KEYS = Object.freeze([
  'schemaVersion', 'target', 'sources', 'effectivePolicy', 'lineageDepth',
  'ancestorResources', 'sourceSetHash', 'bindingHash'
] as const);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const nonEmpty = (value: unknown, maximum = 256): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= maximum;
const sha256 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const strictIso = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};
const compareCanonicalText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => compareCanonicalText(left, right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
    .join(',')}}`;
};
const digest = (value: unknown): string => createHash('sha256').update(stable(value), 'utf8').digest('hex');
const identityKey = (value: DerivedDataResourceIdentity): string =>
  `${value.resourceType.length}:${value.resourceType}${value.resourceId.length}:${value.resourceId}`;
const identityCompare = (left: DerivedDataResourceIdentity, right: DerivedDataResourceIdentity): number =>
  compareCanonicalText(identityKey(left), identityKey(right));
const validIdentity = (value: unknown): value is DerivedDataResourceIdentity =>
  isPlainRecord(value) && exactKeys(value, ['resourceType', 'resourceId'])
    && nonEmpty(value.resourceType, 128) && nonEmpty(value.resourceId, 256);
const uniqueStrings = <T extends string>(
  value: unknown,
  allowed: ReadonlySet<T> | undefined,
  maximum = 64
): value is readonly T[] => Array.isArray(value)
  && value.length >= 1 && value.length <= maximum
  && value.every((item) => nonEmpty(item, 256) && (!allowed || allowed.has(item as T)))
  && new Set(value).size === value.length;
const validDataClasses = (value: unknown): value is readonly PlatformDataClass[] =>
  uniqueStrings(value, DATA_CLASSES, 10);
const validObligation = (value: unknown): value is PolicyObligation => {
  if (!isPlainRecord(value) || !nonEmpty(value.type, 64) || !OBLIGATION_TYPES.has(value.type as PolicyObligationType)) return false;
  const type = value.type as PolicyObligationType;
  if (!VALUED_OBLIGATIONS.has(type)) return exactKeys(value, ['type']);
  if (!exactKeys(value, ['type', 'value'])) return false;
  if (type === 'mask_fields') return Array.isArray(value.value)
    && value.value.length >= 1 && value.value.length <= 128
    && value.value.every((item) => nonEmpty(item, 256))
    && new Set(value.value).size === value.value.length;
  return nonEmpty(value.value, 512);
};
const validObligations = (value: unknown): value is readonly PolicyObligation[] => Array.isArray(value)
  && value.length <= 64 && value.every(validObligation)
  && new Set(value.map((item) => stable(item))).size === value.length;
const validRetention = (value: unknown): value is string | null => value === null || strictIso(value);
const validCommonPolicyFields = (value: Record<string, unknown>): boolean =>
  nonEmpty(value.resourceType, 128)
  && nonEmpty(value.resourceId, 256)
  && nonEmpty(value.resourceVersion, 128)
  && sha256(value.contentSha256)
  && nonEmpty(value.familyId, 256)
  && nonEmpty(value.policyVersion, 128)
  && sha256(value.policyPackageSha256)
  && SENSITIVITIES.has(value.sensitivity as DataSensitivity)
  && validDataClasses(value.dataClasses)
  && uniqueStrings(value.allowedAccountIds, undefined)
  && uniqueStrings(value.allowedApplicationIds, APPLICATION_IDS)
  && uniqueStrings(value.allowedCapabilities, CAPABILITIES)
  && uniqueStrings(value.allowedActions, ACTIONS)
  && uniqueStrings(value.allowedPurposes, undefined)
  && validObligations(value.obligations)
  && validRetention(value.retentionUntil);
const validTarget = (value: unknown): value is DerivedDataTargetPolicy => isPlainRecord(value)
  && exactKeys(value, TARGET_KEYS)
  && value.schemaVersion === 1
  && DERIVED_DATA_KINDS.includes(value.kind as DerivedDataKind)
  && validCommonPolicyFields(value);
const validSource = (value: unknown): value is DerivedDataSourcePolicySnapshot => {
  if (!isPlainRecord(value) || !exactKeys(value, SOURCE_KEYS) || value.schemaVersion !== 1
    || !validCommonPolicyFields(value) || typeof value.receiptActive !== 'boolean'
    || !sha256(value.receiptHash) || !sha256(value.contextHash) || !sha256(value.requestHash)
    || !Number.isInteger(value.lineageDepth) || Number(value.lineageDepth) < 0
    || Number(value.lineageDepth) > DERIVED_DATA_MAX_LINEAGE_DEPTH
    || !Array.isArray(value.ancestorResources)
    || value.ancestorResources.length > DERIVED_DATA_MAX_ANCESTOR_COUNT
    || !value.ancestorResources.every(validIdentity)) return false;
  const source = value as unknown as DerivedDataSourcePolicySnapshot;
  const keys = source.ancestorResources.map(identityKey);
  return new Set(keys).size === keys.length
    && !keys.includes(identityKey(source))
    && (source.lineageDepth === 0 ? keys.length === 0 : keys.length >= source.lineageDepth);
};

const canonicalStrings = <T extends string>(values: readonly T[]): readonly T[] =>
  Object.freeze([...values].sort(compareCanonicalText));
const canonicalIdentity = (value: DerivedDataResourceIdentity): DerivedDataResourceIdentity => Object.freeze({
  resourceType: value.resourceType,
  resourceId: value.resourceId
});
const canonicalIdentities = (values: readonly DerivedDataResourceIdentity[]): readonly DerivedDataResourceIdentity[] =>
  Object.freeze([...values].sort(identityCompare).map(canonicalIdentity));
const canonicalObligation = (value: PolicyObligation): PolicyObligation => Object.freeze({
  type: value.type,
  ...(Array.isArray(value.value)
    ? { value: Object.freeze([...value.value].sort(compareCanonicalText)) }
    : value.value === undefined ? {} : { value: value.value })
});
const canonicalObligations = (values: readonly PolicyObligation[]): readonly PolicyObligation[] =>
  Object.freeze([...values].map(canonicalObligation).sort((left, right) => compareCanonicalText(stable(left), stable(right))));
const canonicalTarget = (value: DerivedDataTargetPolicy): DerivedDataTargetPolicy => Object.freeze({
  schemaVersion: 1,
  kind: value.kind,
  resourceType: value.resourceType,
  resourceId: value.resourceId,
  resourceVersion: value.resourceVersion,
  contentSha256: value.contentSha256,
  familyId: value.familyId,
  policyVersion: value.policyVersion,
  policyPackageSha256: value.policyPackageSha256,
  sensitivity: value.sensitivity,
  dataClasses: normalizePlatformDataClasses(value.dataClasses),
  allowedAccountIds: canonicalStrings(value.allowedAccountIds),
  allowedApplicationIds: canonicalStrings(value.allowedApplicationIds),
  allowedCapabilities: canonicalStrings(value.allowedCapabilities),
  allowedActions: canonicalStrings(value.allowedActions),
  allowedPurposes: canonicalStrings(value.allowedPurposes),
  obligations: canonicalObligations(value.obligations),
  retentionUntil: value.retentionUntil
});
const canonicalSource = (value: DerivedDataSourcePolicySnapshot): DerivedDataSourcePolicySnapshot => Object.freeze({
  schemaVersion: 1,
  resourceType: value.resourceType,
  resourceId: value.resourceId,
  resourceVersion: value.resourceVersion,
  contentSha256: value.contentSha256,
  familyId: value.familyId,
  policyVersion: value.policyVersion,
  policyPackageSha256: value.policyPackageSha256,
  receiptActive: value.receiptActive,
  receiptHash: value.receiptHash,
  contextHash: value.contextHash,
  requestHash: value.requestHash,
  sensitivity: value.sensitivity,
  dataClasses: normalizePlatformDataClasses(value.dataClasses),
  allowedAccountIds: canonicalStrings(value.allowedAccountIds),
  allowedApplicationIds: canonicalStrings(value.allowedApplicationIds),
  allowedCapabilities: canonicalStrings(value.allowedCapabilities),
  allowedActions: canonicalStrings(value.allowedActions),
  allowedPurposes: canonicalStrings(value.allowedPurposes),
  obligations: canonicalObligations(value.obligations),
  retentionUntil: value.retentionUntil,
  lineageDepth: value.lineageDepth,
  ancestorResources: canonicalIdentities(value.ancestorResources)
});
const canonicalSources = (values: readonly DerivedDataSourcePolicySnapshot[]): readonly DerivedDataSourcePolicySnapshot[] =>
  Object.freeze([...values].map(canonicalSource).sort((left, right) => {
    const identity = identityCompare(left, right);
    return identity || compareCanonicalText(left.resourceVersion, right.resourceVersion);
  }));

const intersection = <T extends string>(sets: readonly (readonly T[])[]): readonly T[] => {
  const remainder = new Set<T>(sets[0] ?? []);
  for (const values of sets.slice(1)) {
    const current = new Set(values);
    for (const value of remainder) if (!current.has(value)) remainder.delete(value);
  }
  return canonicalStrings([...remainder]);
};
const unionDataClasses = (sources: readonly DerivedDataSourcePolicySnapshot[]): readonly PlatformDataClass[] =>
  normalizePlatformDataClasses([...new Set(sources.flatMap((source) => source.dataClasses))]);
const unionObligations = (sources: readonly DerivedDataSourcePolicySnapshot[]): readonly PolicyObligation[] => {
  const byFingerprint = new Map<string, PolicyObligation>();
  for (const obligation of sources.flatMap((source) => source.obligations)) {
    const canonical = canonicalObligation(obligation);
    byFingerprint.set(stable(canonical), canonical);
  }
  return Object.freeze([...byFingerprint.entries()]
    .sort(([left], [right]) => compareCanonicalText(left, right))
    .map(([, obligation]) => obligation));
};
const earliestRetention = (sources: readonly DerivedDataSourcePolicySnapshot[]): string | null => {
  const finite = sources.map((source) => source.retentionUntil).filter((value): value is string => value !== null);
  return finite.length ? [...finite].sort()[0]! : null;
};
const subset = <T extends string>(candidate: readonly T[], authority: readonly T[]): boolean => {
  const allowed = new Set<T>(authority);
  return candidate.every((value) => allowed.has(value));
};
const includesEveryDataClass = (candidate: readonly PlatformDataClass[], required: readonly PlatformDataClass[]): boolean => {
  const actual = new Set(candidate);
  return required.every((value) => actual.has(value));
};
const includesEveryObligation = (candidate: readonly PolicyObligation[], required: readonly PolicyObligation[]): boolean => {
  const actual = new Set(candidate.map((value) => stable(canonicalObligation(value))));
  return required.every((value) => actual.has(stable(value)));
};
const retentionNoBroader = (candidate: string | null, authority: string | null): boolean =>
  authority === null || (candidate !== null && Date.parse(candidate) <= Date.parse(authority));

const deny = (
  reason: Exclude<DerivedDataInheritanceDenialReason, 'ALLOW_INHERITANCE'>
): DerivedDataInheritanceDecision => Object.freeze({
  allowed: false,
  reason,
  operationAllowed: false,
  persistenceAllowed: false
});
const allow = (binding: DerivedDataPolicyBinding): DerivedDataInheritanceDecision => Object.freeze({
  allowed: true,
  reason: 'ALLOW_INHERITANCE',
  binding,
  operationAllowed: true,
  persistenceAllowed: true
});

const validBindingShape = (value: unknown): value is DerivedDataPolicyBinding => isPlainRecord(value)
  && exactKeys(value, BINDING_KEYS)
  && value.schemaVersion === 1
  && validTarget(value.target)
  && Array.isArray(value.sources) && value.sources.every(validSource)
  && isPlainRecord(value.effectivePolicy)
  && Number.isInteger(value.lineageDepth)
  && Array.isArray(value.ancestorResources) && value.ancestorResources.every(validIdentity)
  && sha256(value.sourceSetHash) && sha256(value.bindingHash);

/**
 * Computes and verifies a durable PPK-016 binding without touching payloads,
 * repositories, files, network primitives or process cutover state.
 */
export class DerivedDataInheritancePolicy {
  public evaluate(input: unknown): DerivedDataInheritanceDecision {
    if (!isPlainRecord(input) || !exactKeys(input, ['target', 'sources'])) return deny('MALFORMED_INPUT');
    if (!validTarget(input.target)) return deny('TARGET_MALFORMED');
    if (!Array.isArray(input.sources) || input.sources.length < 1
      || input.sources.length > DERIVED_DATA_MAX_SOURCE_COUNT) return deny('SOURCE_COUNT_INVALID');
    if (!input.sources.every(validSource)) return deny('SOURCE_MALFORMED');

    const target = canonicalTarget(input.target);
    const sources = canonicalSources(input.sources as readonly DerivedDataSourcePolicySnapshot[]);
    if (sources.some((source) => !source.receiptActive)) return deny('SOURCE_RECEIPT_INACTIVE');

    const sourceKeys = sources.map(identityKey);
    if (new Set(sourceKeys).size !== sourceKeys.length) return deny('DUPLICATE_SOURCE');
    const targetKey = identityKey(target);
    if (sourceKeys.includes(targetKey)) return deny('SELF_REFERENCE');
    if (sources.some((source) => source.ancestorResources.some((ancestor) => identityKey(ancestor) === targetKey))) {
      return deny('CYCLIC_LINEAGE');
    }
    const lineageDepth = Math.max(...sources.map((source) => source.lineageDepth)) + 1;
    if (lineageDepth > DERIVED_DATA_MAX_LINEAGE_DEPTH) return deny('LINEAGE_DEPTH_EXCEEDED');

    if (sources.some((source) => source.familyId !== target.familyId)) return deny('FAMILY_MISMATCH');
    if (sources.some((source) => source.policyVersion !== target.policyVersion)) return deny('POLICY_VERSION_MISMATCH');
    if (sources.some((source) => source.policyPackageSha256 !== target.policyPackageSha256)) {
      return deny('POLICY_PACKAGE_HASH_MISMATCH');
    }

    const effectivePolicy: DerivedDataEffectivePolicy = Object.freeze({
      familyId: target.familyId,
      policyVersion: target.policyVersion,
      policyPackageSha256: target.policyPackageSha256,
      sensitivity: sources.reduce<DataSensitivity>((highest, source) =>
        SENSITIVITY_ORDER[source.sensitivity] > SENSITIVITY_ORDER[highest] ? source.sensitivity : highest,
      sources[0]!.sensitivity),
      dataClasses: unionDataClasses(sources),
      allowedAccountIds: intersection(sources.map((source) => source.allowedAccountIds)),
      allowedApplicationIds: intersection(sources.map((source) => source.allowedApplicationIds)),
      allowedCapabilities: intersection(sources.map((source) => source.allowedCapabilities)),
      allowedActions: intersection(sources.map((source) => source.allowedActions)),
      allowedPurposes: intersection(sources.map((source) => source.allowedPurposes)),
      obligations: unionObligations(sources),
      retentionUntil: earliestRetention(sources)
    });
    if (!effectivePolicy.allowedAccountIds.length || !effectivePolicy.allowedApplicationIds.length
      || !effectivePolicy.allowedCapabilities.length || !effectivePolicy.allowedActions.length
      || !effectivePolicy.allowedPurposes.length) return deny('SOURCE_ACCESS_INTERSECTION_EMPTY');

    if (SENSITIVITY_ORDER[target.sensitivity] < SENSITIVITY_ORDER[effectivePolicy.sensitivity]) {
      return deny('SENSITIVITY_DOWNGRADE');
    }
    if (!includesEveryDataClass(target.dataClasses, effectivePolicy.dataClasses)) return deny('DATA_CLASS_DOWNGRADE');
    if (!subset(target.allowedAccountIds, effectivePolicy.allowedAccountIds)) return deny('ACCOUNT_ACCESS_BROADENED');
    if (!subset(target.allowedApplicationIds, effectivePolicy.allowedApplicationIds)) return deny('APPLICATION_ACCESS_BROADENED');
    if (!subset(target.allowedCapabilities, effectivePolicy.allowedCapabilities)) return deny('CAPABILITY_ACCESS_BROADENED');
    if (!subset(target.allowedActions, effectivePolicy.allowedActions)) return deny('ACTION_ACCESS_BROADENED');
    if (!subset(target.allowedPurposes, effectivePolicy.allowedPurposes)) return deny('PURPOSE_ACCESS_BROADENED');
    if (!includesEveryObligation(target.obligations, effectivePolicy.obligations)) return deny('OBLIGATION_DOWNGRADE');
    if (!retentionNoBroader(target.retentionUntil, effectivePolicy.retentionUntil)) return deny('RETENTION_BROADENED');

    const ancestorByKey = new Map<string, DerivedDataResourceIdentity>();
    for (const source of sources) {
      ancestorByKey.set(identityKey(source), canonicalIdentity(source));
      for (const ancestor of source.ancestorResources) ancestorByKey.set(identityKey(ancestor), canonicalIdentity(ancestor));
    }
    if (ancestorByKey.size > DERIVED_DATA_MAX_ANCESTOR_COUNT) return deny('ANCESTOR_COUNT_EXCEEDED');
    const ancestorResources = canonicalIdentities([...ancestorByKey.values()]);
    const sourceSetHash = digest(Object.freeze({ schemaVersion: 1, sources }));
    const bindingPayload = Object.freeze({
      schemaVersion: 1 as const,
      target,
      sources,
      effectivePolicy,
      lineageDepth,
      ancestorResources,
      sourceSetHash
    });
    const binding: DerivedDataPolicyBinding = Object.freeze({
      ...bindingPayload,
      bindingHash: digest(bindingPayload)
    });
    return allow(binding);
  }

  public verify(value: unknown): DerivedDataInheritanceDecision {
    if (!validBindingShape(value)) return deny('BINDING_MALFORMED');
    const evaluated = this.evaluate({ target: value.target, sources: value.sources });
    if (!evaluated.allowed) return evaluated;
    if (value.sourceSetHash !== evaluated.binding.sourceSetHash) return deny('SOURCE_SET_HASH_MISMATCH');
    if (value.bindingHash !== evaluated.binding.bindingHash) return deny('BINDING_HASH_MISMATCH');
    return stable(value) === stable(evaluated.binding) ? evaluated : deny('BINDING_MALFORMED');
  }

  public snapshot(): DerivedDataInheritanceBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      supportedKinds: DERIVED_DATA_KINDS,
      maximumSourceCount: DERIVED_DATA_MAX_SOURCE_COUNT,
      maximumLineageDepth: DERIVED_DATA_MAX_LINEAGE_DEPTH,
      maximumAncestorCount: DERIVED_DATA_MAX_ANCESTOR_COUNT,
      sourcePolicyIntersectionRequired: true,
      sensitivityDowngradeAllowed: false,
      accessBroadeningAllowed: false,
      authorizedRepositoryAdapterCount: DERIVED_DATA_AUTHORIZED_REPOSITORY_ADAPTERS.length,
      directAccessExceptionCount: DERIVED_DATA_DIRECT_ACCESS_EXCEPTIONS.length,
      payloadExposed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      cutoverAuthorityAttached: false
    });
  }
}
