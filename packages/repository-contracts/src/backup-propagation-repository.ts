import type {
  BackupCleanRewriteOutcome,
  BackupCleanRewritePolicyView,
  BackupCleanRewriteRunStatus,
  BackupCleanRewriteRunView,
  BackupCleanRewriteState,
  BackupCleanRewriteTrigger,
  BackupPropagationRunView,
  DataLifecycleResourceType
} from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface PendingBackupPropagationRow {
  readonly resourceType:DataLifecycleResourceType;
  readonly resourceId:string;
  readonly purgedAt?:string;
  readonly updatedAt:string;
}

export interface BackupPropagationRepositoryPort {
  listPending(context:RepositoryExecutionContext):RepositoryResult<readonly PendingBackupPropagationRow[]>;
  markCompleted(context:RepositoryExecutionContext,records:readonly PendingBackupPropagationRow[],completedAt:string):RepositoryResult<number>;
  insertRun(context:RepositoryExecutionContext,run:BackupPropagationRunView):RepositoryResult<void>;
  listRuns(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly BackupPropagationRunView[]>;
  getCleanRewritePolicy(context:RepositoryExecutionContext):RepositoryResult<BackupCleanRewritePolicyView>;
  listCleanRewriteRuns(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly BackupCleanRewriteRunView[]>;
  updateCleanRewritePolicy(context:RepositoryExecutionContext,input:{readonly enabled:boolean;readonly retentionDays:number;readonly updatedAt:string}):RepositoryResult<BackupCleanRewritePolicyView>;
  claimCleanRewrite(context:RepositoryExecutionContext,input:{readonly trigger:BackupCleanRewriteTrigger;readonly runId:string;readonly startedAt:string;readonly retentionCutoff:string;readonly dueRecords:number;readonly enabledTargets:number}):RepositoryResult<BackupCleanRewritePolicyView|null>;
  completeCleanRewrite(context:RepositoryExecutionContext,input:{readonly runId:string;readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly runStatus:Exclude<BackupCleanRewriteRunStatus,'running'|'interrupted'>;readonly completedAt:string;readonly nextAttemptAt?:string;readonly error?:string;readonly propagationRunId?:string;readonly success:boolean}):RepositoryResult<{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView}|null>;
  recoverInterruptedCleanRewrite(context:RepositoryExecutionContext,input:{readonly observedAt:string;readonly error:string}):RepositoryResult<{readonly policy:BackupCleanRewritePolicyView;readonly run?:BackupCleanRewriteRunView}>;
}
