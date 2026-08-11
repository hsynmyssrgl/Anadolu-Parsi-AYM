import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface NotificationStateRecord {
  readonly notificationId: string;
  readonly accountId: UserId;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly occurrenceKey: string;
  readonly acknowledgedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface NotificationStateRepositoryPort {
    listByNotificationIds(context: RepositoryExecutionContext, accountId: UserId, notificationIds: readonly string[]): RepositoryResult<readonly NotificationStateRecord[]>;
    acknowledge(context: RepositoryExecutionContext, state: NotificationStateRecord): RepositoryResult<void>;
}
