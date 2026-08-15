import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  MemoryStudioMutationKind,
  MemoryStudioRecordView,
  MemoryTimeCapsuleView
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface MemoryStudioCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface MemoryStudioRecordRow extends MemoryStudioRecordView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly referenceFingerprint: string;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface MemoryTimeCapsuleRow extends MemoryTimeCapsuleView {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly referenceFingerprint: string;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
}

export interface MemoryStudioMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: 'memory_studio_record' | 'memory_time_capsule';
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: MemoryStudioMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly referenceFingerprint: string;
  readonly referenceCount: number;
  readonly occurredAt: IsoDateTime;
}

export interface MemoryStudioCenterSnapshotRow {
  readonly records: readonly MemoryStudioRecordRow[];
  readonly capsules: readonly MemoryTimeCapsuleRow[];
}

export interface MemoryStudioReferenceSet {
  readonly archiveItemIds: readonly string[];
  readonly personIds: readonly string[];
  readonly memoryRecordIds: readonly string[];
  readonly ocrJobId?: string;
}

export interface MemoryStudioRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: MemoryStudioCenterKey
  ): RepositoryResult<MemoryStudioCenterSnapshotRow>;
  findRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: MemoryStudioCenterKey,
    recordId: string
  ): RepositoryResult<MemoryStudioRecordRow | null>;
  findCapsule(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: MemoryStudioCenterKey,
    capsuleId: string
  ): RepositoryResult<MemoryTimeCapsuleRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: MemoryStudioCenterKey,
    clientOperationId: string
  ): RepositoryResult<MemoryStudioMutationRow | null>;
  validateOwnedReferences(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: MemoryStudioCenterKey,
    references: MemoryStudioReferenceSet
  ): RepositoryResult<boolean>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: MemoryStudioMutationRow
  ): RepositoryResult<void>;
  insertRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: MemoryStudioRecordRow
  ): RepositoryResult<void>;
  saveRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: MemoryStudioRecordRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  insertCapsule(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: MemoryTimeCapsuleRow
  ): RepositoryResult<void>;
  saveCapsule(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: MemoryTimeCapsuleRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free current-row metadata used before central policy authorization. */
export interface MemoryStudioPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: 'memory_studio_record' | 'memory_time_capsule',
    resourceId: string
  ): RepositoryResult<{
    readonly id: string;
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly revision: number;
    readonly status: string;
    readonly stateFingerprint: string;
  } | null>;
}

const canonicalIds = (values: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));

export const canonicalMemoryStudioReferences = (
  references: MemoryStudioReferenceSet
): MemoryStudioReferenceSet => Object.freeze({
  archiveItemIds: canonicalIds(references.archiveItemIds),
  personIds: canonicalIds(references.personIds),
  memoryRecordIds: canonicalIds(references.memoryRecordIds),
  ...(references.ocrJobId ? { ocrJobId: references.ocrJobId } : {})
});
