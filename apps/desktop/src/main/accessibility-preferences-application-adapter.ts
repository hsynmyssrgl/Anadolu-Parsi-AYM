import type {
  AccessibilityPreferencesApplicationContext,
  AccessibilityPreferencesPolicyIntent,
  AccessibilityPreferencesUnitOfWork,
  AccessibilityPreferencesWriteScope,
  TimelineApplicationContext,
  TimelinePolicyIntent
} from '@ppt/application';
import { asIsoDateTime, type AppError, type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type {
  AccessibilityPreferencesRepositoryPort,
  AuditRepositoryPort,
  OutboxRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import {
  RepositoryBackedTimelinePolicyTransactionRunner
} from './timeline-application-adapter.js';

export interface RepositoryBackedAccessibilityPreferencesDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly repository: AccessibilityPreferencesRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyTransactionRunner: RepositoryBackedTimelinePolicyTransactionRunner;
}

const timelineContext = (
  context: AccessibilityPreferencesApplicationContext
): TimelineApplicationContext => ({
  familyId: context.familyId,
  actor: {
    userId: context.actor.userId,
    roles: Object.freeze([context.actor.role]),
    ...(context.actor.personId ? { personId: context.actor.personId } : {})
  },
  correlationId: context.correlationId
});

const timelineIntent = (intent: AccessibilityPreferencesPolicyIntent): TimelinePolicyIntent => ({
  action: intent.action,
  capability: intent.capability,
  resourceType: intent.resourceType,
  resourceId: intent.resourceId,
  purpose: intent.purpose,
  ownerPersonId: intent.ownerPersonId,
  targetSensitivity: intent.sensitivity,
  ...(intent.action === 'create'
    ? { sourceResourceMode: 'replace' as const }
    : intent.action === 'update'
      ? { sourceResourceMode: 'preserve' as const }
      : {})
});

class RepositoryBackedAccessibilityPreferencesWriteScope implements AccessibilityPreferencesWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedAccessibilityPreferencesDependencies,
    private readonly context: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: AccessibilityPreferencesWriteScope['occurredAt']
  ) {}

  public find(
    accountId: Parameters<AccessibilityPreferencesWriteScope['find']>[0]
  ): ReturnType<AccessibilityPreferencesWriteScope['find']> {
    return this.dependencies.repository.find(this.context, accountId);
  }

  public findMutationByClientOperationId(
    accountId: Parameters<AccessibilityPreferencesWriteScope['findMutationByClientOperationId']>[0],
    clientOperationId: Parameters<AccessibilityPreferencesWriteScope['findMutationByClientOperationId']>[1]
  ): ReturnType<AccessibilityPreferencesWriteScope['findMutationByClientOperationId']> {
    return this.dependencies.repository.findMutationByClientOperationId(
      this.context,
      accountId,
      clientOperationId
    );
  }

  public insertMutation(
    row: Parameters<AccessibilityPreferencesWriteScope['insertMutation']>[0]
  ): ReturnType<AccessibilityPreferencesWriteScope['insertMutation']> {
    return this.dependencies.repository.insertMutation(this.context, row);
  }

  public saveCurrent(
    row: Parameters<AccessibilityPreferencesWriteScope['saveCurrent']>[0],
    expectedRevision: number
  ): ReturnType<AccessibilityPreferencesWriteScope['saveCurrent']> {
    return this.dependencies.repository.saveCurrent(this.context, row, expectedRevision);
  }

  public appendAudit(
    input: Parameters<AccessibilityPreferencesWriteScope['appendAudit']>[0]
  ): ReturnType<AccessibilityPreferencesWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.context, input);
  }

  public enqueueEvent<T>(
    event: DomainEvent<T>
  ): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.context, event);
  }
}

export class RepositoryBackedAccessibilityPreferencesUnitOfWork
implements AccessibilityPreferencesUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedAccessibilityPreferencesDependencies) {}

  public execute<T>(
    context: AccessibilityPreferencesApplicationContext,
    intent: AccessibilityPreferencesPolicyIntent,
    operation: (scope: AccessibilityPreferencesWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.dependencies.policyTransactionRunner.execute(
      timelineContext(context),
      timelineIntent(intent),
      ({ repository, authorization }) => operation(
        new RepositoryBackedAccessibilityPreferencesWriteScope(
          this.dependencies,
          repository,
          asIsoDateTime(authorization.receiptRecord.recordedAt)
        )
      )
    );
  }
}
