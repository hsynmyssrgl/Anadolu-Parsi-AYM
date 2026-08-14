import { createHash } from 'node:crypto';

export const SOURCE_DELETION_PROPAGATION_POLICY_VERSION = 'PPK-019-V1' as const;

export const SOURCE_DELETION_PROPAGATION_OWNER_KINDS = Object.freeze([
  'OCR_TEXT',
  'SEARCH_INDEX',
  'THUMBNAIL',
  'AI_MEMORY',
  'CACHE',
  'REPLICA',
  'BACKUP'
] as const);

export const SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES = Object.freeze([
  'family-import-preview',
  'ipc-main-read',
  'offline-sensitive'
] as const);

export const SOURCE_DELETION_DIRECT_BYPASS_EXCEPTIONS = Object.freeze([] as const);
export const SOURCE_DELETION_AUTHORIZED_REPOSITORY_ADAPTERS = Object.freeze([
  'packages/repositories/src/data-lifecycle-repository.ts',
  'packages/repositories/src/backup-propagation-repository.ts',
  'packages/repositories/src/local-governed-ocr-repository.ts'
] as const);
/** Active governed semantic owners with an exact PPK-019 tombstone/purge path. */
export const SOURCE_DELETION_REGISTERED_SEMANTIC_OWNERS = Object.freeze([
  'governed_ai_memory_records',
  'local_ocr_result'
] as const);
/** Content-free current metadata that binds a sealed local result to its archive source and current tombstone state. */
export const SOURCE_DELETION_CURRENT_METADATA_OWNERS = Object.freeze([
  'local_governed_ocr_jobs'
] as const);
/** Content-free append-only mutation metadata; never a semantic derived-payload owner. */
export const SOURCE_DELETION_METADATA_ONLY_MUTATION_LEDGERS = Object.freeze([
  'governed_ai_memory_mutations',
  'local_governed_ocr_mutations',
  'local_governed_ocr_source_deletion_items'
] as const);
/** Content-free control metadata; these tables never own source or derived semantic payload bytes. */
export const SOURCE_DELETION_CONTENT_FREE_METADATA_TABLES = Object.freeze([
  'local_governed_ocr_settings',
  'local_governed_ocr_source_deletion_recovery_intents'
] as const);

export type SourceDeletionPropagationOwnerKind = (typeof SOURCE_DELETION_PROPAGATION_OWNER_KINDS)[number];
export type SourceDeletionCacheRegistryId = (typeof SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES)[number];

export interface SourceDeletionIdentity {
  readonly familyId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly purgedAt: string;
}
export interface SourceDeletionCacheInvalidation {
  readonly registryId: SourceDeletionCacheRegistryId;
  readonly invalidatedEntryCount: number;
  readonly invalidatedAt: string;
}

export interface SourceDeletionPersistentOwnerInspection {
  readonly schemaVersion: 1;
  readonly inspectedAt: string;
  readonly unregisteredPersistentOwners: readonly string[];
  readonly plaintextReplicaEnabled: boolean;
  readonly derivedPolicyMetadataOnly: boolean;
}

export type SourceDeletionOwnerDisposition =
  | 'VERIFIED_ABSENT'
  | 'VOLATILE_INVALIDATED'
  | 'PLAINTEXT_REPLICA_RETIRED'
  | 'VERIFIED_REWRITE_PENDING';

export interface SourceDeletionOwnerOutcome {
  readonly kind: SourceDeletionPropagationOwnerKind;
  readonly disposition: SourceDeletionOwnerDisposition;
  readonly phase: 'local' | 'asynchronous_backup';
  readonly completed: boolean;
  readonly evidenceSha256: string;
}

export interface SourceDeletionPropagationPlan {
  readonly schemaVersion: 1;
  readonly policyVersion: typeof SOURCE_DELETION_PROPAGATION_POLICY_VERSION;
  readonly operation: 'RETENTION_PURGE';
  readonly source: SourceDeletionIdentity;
  readonly persistentInspection: SourceDeletionPersistentOwnerInspection;
  readonly cacheInvalidations: readonly SourceDeletionCacheInvalidation[];
  readonly ownerOutcomes: readonly SourceDeletionOwnerOutcome[];
  readonly localPropagationComplete: true;
  readonly backupPropagationPending: true;
  readonly planHash: string;
}

export type SourceDeletionPropagationRejectionReason =
  | 'INVALID_SOURCE_IDENTITY'
  | 'INVALID_PURGE_TIME'
  | 'INSPECTION_TIME_MISMATCH'
  | 'UNREGISTERED_PERSISTENT_OWNER'
  | 'PLAINTEXT_REPLICA_ACTIVE'
  | 'DERIVED_POLICY_METADATA_CLASSIFICATION_INVALID'
  | 'CACHE_REGISTRY_SET_MISMATCH'
  | 'CACHE_INVALIDATION_INVALID'
  | 'PLAN_HASH_MISMATCH'
  | 'PLAN_STRUCTURE_MISMATCH';

export type SourceDeletionPropagationDecision =
  | { readonly allowed: true; readonly plan: SourceDeletionPropagationPlan }
  | { readonly allowed: false; readonly reason: SourceDeletionPropagationRejectionReason };

const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_IDENTITY = /^[^\u0000-\u001f\u007f]{1,256}$/u;

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('SOURCE_DELETION_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (!value || typeof value !== 'object') throw new TypeError('SOURCE_DELETION_UNSUPPORTED_VALUE');
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
};

const sha256 = (value: unknown): string => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');

const validIdentity = (value: string): boolean => SAFE_IDENTITY.test(value) && value.trim() === value;
const validTime = (value: string): boolean => Number.isFinite(Date.parse(value));

const fixedEvidence = (kind: SourceDeletionPropagationOwnerKind, disposition: SourceDeletionOwnerDisposition): string =>
  sha256({ schemaVersion: 1, policyVersion: SOURCE_DELETION_PROPAGATION_POLICY_VERSION, kind, disposition });

export class SourceDeletionPropagationPolicy {
  public evaluate(input: {
    readonly source: SourceDeletionIdentity;
    readonly persistentInspection: SourceDeletionPersistentOwnerInspection;
    readonly cacheInvalidations: readonly SourceDeletionCacheInvalidation[];
  }): SourceDeletionPropagationDecision {
    const { source, persistentInspection } = input;
    if (![source.familyId, source.resourceType, source.resourceId].every(validIdentity)) {
      return Object.freeze({ allowed: false, reason: 'INVALID_SOURCE_IDENTITY' });
    }
    if (!validTime(source.purgedAt)) return Object.freeze({ allowed: false, reason: 'INVALID_PURGE_TIME' });
    if (!validTime(persistentInspection.inspectedAt) || persistentInspection.inspectedAt !== source.purgedAt) {
      return Object.freeze({ allowed: false, reason: 'INSPECTION_TIME_MISMATCH' });
    }
    if (persistentInspection.unregisteredPersistentOwners.length > 0) {
      return Object.freeze({ allowed: false, reason: 'UNREGISTERED_PERSISTENT_OWNER' });
    }
    if (persistentInspection.plaintextReplicaEnabled) {
      return Object.freeze({ allowed: false, reason: 'PLAINTEXT_REPLICA_ACTIVE' });
    }
    if (!persistentInspection.derivedPolicyMetadataOnly) {
      return Object.freeze({ allowed: false, reason: 'DERIVED_POLICY_METADATA_CLASSIFICATION_INVALID' });
    }

    const cacheInvalidations = [...input.cacheInvalidations].sort((left, right) => left.registryId.localeCompare(right.registryId));
    const expectedRegistries = [...SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES].sort();
    if (
      cacheInvalidations.length !== expectedRegistries.length
      || new Set(cacheInvalidations.map((entry) => entry.registryId)).size !== expectedRegistries.length
      || cacheInvalidations.some((entry, index) => entry.registryId !== expectedRegistries[index])
    ) return Object.freeze({ allowed: false, reason: 'CACHE_REGISTRY_SET_MISMATCH' });
    if (cacheInvalidations.some((entry) => (
      !Number.isSafeInteger(entry.invalidatedEntryCount)
      || entry.invalidatedEntryCount < 0
      || entry.invalidatedAt !== source.purgedAt
    ))) return Object.freeze({ allowed: false, reason: 'CACHE_INVALIDATION_INVALID' });

    const cacheEvidence = sha256(cacheInvalidations);
    const ownerOutcomes: readonly SourceDeletionOwnerOutcome[] = Object.freeze([
      Object.freeze({ kind: 'OCR_TEXT', disposition: 'VERIFIED_ABSENT', phase: 'local', completed: true, evidenceSha256: fixedEvidence('OCR_TEXT', 'VERIFIED_ABSENT') }),
      Object.freeze({ kind: 'SEARCH_INDEX', disposition: 'VERIFIED_ABSENT', phase: 'local', completed: true, evidenceSha256: fixedEvidence('SEARCH_INDEX', 'VERIFIED_ABSENT') }),
      Object.freeze({ kind: 'THUMBNAIL', disposition: 'VERIFIED_ABSENT', phase: 'local', completed: true, evidenceSha256: fixedEvidence('THUMBNAIL', 'VERIFIED_ABSENT') }),
      Object.freeze({ kind: 'AI_MEMORY', disposition: 'VERIFIED_ABSENT', phase: 'local', completed: true, evidenceSha256: fixedEvidence('AI_MEMORY', 'VERIFIED_ABSENT') }),
      Object.freeze({ kind: 'CACHE', disposition: 'VOLATILE_INVALIDATED', phase: 'local', completed: true, evidenceSha256: cacheEvidence }),
      Object.freeze({ kind: 'REPLICA', disposition: 'PLAINTEXT_REPLICA_RETIRED', phase: 'local', completed: true, evidenceSha256: fixedEvidence('REPLICA', 'PLAINTEXT_REPLICA_RETIRED') }),
      Object.freeze({ kind: 'BACKUP', disposition: 'VERIFIED_REWRITE_PENDING', phase: 'asynchronous_backup', completed: false, evidenceSha256: fixedEvidence('BACKUP', 'VERIFIED_REWRITE_PENDING') })
    ]);
    const unsigned = Object.freeze({
      schemaVersion: 1 as const,
      policyVersion: SOURCE_DELETION_PROPAGATION_POLICY_VERSION,
      operation: 'RETENTION_PURGE' as const,
      source: Object.freeze({ ...source }),
      persistentInspection: Object.freeze({
        ...persistentInspection,
        unregisteredPersistentOwners: Object.freeze([...persistentInspection.unregisteredPersistentOwners])
      }),
      cacheInvalidations: Object.freeze(cacheInvalidations.map((entry) => Object.freeze({ ...entry }))),
      ownerOutcomes,
      localPropagationComplete: true as const,
      backupPropagationPending: true as const
    });
    return Object.freeze({ allowed: true, plan: Object.freeze({ ...unsigned, planHash: sha256(unsigned) }) });
  }

  public verify(plan: SourceDeletionPropagationPlan): SourceDeletionPropagationDecision {
    if (!SHA256.test(plan.planHash)) return Object.freeze({ allowed: false, reason: 'PLAN_HASH_MISMATCH' });
    const rebuilt = this.evaluate({
      source: plan.source,
      persistentInspection: plan.persistentInspection,
      cacheInvalidations: plan.cacheInvalidations
    });
    if (!rebuilt.allowed) return rebuilt;
    if (rebuilt.plan.planHash !== plan.planHash) return Object.freeze({ allowed: false, reason: 'PLAN_HASH_MISMATCH' });
    if (canonicalize(rebuilt.plan) !== canonicalize(plan)) {
      return Object.freeze({ allowed: false, reason: 'PLAN_STRUCTURE_MISMATCH' });
    }
    return rebuilt;
  }

  public snapshot() {
    return Object.freeze({
      schemaVersion: 1 as const,
      policyVersion: SOURCE_DELETION_PROPAGATION_POLICY_VERSION,
      enforcement: 'fail-closed' as const,
      ownerKinds: SOURCE_DELETION_PROPAGATION_OWNER_KINDS,
      requiredCacheRegistries: SOURCE_DELETION_REQUIRED_CACHE_REGISTRIES,
      activeSemanticPersistentOwners: 0 as const,
      plaintextReplicaAllowed: false as const,
      localPropagationMustPrecedeSourceDelete: true as const,
      managedBackupVerifiedRewriteRequired: true as const,
      unmanagedAndExternalBackupAttentionRequired: true as const,
      historicalBackupQuarantineIsNotPhysicalDestruction: true as const,
      payloadExposedToClient: false as const
    });
  }
}
