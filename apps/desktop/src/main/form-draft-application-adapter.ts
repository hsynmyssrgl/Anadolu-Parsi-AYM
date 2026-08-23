import type {
  FormDraftApplicationContext,
  FormDraftPolicyIntent,
  FormDraftUnitOfWork,
  FormDraftWriteScope,
  TimelineApplicationContext,
  TimelinePolicyIntent
} from '@ppt/application';
import { asIsoDateTime, type AppError, type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type {
  AuditRepositoryPort,
  FormDraftRepositoryPort,
  OutboxRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { RepositoryBackedTimelinePolicyTransactionRunner } from './timeline-application-adapter.js';

export interface RepositoryBackedFormDraftDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly repository: FormDraftRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly policyTransactionRunner: RepositoryBackedTimelinePolicyTransactionRunner;
}

const timelineContext = (context: FormDraftApplicationContext): TimelineApplicationContext => ({
  familyId: context.familyId,
  actor: {
    userId: context.actor.userId,
    roles: Object.freeze([context.actor.role]),
    ...(context.actor.personId ? { personId: context.actor.personId } : {})
  },
  correlationId: context.correlationId
});

const timelineIntent = (intent: FormDraftPolicyIntent): TimelinePolicyIntent => ({
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

class RepositoryBackedFormDraftWriteScope implements FormDraftWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedFormDraftDependencies,
    private readonly context: PolicyAuthorizedRepositoryExecutionContext,
    public readonly occurredAt: FormDraftWriteScope['occurredAt']
  ) {}

  public find(...args: Parameters<FormDraftWriteScope['find']>): ReturnType<FormDraftWriteScope['find']> {
    return this.dependencies.repository.find(this.context, ...args);
  }
  public findMutationByClientOperationId(
    ...args: Parameters<FormDraftWriteScope['findMutationByClientOperationId']>
  ): ReturnType<FormDraftWriteScope['findMutationByClientOperationId']> {
    return this.dependencies.repository.findMutationByClientOperationId(this.context, ...args);
  }
  public findMutationByRevision(
    ...args: Parameters<FormDraftWriteScope['findMutationByRevision']>
  ): ReturnType<FormDraftWriteScope['findMutationByRevision']> {
    return this.dependencies.repository.findMutationByRevision(this.context, ...args);
  }
  public listMutations(
    ...args: Parameters<FormDraftWriteScope['listMutations']>
  ): ReturnType<FormDraftWriteScope['listMutations']> {
    return this.dependencies.repository.listMutations(this.context, ...args);
  }
  public insertMutation(
    row: Parameters<FormDraftWriteScope['insertMutation']>[0]
  ): ReturnType<FormDraftWriteScope['insertMutation']> {
    return this.dependencies.repository.insertMutation(this.context, row);
  }
  public saveCurrent(
    row: Parameters<FormDraftWriteScope['saveCurrent']>[0],
    expectedRevision: number
  ): ReturnType<FormDraftWriteScope['saveCurrent']> {
    return this.dependencies.repository.saveCurrent(this.context, row, expectedRevision);
  }
  public appendAudit(
    input: Parameters<FormDraftWriteScope['appendAudit']>[0]
  ): ReturnType<FormDraftWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.context, input);
  }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.context, event);
  }
}

export class RepositoryBackedFormDraftUnitOfWork implements FormDraftUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedFormDraftDependencies) {}

  public execute<T>(
    context: FormDraftApplicationContext,
    intent: FormDraftPolicyIntent,
    operation: (scope: FormDraftWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    return this.dependencies.policyTransactionRunner.execute(
      timelineContext(context),
      timelineIntent(intent),
      ({ repository, authorization }) => operation(new RepositoryBackedFormDraftWriteScope(
        this.dependencies,
        repository,
        asIsoDateTime(authorization.receiptRecord.recordedAt)
      ))
    );
  }
}
