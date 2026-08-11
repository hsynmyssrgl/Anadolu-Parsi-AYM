import type { FamilyId, IsoDateTime, UserId } from '@ppt/core';
import type { FamilyDataImportBatchStatus, FamilyDataImportEntitySummaryView, FamilyDataImportEntityType } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface FamilyDataImportExistingPersonRecord {
  readonly id: string;
  readonly displayName: string;
  readonly birthDate?: string;
}

export interface FamilyDataImportExistingEventRecord {
  readonly id: string;
  readonly title: string;
  readonly startAt: string;
}

export interface FamilyDataImportExistingRelationRecord {
  readonly id: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly relationType: string;
}

export interface FamilyDataImportExistingLocationRecord {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
}

export interface FamilyDataImportExistingData {
  readonly people: readonly FamilyDataImportExistingPersonRecord[];
  readonly events: readonly FamilyDataImportExistingEventRecord[];
  readonly relations: readonly FamilyDataImportExistingRelationRecord[];
  readonly locations: readonly FamilyDataImportExistingLocationRecord[];
}

export interface FamilyDataImportBatchRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly sourceFileName: string;
  readonly sourceSha256: string;
  readonly sourceExportId: string;
  readonly sourceCreatedAt: IsoDateTime;
  readonly sourceFamilyName: string;
  readonly schemaVersion: 1;
  readonly status: FamilyDataImportBatchStatus;
  readonly appliedAt: IsoDateTime;
  readonly rollbackDeadline: IsoDateTime;
  readonly rolledBackAt?: IsoDateTime;
  readonly actorId: UserId;
  readonly summary: readonly FamilyDataImportEntitySummaryView[];
}

export interface FamilyDataImportItemRecord {
  readonly batchId: string;
  readonly entityType: FamilyDataImportEntityType;
  readonly entityId: string;
  readonly sourceId: string;
  readonly resolution: 'created' | 'reused';
  readonly createdAt: IsoDateTime;
}

export interface FamilyDataImportRollbackInspection {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
}

export interface FamilyDataImportRollbackPolicyTarget {
  readonly entityType: 'event' | 'location';
  readonly entityId: string;
  readonly governed: boolean;
}

export interface FamilyDataImportRepositoryPort {
  loadExisting(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<FamilyDataImportExistingData>;
  insertBatch(context: RepositoryExecutionContext, record: FamilyDataImportBatchRecord): RepositoryResult<void>;
  insertItem(context: RepositoryExecutionContext, record: FamilyDataImportItemRecord): RepositoryResult<void>;
  listBatches(context: RepositoryExecutionContext, familyId: FamilyId, limit?: number): RepositoryResult<readonly FamilyDataImportBatchRecord[]>;
  findBatch(context: RepositoryExecutionContext, batchId: string): RepositoryResult<FamilyDataImportBatchRecord | null>;
  findActiveSource(context: RepositoryExecutionContext, familyId: FamilyId, sourceSha256: string, sourceExportId: string): RepositoryResult<FamilyDataImportBatchRecord | null>;
  listItems(context: RepositoryExecutionContext, batchId: string): RepositoryResult<readonly FamilyDataImportItemRecord[]>;
  inspectRollback(context: RepositoryExecutionContext, batchId: string): RepositoryResult<FamilyDataImportRollbackInspection>;
  listRollbackPolicyTargets(context: RepositoryExecutionContext, batchId: string): RepositoryResult<readonly FamilyDataImportRollbackPolicyTarget[]>;
  deleteCreatedEntities(
    context: RepositoryExecutionContext,
    batchId: string,
    policyContexts?: ReadonlyMap<string, PolicyAuthorizedRepositoryExecutionContext>
  ): RepositoryResult<number>;
  markRollbackBlocked(context: RepositoryExecutionContext, batchId: string): RepositoryResult<void>;
  markRolledBack(context: RepositoryExecutionContext, batchId: string, rolledBackAt: IsoDateTime): RepositoryResult<void>;
}
