import type { IsoDateTime, PersonId } from '@ppt/core';
import type { DataLifecycleResourceType, DataLifecycleState, RecordPrivacy } from '@ppt/domain';
import type {
  SourceDeletionPersistentOwnerInspection,
  SourceDeletionPropagationPlan
} from '@ppt/platform-policy';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface DataRetentionPolicyRow {
  readonly id:string;
  readonly name:string;
  readonly resourceTypes:readonly DataLifecycleResourceType[];
  readonly retentionDays:number;
  readonly graceDays:number;
  readonly requiresStrongAuth:boolean;
  readonly createdAt:IsoDateTime;
}

export interface DataLifecycleResourceDescriptor {
  readonly resourceType:DataLifecycleResourceType;
  readonly resourceId:string;
  readonly title:string;
  readonly ownerPersonId:PersonId;
  readonly privacy:RecordPrivacy;
}

export interface DataLifecycleRow {
  readonly resourceType:DataLifecycleResourceType;
  readonly resourceId:string;
  readonly ownerPersonId?:PersonId;
  readonly privacy?:RecordPrivacy;
  readonly state:DataLifecycleState;
  readonly policyId?:string;
  readonly archivedAt?:IsoDateTime;
  readonly purgeEligibleAt?:IsoDateTime;
  readonly purgeRequestedAt?:IsoDateTime;
  readonly purgeExecuteAfter?:IsoDateTime;
  readonly legalHold:boolean;
  readonly holdReason?:string;
  readonly purgedAt?:IsoDateTime;
  readonly updatedAt:IsoDateTime;
  readonly backupPropagationPending:boolean;
}

export interface UpsertDataLifecycleInput extends DataLifecycleRow {}

export interface SourceDeletionPropagationRepositoryEvidence {
  readonly schemaVersion:1;
  readonly planHash:string;
  readonly sourceDeleted:true;
  readonly deletedAccessMetadataRows:number;
  readonly localPropagationComplete:true;
  readonly backupPropagationPending:true;
}

export interface DataLifecycleRepositoryPort {
  listPolicies(context:RepositoryExecutionContext):RepositoryResult<readonly DataRetentionPolicyRow[]>;
  findPolicy(context:RepositoryExecutionContext,id:string):RepositoryResult<DataRetentionPolicyRow|null>;
  insertPolicy(context:RepositoryExecutionContext,row:DataRetentionPolicyRow):RepositoryResult<void>;
  listLifecycle(context:RepositoryExecutionContext):RepositoryResult<readonly DataLifecycleRow[]>;
  findLifecycle(context:RepositoryExecutionContext,resourceType:DataLifecycleResourceType,resourceId:string):RepositoryResult<DataLifecycleRow|null>;
  findResource(context:RepositoryExecutionContext,resourceType:DataLifecycleResourceType,resourceId:string):RepositoryResult<DataLifecycleResourceDescriptor|null>;
  upsertLifecycle(context:RepositoryExecutionContext,row:UpsertDataLifecycleInput):RepositoryResult<void>;
  inspectSourceDeletionPropagation(context:RepositoryExecutionContext,inspectedAt:string):RepositoryResult<SourceDeletionPersistentOwnerInspection>;
  purgeResourceWithPropagation(context:RepositoryExecutionContext,plan:SourceDeletionPropagationPlan):RepositoryResult<SourceDeletionPropagationRepositoryEvidence>;
}
