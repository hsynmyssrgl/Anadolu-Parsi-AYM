import { asCorrelationId, ok, type AppError, type Result } from '@ppt/core';
import type {
  LifeApplicationContext,
  LifePolicyIntent,
  ReportApplicationContext,
  ReportQueryPort
} from '@ppt/application';
import type {
  LifeProjectionRepositoryPort,
  ReportRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import type { RepositoryBackedLifePolicyTransactionRunner } from './life-application-adapter.js';

type LifePolicyTransactionRunner = Pick<RepositoryBackedLifePolicyTransactionRunner, 'execute'>;

export interface RepositoryBackedReportDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly reportRepository: ReportRepositoryPort;
  readonly lifeProjectionRepository: LifeProjectionRepositoryPort;
  readonly lifePolicyTransactionRunner: LifePolicyTransactionRunner;
}

const repositoryContext = (
  context: ReportApplicationContext,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: {
    userId: context.actorId,
    roles: [context.actorRole],
    ...(context.actorPersonId ? { personId: context.actorPersonId } : {})
  },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

const lifeContext = (context: ReportApplicationContext): LifeApplicationContext => ({
  familyId: context.familyId,
  actor: {
    userId: context.actorId,
    role: context.actorRole,
    ...(context.actorPersonId ? { personId: context.actorPersonId } : {})
  },
  correlationId: asCorrelationId(`${context.correlationId}:life-report`)
});

const readIntent: LifePolicyIntent = Object.freeze({
  action: 'read',
  capability: 'family.read',
  resourceType: 'life_record',
  resourceId: '*',
  purpose: 'general'
});

export class RepositoryBackedReportQueryPort implements ReportQueryPort {
  public constructor(private readonly dependencies: RepositoryBackedReportDependencies) {}

  private executeRepository<T>(
    context: ReportApplicationContext,
    operation: (repository: RepositoryExecutionContext) => Result<T, AppError>
  ): Result<T, AppError> {
    return this.dependencies.transactionExecutor.execute(
      context.correlationId,
      (transaction) => operation(repositoryContext(context, transaction))
    );
  }

  public async getSummary(
    context: ReportApplicationContext,
    now: Parameters<ReportQueryPort['getSummary']>[1],
    in30Days: Parameters<ReportQueryPort['getSummary']>[2]
  ): ReturnType<ReportQueryPort['getSummary']> {
    if (!context.actorPersonId) {
      // No exact person identity means no LIFE receipt can be issued. Return
      // non-LIFE data and an explicit empty LIFE projection without LIFE SQL.
      const nonLife = this.executeRepository(context, (repository) =>
        this.dependencies.reportRepository.getNonLifeSummary(
          repository,
          context.familyId,
          now,
          in30Days
        ));
      return nonLife.ok
        ? ok({
            ...nonLife.value,
            activeTasks: 0,
            expiringInsurance: 0,
            overdueItems: []
          })
        : nonLife;
    }
    return this.dependencies.lifePolicyTransactionRunner.execute(
      lifeContext(context),
      readIntent,
      ({ repository }) => {
        const nonLife = this.dependencies.reportRepository.getNonLifeSummary(
          repository,
          context.familyId,
          now,
          in30Days
        );
        if (!nonLife.ok) return nonLife;
        const life = this.dependencies.lifeProjectionRepository.getLifeReportProjection(
          repository,
          { now, in30Days, overdueLimit: 25 }
        );
        if (!life.ok) return life;
        return ok({
          ...nonLife.value,
          activeTasks: life.value.activeTasks,
          expiringInsurance: life.value.expiringInsurance,
          overdueItems: life.value.overdueItems
        });
      }
    );
  }
}
