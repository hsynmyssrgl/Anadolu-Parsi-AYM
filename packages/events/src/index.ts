import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CausationId,
  type Clock,
  type CorrelationId,
  type ErrorCode,
  type EventId,
  type IsoDateTime,
  type Result,
  type UserId
} from '@ppt/core';

export type EventType = `${string}.${string}`;
export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed';

export interface DomainEvent<TPayload = unknown> {
  readonly eventId: EventId;
  readonly eventType: EventType;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly occurredAt: IsoDateTime;
  readonly actorId?: UserId;
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
  readonly payload: TPayload;
}

export interface OutboxEntry<TPayload = unknown> extends DomainEvent<TPayload> {
  readonly availableAt: IsoDateTime;
  readonly status: OutboxStatus;
  readonly attemptCount: number;
  readonly processingStartedAt?: IsoDateTime;
  readonly publishedAt?: IsoDateTime;
  readonly lastError?: AppError;
}

export interface EventHandler<TPayload = unknown> {
  readonly name: string;
  readonly eventType: EventType;
  handle(event: DomainEvent<TPayload>): Promise<Result<void, AppError>>;
}

export interface EventHandlerReceipt {
  readonly eventId: EventId;
  readonly handlerName: string;
  readonly handledAt: IsoDateTime;
  readonly outcome: 'success' | 'failure';
  readonly errorCode?: ErrorCode;
}

export type Awaitable<TValue> = TValue | Promise<TValue>;

export interface ClaimPendingEventsInput {
  readonly limit: number;
  readonly now: IsoDateTime;
  readonly staleBefore: IsoDateTime;
  readonly correlationId: CorrelationId;
}

export interface EventDispatchStore {
  claimPending(input: ClaimPendingEventsInput): Awaitable<Result<readonly OutboxEntry[], AppError>>;
  hasSuccessfulReceipt(input: {
    readonly eventId: EventId;
    readonly handlerName: string;
    readonly correlationId: CorrelationId;
  }): Awaitable<Result<boolean, AppError>>;
  recordReceipt(input: {
    readonly receipt: EventHandlerReceipt;
    readonly correlationId: CorrelationId;
  }): Awaitable<Result<void, AppError>>;
  markPublished(input: {
    readonly eventId: EventId;
    readonly publishedAt: IsoDateTime;
    readonly correlationId: CorrelationId;
  }): Awaitable<Result<void, AppError>>;
  reschedule(input: {
    readonly eventId: EventId;
    readonly availableAt: IsoDateTime;
    readonly error: AppError;
    readonly correlationId: CorrelationId;
  }): Awaitable<Result<void, AppError>>;
  markFailed(input: {
    readonly eventId: EventId;
    readonly failedAt: IsoDateTime;
    readonly error: AppError;
    readonly correlationId: CorrelationId;
  }): Awaitable<Result<void, AppError>>;
}

export interface RetryDecision {
  readonly action: 'retry' | 'fail';
  readonly availableAt?: IsoDateTime;
}

export interface RetryPolicy {
  decide(input: {
    readonly attemptCount: number;
    readonly error: AppError;
    readonly now: IsoDateTime;
  }): RetryDecision;
}

export interface ExponentialRetryPolicyOptions {
  readonly maximumAttempts: number;
  readonly baseDelayMs: number;
  readonly maximumDelayMs: number;
}

export const createExponentialRetryPolicy = (
  options: ExponentialRetryPolicyOptions
): RetryPolicy => ({
  decide: ({ attemptCount, error, now }) => {
    if (!error.retryable || attemptCount >= options.maximumAttempts) return { action: 'fail' };
    const exponent = Math.max(0, attemptCount - 1);
    const delayMs = Math.min(options.maximumDelayMs, options.baseDelayMs * (2 ** exponent));
    return {
      action: 'retry',
      availableAt: new Date(new Date(now).getTime() + delayMs).toISOString() as IsoDateTime
    };
  }
});

export interface EventDispatchBatchSummary {
  readonly checkedAt: IsoDateTime;
  readonly claimed: number;
  readonly published: number;
  readonly retried: number;
  readonly failed: number;
  readonly successfulHandlers: number;
  readonly skippedHandlers: number;
}

export interface DispatchBatchInput {
  readonly correlationId: CorrelationId;
  readonly limit?: number;
}

export interface EventDispatcherOptions {
  readonly store: EventDispatchStore;
  readonly handlers: readonly EventHandler[];
  readonly retryPolicy: RetryPolicy;
  readonly clock: Clock;
  readonly staleProcessingAfterMs?: number;
}

const thrownHandlerError = (
  event: DomainEvent,
  handler: EventHandler,
  error: unknown
): AppError => createAppError({
  code: ERROR_CODES.EVENT_HANDLER_FAILED,
  message: `Event handler çalıştırılamadı: ${handler.name}`,
  category: 'infrastructure',
  retryable: true,
  correlationId: event.correlationId,
  details: {
    eventId: event.eventId,
    eventType: event.eventType,
    handlerName: handler.name,
    errorName: error instanceof Error ? error.name : typeof error
  }
});

export class EventDispatcher {
  readonly #handlersByType: ReadonlyMap<EventType, readonly EventHandler[]>;
  readonly #staleProcessingAfterMs: number;

  public constructor(private readonly options: EventDispatcherOptions) {
    const grouped = new Map<EventType, EventHandler[]>();
    for (const handler of options.handlers) {
      const handlers = grouped.get(handler.eventType) ?? [];
      if (handlers.some((registered) => registered.name === handler.name)) {
        throw new Error(`Aynı event handler iki kez kaydedilemez: ${handler.eventType}/${handler.name}`);
      }
      handlers.push(handler);
      grouped.set(handler.eventType, handlers);
    }
    this.#handlersByType = grouped;
    this.#staleProcessingAfterMs = options.staleProcessingAfterMs ?? 5 * 60_000;
  }

  public async dispatchBatch(input: DispatchBatchInput): Promise<Result<EventDispatchBatchSummary, AppError>> {
    const checkedAt = this.options.clock.now();
    const staleBefore = new Date(
      new Date(checkedAt).getTime() - this.#staleProcessingAfterMs
    ).toISOString() as IsoDateTime;
    const claimed = await this.options.store.claimPending({
      limit: Math.max(1, Math.min(input.limit ?? 50, 500)),
      now: checkedAt,
      staleBefore,
      correlationId: input.correlationId
    });
    if (!claimed.ok) return claimed;

    let published = 0;
    let retried = 0;
    let failed = 0;
    let successfulHandlers = 0;
    let skippedHandlers = 0;

    for (const event of claimed.value) {
      const handlers = this.#handlersByType.get(event.eventType) ?? [];
      let eventFailure: AppError | undefined;

      for (const handler of handlers) {
        const receipt = await this.options.store.hasSuccessfulReceipt({
          eventId: event.eventId,
          handlerName: handler.name,
          correlationId: event.correlationId
        });
        if (!receipt.ok) return receipt;
        if (receipt.value) {
          skippedHandlers += 1;
          continue;
        }

        let handled: Result<void, AppError>;
        try {
          handled = await handler.handle(event);
        } catch (error) {
          handled = err(thrownHandlerError(event, handler, error));
        }

        const handledAt = this.options.clock.now();
        const recorded = await this.options.store.recordReceipt({
          receipt: {
            eventId: event.eventId,
            handlerName: handler.name,
            handledAt,
            outcome: handled.ok ? 'success' : 'failure',
            ...(handled.ok ? {} : { errorCode: handled.error.code })
          },
          correlationId: event.correlationId
        });
        if (!recorded.ok) return recorded;

        if (!handled.ok) {
          eventFailure = handled.error;
          break;
        }
        successfulHandlers += 1;
      }

      if (!eventFailure) {
        const marked = await this.options.store.markPublished({
          eventId: event.eventId,
          publishedAt: this.options.clock.now(),
          correlationId: event.correlationId
        });
        if (!marked.ok) return marked;
        published += 1;
        continue;
      }

      const decision = this.options.retryPolicy.decide({
        attemptCount: event.attemptCount,
        error: eventFailure,
        now: this.options.clock.now()
      });
      if (decision.action === 'retry' && decision.availableAt) {
        const rescheduled = await this.options.store.reschedule({
          eventId: event.eventId,
          availableAt: decision.availableAt,
          error: eventFailure,
          correlationId: event.correlationId
        });
        if (!rescheduled.ok) return rescheduled;
        retried += 1;
      } else {
        const marked = await this.options.store.markFailed({
          eventId: event.eventId,
          failedAt: this.options.clock.now(),
          error: eventFailure,
          correlationId: event.correlationId
        });
        if (!marked.ok) return marked;
        failed += 1;
      }
    }

    return ok({
      checkedAt,
      claimed: claimed.value.length,
      published,
      retried,
      failed,
      successfulHandlers,
      skippedHandlers
    });
  }
}
