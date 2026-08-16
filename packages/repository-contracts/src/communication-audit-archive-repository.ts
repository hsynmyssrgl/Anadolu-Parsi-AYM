import type { FamilyId, PersonId } from '@ppt/core';
import type { CommunicationArchiveIntegrityCheckpointView, CommunicationAuditEventView } from '@ppt/domain';
import type { PolicyAuthorizedRepositoryExecutionContext, RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface CommunicationAuditArchiveKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
}

export interface CommunicationAuditOperationRow {
  readonly clientOperationId: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly operationKind: 'audit_append' | 'checkpoint_register';
  readonly requestFingerprint: string;
  readonly resultId: string;
  readonly policyResourceId: string;
}

export interface CommunicationAuditArchivePolicyResourceRow {
  readonly resourceType: 'communication_audit_archive';
  readonly resourceId: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly stateFingerprint: string;
}

export interface CommunicationAuditArchivePolicyResourceRepositoryPort {
  resolvePolicyResource(context: RepositoryExecutionContext, resourceId: string):
    RepositoryResult<CommunicationAuditArchivePolicyResourceRow | null>;
}

export interface CommunicationAuditArchiveRepositoryPort {
  listEvents(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationAuditArchiveKey): RepositoryResult<readonly CommunicationAuditEventView[]>;
  listCheckpoints(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationAuditArchiveKey): RepositoryResult<readonly CommunicationArchiveIntegrityCheckpointView[]>;
  findOperation(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationAuditArchiveKey,
    clientOperationId: string): RepositoryResult<CommunicationAuditOperationRow | null>;
  appendEvent(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationAuditArchiveKey,
    event: CommunicationAuditEventView, operation: CommunicationAuditOperationRow): RepositoryResult<void>;
  appendCheckpoint(context: PolicyAuthorizedRepositoryExecutionContext, key: CommunicationAuditArchiveKey,
    checkpoint: CommunicationArchiveIntegrityCheckpointView, operation: CommunicationAuditOperationRow): RepositoryResult<void>;
}
