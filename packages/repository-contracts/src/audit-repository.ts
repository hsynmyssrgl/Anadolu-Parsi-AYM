import type { AuditChainEntry, AuditChainVerification, IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface AppendAuditInput {
  readonly id: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly occurredAt: IsoDateTime;
  readonly actorId: UserId;
}

export interface AuditRepositoryPort {
    append(context: RepositoryExecutionContext, input: AppendAuditInput): RepositoryResult<string>;
    backfillMissingChain(context: RepositoryExecutionContext): RepositoryResult<number>;
    latestOccurredAt(context: RepositoryExecutionContext): RepositoryResult<IsoDateTime | undefined>;
    listEntries(context: RepositoryExecutionContext, limit?: number): RepositoryResult<readonly AuditChainEntry[]>;
    listEntriesDescending(context: RepositoryExecutionContext, limit?: number): RepositoryResult<readonly AuditChainEntry[]>;
    verify(context: RepositoryExecutionContext): RepositoryResult<AuditChainVerification>;
}
