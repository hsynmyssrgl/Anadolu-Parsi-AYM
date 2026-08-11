import type { AppError, IsoDateTime, Result } from '@ppt/core';
import type { BootstrapApplicationContext, BootstrapApplicationUnitOfWork, BootstrapWriteScope } from '@ppt/application';
import type { TransactionExecutor } from '@ppt/repository-contracts';
import type { AuditRepositoryPort, BootstrapRepositoryPort, RepositoryExecutionContext } from '@ppt/repository-contracts';

export interface RepositoryBackedBootstrapApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly bootstrapRepository: BootstrapRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
}

class RepositoryBackedBootstrapWriteScope implements BootstrapWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedBootstrapApplicationDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: IsoDateTime
  ) {}

  public seedIfEmpty(seed: Parameters<BootstrapWriteScope['seedIfEmpty']>[0]): ReturnType<BootstrapWriteScope['seedIfEmpty']> {
    return this.dependencies.bootstrapRepository.seedIfEmpty(this.repositoryContext, seed, this.repositoryContext.occurredAt);
  }

  public appendAudit(input: Parameters<BootstrapWriteScope['appendAudit']>[0]): ReturnType<BootstrapWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repositoryContext, input);
  }
}

export class RepositoryBackedBootstrapApplicationUnitOfWork implements BootstrapApplicationUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedBootstrapApplicationDependencies) {}

  public execute<TValue>(
    context: BootstrapApplicationContext,
    operation: (scope: BootstrapWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: context.actor,
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      return operation(new RepositoryBackedBootstrapWriteScope(this.dependencies, repositoryContext, transaction.occurredAt));
    });
  }
}
