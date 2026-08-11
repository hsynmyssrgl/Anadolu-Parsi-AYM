import type {
  BackupQuarantineBatchStatus,
  BackupQuarantineBatchView,
  BackupQuarantinePolicyView
} from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface BackupQuarantineBatchRow extends BackupQuarantineBatchView {}
export interface BackupQuarantinePolicyRow extends BackupQuarantinePolicyView {}

export interface InsertBackupQuarantineBatchRow {
  readonly id:string;
  readonly propagationRunId:string;
  readonly targetId:string;
  readonly targetName:string;
  readonly quarantineDirectory:string;
  readonly manifestPath:string;
  readonly status:BackupQuarantineBatchStatus;
  readonly quarantinedArtifacts:number;
  readonly quarantinedAt:string;
  readonly retainUntil:string;
  readonly legalHold:boolean;
  readonly updatedAt:string;
}

export interface BackupQuarantineRepositoryPort {
  getPolicy(context:RepositoryExecutionContext):RepositoryResult<BackupQuarantinePolicyRow>;
  updatePolicy(context:RepositoryExecutionContext,retentionDays:number,updatedAt:string):RepositoryResult<BackupQuarantinePolicyRow>;
  insertBatch(context:RepositoryExecutionContext,row:InsertBackupQuarantineBatchRow):RepositoryResult<void>;
  listBatches(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly BackupQuarantineBatchRow[]>;
  findBatch(context:RepositoryExecutionContext,id:string):RepositoryResult<BackupQuarantineBatchRow|null>;
  setLegalHold(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly enabled:boolean;readonly reason?:string;readonly updatedAt:string}):RepositoryResult<BackupQuarantineBatchRow|null>;
  beginDestruction(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly updatedAt:string}):RepositoryResult<BackupQuarantineBatchRow|null>;
  completeDestruction(context:RepositoryExecutionContext,input:{readonly id:string;readonly expectedUpdatedAt:string;readonly destroyedAt:string;readonly destroyedArtifacts:number;readonly destroyedBytes:number}):RepositoryResult<BackupQuarantineBatchRow|null>;
}
