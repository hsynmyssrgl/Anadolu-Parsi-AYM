import { err, ok, type AppError, type Result } from '@ppt/core';
import type { DatabaseExecutor } from '@ppt/contracts';
import { mapSqliteError } from '@ppt/database';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

export interface RepositoryExecutionPolicyGuard {
  assert(context: RepositoryExecutionContext): void;
}

export interface SqliteRepositoryOptions {
  readonly executionPolicyGuard?: RepositoryExecutionPolicyGuard;
}


export abstract class SqliteRepository {
  readonly #executionPolicyGuard: RepositoryExecutionPolicyGuard | undefined;

  public constructor(options: SqliteRepositoryOptions = {}) {
    this.#executionPolicyGuard = options.executionPolicyGuard;
  }

  protected database(context: RepositoryExecutionContext): DatabaseExecutor {
    this.#executionPolicyGuard?.assert(context);
    return context.transaction as unknown as DatabaseExecutor;
  }

  protected execute<TValue>(
    context: RepositoryExecutionContext,
    operation: () => TValue
  ): Result<TValue, AppError> {
    this.#executionPolicyGuard?.assert(context);
    try {
      return ok(operation());
    } catch (error) {
      return err(mapSqliteError(error, context.correlationId));
    }
  }
}
