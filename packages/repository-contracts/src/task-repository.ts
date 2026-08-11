import type { BackgroundTaskView, QueuedTaskView } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface TaskRepositoryPort {
    listBackgroundTasks(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly BackgroundTaskView[]>;
    insertBackgroundTask(c: RepositoryExecutionContext, t: BackgroundTaskView): RepositoryResult<void>;
    finishBackgroundTask(c: RepositoryExecutionContext, id: string, status: BackgroundTaskView['status'], completedAt: string, durationMs: number, details?: string): RepositoryResult<void>;
    listQueuedTasks(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly QueuedTaskView[]>;
    listRunnableQueuedTasks(c: RepositoryExecutionContext, limit: number): RepositoryResult<readonly QueuedTaskView[]>;
    enqueueTask(c: RepositoryExecutionContext, t: QueuedTaskView): RepositoryResult<void>;
    markQueuedTaskDeferred(c: RepositoryExecutionContext, id: string, details: string): RepositoryResult<void>;
    markQueuedTaskRunning(c: RepositoryExecutionContext, id: string, startedAt: string, attempts: number): RepositoryResult<void>;
    markQueuedTaskCompleted(c: RepositoryExecutionContext, id: string, completedAt: string): RepositoryResult<void>;
    markQueuedTaskRetryOrFailed(c: RepositoryExecutionContext, id: string, status: 'queued' | 'failed', completedAt: string | undefined, details: string): RepositoryResult<void>;
}
