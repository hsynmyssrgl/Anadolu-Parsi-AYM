import type { OutboxRepositoryPort } from '@ppt/repository-contracts';
import {
  createAppError,
  asEventId,
  asIsoDateTime,
  type AppError,
  type CausationId,
  type CorrelationId,
  type ErrorCode,
  type EventId,
  type IsoDateTime,
  type UserId
} from '@ppt/core';
import type { DomainEvent, EventHandlerReceipt, OutboxEntry, OutboxStatus } from '@ppt/events';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';

const parseEntry = (row: Record<string, unknown>): OutboxEntry => {
  const headers = JSON.parse(String(row.headers_json)) as Record<string, string | undefined>;
  const correlationId = String(headers.correlationId) as CorrelationId;
  const base = {
    eventId: asEventId(String(row.id)),
    eventType: String(row.event_type) as OutboxEntry['eventType'],
    eventVersion: Number(row.event_version),
    aggregateType: String(row.aggregate_type),
    aggregateId: String(row.aggregate_id),
    occurredAt: asIsoDateTime(String(row.occurred_at)),
    correlationId,
    payload: JSON.parse(String(row.payload_json)) as unknown,
    availableAt: asIsoDateTime(String(row.available_at)),
    status: String(row.status) as OutboxStatus,
    attemptCount: Number(row.attempt_count)
  };
  const errorCode = row.last_error_code ? String(row.last_error_code) as ErrorCode : undefined;
  const lastError: AppError | undefined = errorCode
    ? createAppError({
      code: errorCode,
      message: String(row.last_error_message ?? 'Outbox işlemi başarısız oldu.'),
      category: 'infrastructure',
      retryable: String(row.status) !== 'failed',
      correlationId
    })
    : undefined;
  return {
    ...base,
    ...(headers.causationId ? { causationId: headers.causationId as CausationId } : {}),
    ...(headers.actorId ? { actorId: headers.actorId as UserId } : {}),
    ...(row.processing_started_at ? { processingStartedAt: asIsoDateTime(String(row.processing_started_at)) } : {}),
    ...(row.published_at ? { publishedAt: asIsoDateTime(String(row.published_at)) } : {}),
    ...(lastError ? { lastError } : {})
  };
};

export class SqliteOutboxRepository extends SqliteRepository implements OutboxRepositoryPort {
  public enqueue<TPayload>(
    context: RepositoryExecutionContext,
    event: DomainEvent<TPayload>,
    availableAt: IsoDateTime = event.occurredAt
  ): RepositoryResult<void> {
    const policy = platformPolicyPersistenceBinding(
      context,
      event.aggregateType,
      event.aggregateId,
      event.correlationId
    );
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO event_outbox(
          id,event_type,event_version,aggregate_type,aggregate_id,payload_json,headers_json,
          occurred_at,available_at,status,attempt_count,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,'pending',0,?,?,?,?,?,?,?)
      `).run(
        event.eventId,
        event.eventType,
        event.eventVersion,
        event.aggregateType,
        event.aggregateId,
        JSON.stringify(event.payload),
        JSON.stringify({
          correlationId: event.correlationId,
          ...(event.causationId ? { causationId: event.causationId } : {}),
          ...(event.actorId ? { actorId: event.actorId } : {})
        }),
        event.occurredAt,
        availableAt,
        policy?.receiptHash ?? null,
        policy?.receiptVersion ?? null,
        policy?.nonce ?? null,
        policy?.resourceType ?? null,
        policy?.resourceId ?? null,
        policy?.action ?? null,
        policy?.capability ?? null
      );
    });
  }

  public claimPending(
    context: RepositoryExecutionContext,
    input: { readonly limit: number; readonly staleBefore: IsoDateTime }
  ): RepositoryResult<readonly OutboxEntry[]> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE event_outbox
        SET status='pending', processing_started_at=NULL
        WHERE status='processing' AND processing_started_at IS NOT NULL AND processing_started_at<=?
      `).run(input.staleBefore);

      const ids = (this.database(context).prepare(`
        SELECT id FROM event_outbox
        WHERE status='pending' AND available_at<=?
        ORDER BY available_at,occurred_at,id
        LIMIT ?
      `).all(context.occurredAt, Math.max(1, Math.min(input.limit, 500))) as ReadonlyArray<{ readonly id: unknown }>)
        .map((row) => String(row.id));
      if (ids.length === 0) return [];

      const placeholders = ids.map(() => '?').join(',');
      this.database(context).prepare(`
        UPDATE event_outbox
        SET status='processing', attempt_count=attempt_count+1, processing_started_at=?
        WHERE id IN (${placeholders}) AND status='pending'
      `).run(context.occurredAt, ...ids);

      const rows = this.database(context).prepare(`
        SELECT * FROM event_outbox
        WHERE id IN (${placeholders}) AND status='processing'
        ORDER BY available_at,occurred_at,id
      `).all(...ids) as ReadonlyArray<Record<string, unknown>>;
      return rows.map(parseEntry);
    });
  }

  public listPending(context: RepositoryExecutionContext, limit = 100): RepositoryResult<readonly OutboxEntry[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT * FROM event_outbox
        WHERE status='pending' AND available_at<=?
        ORDER BY occurred_at,id LIMIT ?
      `).all(context.occurredAt, Math.max(1, Math.min(limit, 500))) as ReadonlyArray<Record<string, unknown>>
    ).map(parseEntry));
  }

  public hasSuccessfulReceipt(
    context: RepositoryExecutionContext,
    eventId: EventId,
    handlerName: string
  ): RepositoryResult<boolean> {
    return this.execute(context, () => Boolean(this.database(context).prepare(`
      SELECT 1 AS found FROM event_handler_receipts
      WHERE event_id=? AND handler_name=? AND outcome='success'
    `).get(eventId, handlerName)));
  }

  public recordHandlerReceipt(
    context: RepositoryExecutionContext,
    receipt: EventHandlerReceipt
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO event_handler_receipts(event_id,handler_name,handled_at,outcome,error_code)
        VALUES(?,?,?,?,?)
        ON CONFLICT(event_id,handler_name) DO UPDATE SET
          handled_at=excluded.handled_at,
          outcome=excluded.outcome,
          error_code=excluded.error_code
      `).run(
        receipt.eventId,
        receipt.handlerName,
        receipt.handledAt,
        receipt.outcome,
        receipt.errorCode ?? null
      );
    });
  }

  public markPublished(
    context: RepositoryExecutionContext,
    eventId: EventId,
    publishedAt: IsoDateTime
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE event_outbox SET
          status='published', published_at=?, processing_started_at=NULL,
          last_error_code=NULL,last_error_message=NULL
        WHERE id=?
      `).run(publishedAt, eventId);
    });
  }

  public reschedule(
    context: RepositoryExecutionContext,
    eventId: EventId,
    availableAt: IsoDateTime,
    error: AppError
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE event_outbox SET
          status='pending', available_at=?, processing_started_at=NULL,
          last_error_code=?,last_error_message=?
        WHERE id=?
      `).run(availableAt, error.code, error.message, eventId);
    });
  }

  public markFailed(
    context: RepositoryExecutionContext,
    eventId: EventId,
    failedAt: IsoDateTime,
    error: AppError
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE event_outbox SET
          status='failed', available_at=?, processing_started_at=NULL,
          last_error_code=?,last_error_message=?
        WHERE id=?
      `).run(failedAt, error.code, error.message, eventId);
    });
  }

  public countByAggregate(
    context: RepositoryExecutionContext,
    aggregateType: string,
    aggregateId: string
  ): RepositoryResult<number> {
    return this.execute(context, () => Number((
      this.database(context).prepare(`
        SELECT COUNT(*) AS count FROM event_outbox WHERE aggregate_type=? AND aggregate_id=?
      `).get(aggregateType, aggregateId) as { readonly count: number }
    ).count));
  }
}
