import type { NotificationStateRecord, NotificationStateRepositoryPort } from '@ppt/repository-contracts';
import { asIsoDateTime, asUserId, type IsoDateTime, type UserId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

const mapState = (row: Record<string, unknown>): NotificationStateRecord => ({
  notificationId: String(row.notification_id),
  accountId: asUserId(String(row.account_id)),
  sourceType: String(row.source_type),
  sourceId: String(row.source_id),
  occurrenceKey: String(row.occurrence_key),
  ...(row.acknowledged_at ? { acknowledgedAt: asIsoDateTime(String(row.acknowledged_at)) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

export class SqliteNotificationStateRepository extends SqliteRepository implements NotificationStateRepositoryPort {
  public listByNotificationIds(
    context: RepositoryExecutionContext,
    accountId: UserId,
    notificationIds: readonly string[]
  ): RepositoryResult<readonly NotificationStateRecord[]> {
    if (notificationIds.length === 0) return { ok: true, value: [] };
    return this.execute(context, () => {
      const placeholders = notificationIds.map(() => '?').join(',');
      return (this.database(context).prepare(`
        SELECT notification_id,account_id,source_type,source_id,occurrence_key,acknowledged_at,created_at
        FROM event_notification_states
        WHERE account_id=? AND notification_id IN (${placeholders})
      `).all(accountId, ...notificationIds) as ReadonlyArray<Record<string, unknown>>).map(mapState);
    });
  }

  public acknowledge(context: RepositoryExecutionContext, state: NotificationStateRecord): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO event_notification_states(
          notification_id,account_id,source_type,source_id,occurrence_key,acknowledged_at,created_at
        ) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(notification_id,account_id) DO UPDATE SET
          source_type=excluded.source_type,
          source_id=excluded.source_id,
          occurrence_key=excluded.occurrence_key,
          acknowledged_at=excluded.acknowledged_at
      `).run(
        state.notificationId,
        state.accountId,
        state.sourceType,
        state.sourceId,
        state.occurrenceKey,
        state.acknowledgedAt ?? null,
        state.createdAt
      );
    });
  }
}
