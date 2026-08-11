import type { BackupRunView, BackupTargetView } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface BackupRepositoryPort {
    listTargets(c: RepositoryExecutionContext): RepositoryResult<readonly BackupTargetView[]>;
    findTarget(c: RepositoryExecutionContext, id: string): RepositoryResult<BackupTargetView | undefined>;
    upsertTarget(c: RepositoryExecutionContext, t: BackupTargetView): RepositoryResult<void>;
    listRuns(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly BackupRunView[]>;
    listSuccessfulRuns(c: RepositoryExecutionContext, targetId: string): RepositoryResult<readonly BackupRunView[]>;
    listEnabledTargetIds(c: RepositoryExecutionContext): RepositoryResult<readonly string[]>;
    listDueTargetIds(c: RepositoryExecutionContext, at: string): RepositoryResult<readonly string[]>;
    insertRun(c: RepositoryExecutionContext, r: BackupRunView): RepositoryResult<void>;
    markTargetSuccess(c: RepositoryExecutionContext, id: string, completedAt: string, nextRunAt?: string): RepositoryResult<void>;
    markTargetFailure(c: RepositoryExecutionContext, id: string, error: string): RepositoryResult<void>;
    deleteRun(c: RepositoryExecutionContext, id: string): RepositoryResult<void>;
}
