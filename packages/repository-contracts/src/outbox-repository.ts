import type { AppError, EventId, IsoDateTime } from '@ppt/core';
import type { DomainEvent, EventHandlerReceipt, OutboxEntry } from '@ppt/events';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface OutboxRepositoryPort {
    enqueue<TPayload>(context: RepositoryExecutionContext, event: DomainEvent<TPayload>, availableAt?: IsoDateTime): RepositoryResult<void>;
    claimPending(context: RepositoryExecutionContext, input: {
        readonly limit: number;
        readonly staleBefore: IsoDateTime;
    }): RepositoryResult<readonly OutboxEntry[]>;
    listPending(context: RepositoryExecutionContext, limit?: number): RepositoryResult<readonly OutboxEntry[]>;
    hasSuccessfulReceipt(context: RepositoryExecutionContext, eventId: EventId, handlerName: string): RepositoryResult<boolean>;
    recordHandlerReceipt(context: RepositoryExecutionContext, receipt: EventHandlerReceipt): RepositoryResult<void>;
    markPublished(context: RepositoryExecutionContext, eventId: EventId, publishedAt: IsoDateTime): RepositoryResult<void>;
    reschedule(context: RepositoryExecutionContext, eventId: EventId, availableAt: IsoDateTime, error: AppError): RepositoryResult<void>;
    markFailed(context: RepositoryExecutionContext, eventId: EventId, failedAt: IsoDateTime, error: AppError): RepositoryResult<void>;
    countByAggregate(context: RepositoryExecutionContext, aggregateType: string, aggregateId: string): RepositoryResult<number>;
}
