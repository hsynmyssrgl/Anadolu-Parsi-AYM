import type { AppError, Result } from '@ppt/core';
import type {
  DataRepairApplicationContext,
  DataRepairUnitOfWork,
  DataRepairWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import { CentralAuthorizationService, isAuthorizationRole } from '@ppt/security';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  DataRepairRepositoryPort,
  OutboxRepositoryPort,
  RepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface RepositoryBackedDataRepairDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly dataRepairRepository: DataRepairRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
}

class RepositoryBackedDataRepairWriteScope implements DataRepairWriteScope {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(
    private readonly dependencies: RepositoryBackedDataRepairDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: DataRepairWriteScope['occurredAt']
  ) {}

  public authorizeAdministration(): ReturnType<DataRepairWriteScope['authorizeAdministration']> {
    const account = this.dependencies.accountRepository.findById(this.repositoryContext, this.repositoryContext.actor.userId);
    if (!account.ok) return account;
    if (!account.value || account.value.status !== 'active') return { ok: true, value: false };
    if (!isAuthorizationRole(account.value.role)) return { ok: true, value: false };
    const decision = this.#authorization.authorize({
      accountId: account.value.id,
      role: account.value.role,
      action: 'administer',
      resourceType: 'family_membership',
      resourceId: '*',
      occurredAt: this.repositoryContext.occurredAt,
      ...(account.value.personId ? { actorPersonId: account.value.personId } : {})
    });
    return { ok: true, value: decision.allowed };
  }

  public scanIssues(familyId: Parameters<DataRepairWriteScope['scanIssues']>[0]): ReturnType<DataRepairWriteScope['scanIssues']> {
    return this.dependencies.dataRepairRepository.scanIssues(this.repositoryContext, familyId);
  }

  public previewRepair(input: Parameters<DataRepairWriteScope['previewRepair']>[0]): ReturnType<DataRepairWriteScope['previewRepair']> {
    return this.dependencies.dataRepairRepository.previewRepair(this.repositoryContext, input);
  }

  public applyRepair(input: Parameters<DataRepairWriteScope['applyRepair']>[0]): ReturnType<DataRepairWriteScope['applyRepair']> {
    return this.dependencies.dataRepairRepository.applyRepair(this.repositoryContext, input);
  }

  public undoRepair(input: Parameters<DataRepairWriteScope['undoRepair']>[0]): ReturnType<DataRepairWriteScope['undoRepair']> {
    return this.dependencies.dataRepairRepository.undoRepair(this.repositoryContext, input);
  }

  public findOperation(operationId: Parameters<DataRepairWriteScope['findOperation']>[0]): ReturnType<DataRepairWriteScope['findOperation']> {
    return this.dependencies.dataRepairRepository.findOperation(this.repositoryContext, operationId);
  }

  public listOperations(familyId: Parameters<DataRepairWriteScope['listOperations']>[0]): ReturnType<DataRepairWriteScope['listOperations']> {
    return this.dependencies.dataRepairRepository.listOperations(this.repositoryContext, familyId);
  }

  public appendAudit(input: Parameters<DataRepairWriteScope['appendAudit']>[0]): ReturnType<DataRepairWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repositoryContext, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repositoryContext, event);
  }
}

export class RepositoryBackedDataRepairUnitOfWork implements DataRepairUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedDataRepairDependencies) {}

  public execute<TValue>(
    context: DataRepairApplicationContext,
    operation: (scope: DataRepairWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: context.actor,
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      return operation(new RepositoryBackedDataRepairWriteScope(this.dependencies, repositoryContext, transaction.occurredAt));
    });
  }
}
