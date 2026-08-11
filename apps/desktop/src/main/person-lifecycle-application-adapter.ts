import type { AppError, Result } from '@ppt/core';
import type {
  PersonLifecycleApplicationContext,
  PersonLifecycleUnitOfWork,
  PersonLifecycleWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import { CentralAuthorizationService, isAuthorizationRole } from '@ppt/security';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  OutboxRepositoryPort,
  PersonLifecycleRepositoryPort,
  RepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface RepositoryBackedPersonLifecycleDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly personLifecycleRepository: PersonLifecycleRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
}

class RepositoryBackedPersonLifecycleWriteScope implements PersonLifecycleWriteScope {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(
    private readonly dependencies: RepositoryBackedPersonLifecycleDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: PersonLifecycleWriteScope['occurredAt']
  ) {}

  public authorizeAdministration(): ReturnType<PersonLifecycleWriteScope['authorizeAdministration']> {
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

  public findProfile(personId: Parameters<PersonLifecycleWriteScope['findProfile']>[0]): ReturnType<PersonLifecycleWriteScope['findProfile']> {
    return this.dependencies.personLifecycleRepository.findProfile(this.repositoryContext, personId);
  }

  public findPotentialDuplicate(input: Parameters<PersonLifecycleWriteScope['findPotentialDuplicate']>[0]): ReturnType<PersonLifecycleWriteScope['findPotentialDuplicate']> {
    return this.dependencies.personLifecycleRepository.findPotentialDuplicate(this.repositoryContext, input);
  }

  public inspectReferences(personId: Parameters<PersonLifecycleWriteScope['inspectReferences']>[0]): ReturnType<PersonLifecycleWriteScope['inspectReferences']> {
    return this.dependencies.personLifecycleRepository.inspectReferences(this.repositoryContext, personId);
  }

  public updateProfile(input: Parameters<PersonLifecycleWriteScope['updateProfile']>[0]): ReturnType<PersonLifecycleWriteScope['updateProfile']> {
    return this.dependencies.personLifecycleRepository.updateProfile(this.repositoryContext, input);
  }

  public insertOperation(operation: Parameters<PersonLifecycleWriteScope['insertOperation']>[0]): ReturnType<PersonLifecycleWriteScope['insertOperation']> {
    return this.dependencies.personLifecycleRepository.insertOperation(this.repositoryContext, operation);
  }

  public findOperation(operationId: Parameters<PersonLifecycleWriteScope['findOperation']>[0]): ReturnType<PersonLifecycleWriteScope['findOperation']> {
    return this.dependencies.personLifecycleRepository.findOperation(this.repositoryContext, operationId);
  }

  public listOperationsByPerson(personId: Parameters<PersonLifecycleWriteScope['listOperationsByPerson']>[0]): ReturnType<PersonLifecycleWriteScope['listOperationsByPerson']> {
    return this.dependencies.personLifecycleRepository.listOperationsByPerson(this.repositoryContext, personId);
  }

  public markOperationUndone(input: Parameters<PersonLifecycleWriteScope['markOperationUndone']>[0]): ReturnType<PersonLifecycleWriteScope['markOperationUndone']> {
    return this.dependencies.personLifecycleRepository.markOperationUndone(this.repositoryContext, input);
  }

  public appendAudit(input: Parameters<PersonLifecycleWriteScope['appendAudit']>[0]): ReturnType<PersonLifecycleWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repositoryContext, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repositoryContext, event);
  }
}

export class RepositoryBackedPersonLifecycleUnitOfWork implements PersonLifecycleUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedPersonLifecycleDependencies) {}

  public execute<TValue>(
    context: PersonLifecycleApplicationContext,
    operation: (scope: PersonLifecycleWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: context.actor,
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      return operation(new RepositoryBackedPersonLifecycleWriteScope(this.dependencies, repositoryContext, transaction.occurredAt));
    });
  }
}
