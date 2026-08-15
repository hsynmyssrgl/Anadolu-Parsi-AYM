import type { FamilyId, PersonId } from '@ppt/core';
import type { CommunicationArchiveIntegrityCheckpointView, CommunicationAuditEventView } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface CommunicationAuditArchiveKey {
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
}

export interface CommunicationAuditOperationRow {
  readonly clientOperationId: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly operationKind: 'audit_append' | 'checkpoint_register';
  readonly requestFingerprint: string;
  readonly resultId: string;
}

export interface CommunicationAuditArchiveRepositoryPort {
  listEvents(context: RepositoryExecutionContext, key: CommunicationAuditArchiveKey): RepositoryResult<readonly CommunicationAuditEventView[]>;
  listCheckpoints(context: RepositoryExecutionContext, key: CommunicationAuditArchiveKey): RepositoryResult<readonly CommunicationArchiveIntegrityCheckpointView[]>;
  findOperation(context: RepositoryExecutionContext, key: CommunicationAuditArchiveKey,
    clientOperationId: string): RepositoryResult<CommunicationAuditOperationRow | null>;
  appendEvent(context: RepositoryExecutionContext, key: CommunicationAuditArchiveKey,
    event: CommunicationAuditEventView, operation: CommunicationAuditOperationRow): RepositoryResult<void>;
  appendCheckpoint(context: RepositoryExecutionContext, key: CommunicationAuditArchiveKey,
    checkpoint: CommunicationArchiveIntegrityCheckpointView, operation: CommunicationAuditOperationRow): RepositoryResult<void>;
}
